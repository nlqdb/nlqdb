// Widen-on-write step 1 of the extend pipeline (GLOBAL-041 Phase A step 2,
// exec half): the write's fields aren't all in the observed schema, so the
// LLM designs the smallest `WidenPlan` that admits them. Goal + observed
// schema in, validated `WidenPlan` out — the evolution analogue of
// `infer-schema.ts` (create). The LLM picks structure; our code emits SQL
// (`compile-write-ddl.ts`, GLOBAL-041 Phase A step 3).
//
// This module is pure: the LLM router is injected via `ExtendSchemaDeps`.
// Tests construct stubs; the `/v1/ask` orchestrator (step 1 routing, next
// slice) wires the real router and feeds it `db.schemaText`.
//
// What we DO NOT emit here: any SQL string. The plan is structure only —
// that collapses the prompt-injection surface from "any DDL the LLM can
// write" to "any shape the LLM can force into `WidenPlanSchema`" (SK-HDC-003
// layer 1; the `sql-validate-ddl.ts` libpg_query parse over the compiled DDL
// is layer 2). The extend LLM call rides the `schema_infer` router tier
// (same one-shot structural-design budget) with the extend prompt.

import { IdentifierSchema, type WidenPlan, WidenPlanSchema } from "@nlqdb/db/types";
import { writeTarget } from "../ask/diff.ts";
// The Deps/Args/Result contract is canonical in `./types.ts` (the pipeline's
// single source of truth) — re-exported so this module's callers keep one
// import path, exactly as `infer-schema.ts` does.
import type { ExtendSchemaArgs, ExtendSchemaDeps, ExtendSchemaResult } from "./types.ts";

export type { ExtendSchemaArgs, ExtendSchemaDeps, ExtendSchemaResult };

export async function extendSchema(
  deps: ExtendSchemaDeps,
  args: ExtendSchemaArgs,
): Promise<ExtendSchemaResult> {
  // 1. extendSchema-tier LLM call. The router wraps this in the shared
  //    `schema_infer` span/chain (GLOBAL-014); the provider is told via the
  //    extend system prompt to emit a `WidenPlan`-shaped JSON object
  //    directly, and `parseJsonResponse` strips JSON-mode / ```json fences.
  let candidate: Record<string, unknown>;
  let model: string;
  let confidence: number;
  try {
    const resp = await deps.llm.extendSchema({
      goal: args.goal,
      schema: args.schema,
      ...(args.write ? { write: args.write } : {}),
      // GLOBAL-041 Phase A — let the router fail over to the next provider when
      // the head planner returns a WidenPlanSchema-invalid plan (qwen does this
      // intermittently; gemini designs the same shape validly — run-210
      // finding). This predicate ONLY gates provider fallthrough; the
      // authoritative Zod parse below is unchanged and remains the security gate
      // (SK-HDC-003 layer 1).
      // A plan that omits an INSERT column fails over too: its batch would
      // roll back on 42703 (the run-225 dogfood miss).
      validate: (plan) => {
        const p = WidenPlanSchema.safeParse(plan);
        return p.success && missing(p.data).length === 0;
      },
    });
    candidate = resp.plan;
    model = resp.model;
    confidence = resp.confidence;
  } catch {
    // LLM error details (provider messages, keys in URLs, stack traces) must
    // not reach the client — GLOBAL-012. The router's OTel span captures the
    // root cause (SK-LLM-006).
    return { ok: false, reason: "llm_failed" };
  }

  // 2. Zod validation (SK-HDC-003 layer 1 of defense-in-depth). This is the
  //    first place untrusted extend-prompt output is gated — the widen-only
  //    invariants (nullable, no DEFAULT, non-empty plan) are enforced here,
  //    the same grammar `compile-write-ddl.ts` compiles and
  //    `sql-validate-ddl.ts` allow-lists.
  const parsed = WidenPlanSchema.safeParse(candidate);
  if (!parsed.success) {
    // Don't leak raw Zod issues (they expose our schema shape); the issue
    // count is enough to correlate with OTel if needed.
    return {
      ok: false,
      reason: "plan_invalid",
      details: { issue_count: parsed.error.issues.length },
    };
  }

  // Defense in depth for a router that ignores `validate` (a stub, a
  // BYOLLM lane): a doomed batch never reaches the transaction.
  const omitted = missing(parsed.data);
  if (omitted.length > 0) {
    return { ok: false, reason: "plan_misses_write_columns", details: { missing: omitted } };
  }

  return { ok: true, plan: parsed.data satisfies WidenPlan, model, confidence };

  function missing(plan: WidenPlan): string[] {
    return args.write ? missingWriteColumns(plan, args.write, args.schema) : [];
  }
}

// The approved INSERT's table + columns as the widen plan must name them —
// Postgres-folded, and only when every name is a plan-legal identifier. A
// quoted name outside `IdentifierSchema` (mixed case, spaces, newlines) can't
// be admitted by any plan, so it never reaches the prompt or the gate.
export function writeColumns(writeSql: string): ExtendSchemaArgs["write"] {
  const target = writeTarget(writeSql);
  if (!target?.columns) return undefined;
  const table = target.table.toLowerCase();
  const names = [table, ...target.columns];
  return names.every((n) => IdentifierSchema.safeParse(n).success)
    ? { table, columns: target.columns }
    : undefined;
}

// The approved write's INSERT columns the plan fails to admit: not on the
// table the plan creates, and — for an existing table — neither added by the
// plan nor already in that table's observed DDL. A non-empty result is a widen
// whose batch rolls back on the INSERT's 42703 (the run-225 dogfood
// `schema_mismatch` miss class: a replayed plan dropped the INSERT's `run`).
export function missingWriteColumns(
  plan: WidenPlan,
  write: { table: string; columns: string[] },
  schemaText: string,
): string[] {
  const created = plan.create_tables.find((t) => t.name === write.table);
  const have = created
    ? new Set(created.columns.map((c) => c.name))
    : observedColumns(schemaText, write.table);
  if (!created) {
    for (const a of plan.add_columns) if (a.table === write.table) have.add(a.column.name);
  }
  return write.columns.filter((c) => !have.has(c));
}

// Columns `table` defines in the observed DDL: its CREATE TABLE column
// definitions plus `ALTER TABLE … ADD [COLUMN]`. Constraint lines, FK
// `REFERENCES` targets and comments name columns it may not have.
function observedColumns(schemaText: string, table: string): Set<string> {
  const ddl = schemaText.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ");
  const ref = `(?:"?\\w+"?\\.)?"?${escapeRe(table)}"?`;
  const cols = new Set<string>();
  const add = (def: string) => {
    const m = /^\s*(?:"((?:[^"]|"")+)"|(\w+))/.exec(def);
    if (m?.[1]) cols.add(m[1].replace(/""/g, '"'));
    else if (m?.[2] && !CONSTRAINT_HEADS.has(m[2].toLowerCase())) cols.add(m[2].toLowerCase());
  };
  const create = new RegExp(
    `\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${ref}\\s*\\(`,
    "gi",
  );
  for (const m of ddl.matchAll(create))
    for (const def of topLevelDefs(ddl, m.index + m[0].length)) add(def);
  const alter = new RegExp(
    `\\bALTER\\s+TABLE\\s+(?:ONLY\\s+)?${ref}\\s+ADD\\s+(?:COLUMN\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?([^;]*)`,
    "gi",
  );
  for (const m of ddl.matchAll(alter)) add(m[1] ?? "");
  return cols;
}

const CONSTRAINT_HEADS = new Set([
  "constraint",
  "primary",
  "foreign",
  "unique",
  "check",
  "exclude",
  "like",
]);

// The CREATE TABLE body opening at `from`, split on its depth-0 commas and
// ended by its closing paren; quoted text (`DEFAULT ')'`, `"a,b"`) is skipped.
function topLevelDefs(ddl: string, from: number): string[] {
  const defs: string[] = [];
  let depth = 0;
  let start = from;
  let i = from;
  for (; i < ddl.length; i++) {
    const ch = ddl[i];
    if (ch === "'" || ch === '"') {
      const close = ddl.indexOf(ch, i + 1);
      if (close < 0) break;
      i = close;
    } else if (ch === "(") depth++;
    else if (ch === ")" && depth-- === 0) break;
    else if (ch === "," && depth === 0) {
      defs.push(ddl.slice(start, i));
      start = i + 1;
    }
  }
  return [...defs, ddl.slice(start, i)];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
