// Stage 1 of the typed-plan pipeline (docs/architecture.md §3.6.2): goal
// string in, validated `SchemaPlan` out. The LLM picks structure, our
// code emits SQL — see docs/research-receipts.md §2 for the Cortex
// Analyst / SchemaAgent / CHASE-SQL receipts and SK-HDC-002 /
// SK-HDC-003 in `docs/features/hosted-db-create/FEATURE.md`.
//
// This module is pure: every external dep — the LLM router — is
// passed in via `InferSchemaDeps`. Tests construct stubs; the parent
// `orchestrate.ts` (Worksheet D) wires the real router. Same shape
// as `apps/api/src/ask/orchestrate.ts`.
//
// What we DO NOT emit here: any SQL string. The plan is structure
// only; Worksheet B compiles it. That collapses prompt-injection
// surface from "any SQL the LLM can write" to "any shape the LLM can
// force into our Zod schema."
//
// The schema-inference LLM call uses the dedicated `schemaInfer`
// router operation (SK-LLM-* extension; span name `llm.schema_infer`
// per SK-HDC's GLOBAL-014 commentary). The router emits the OTel
// span; this module adds none.
//
// Canonical types and Zod schema live in `packages/db/src/types.ts`
// (SK-HDC Touchpoints) — every db-create sub-module imports from
// `@nlqdb/db/types`.

import { type SchemaPlan, SchemaPlanSchema } from "@nlqdb/db/types";
// The Deps/Args/Result contract is canonical in `./types.ts` (the
// orchestrator's single source of truth) — re-exported here so this
// module's callers keep one import path.
import type { InferSchemaArgs, InferSchemaDeps, InferSchemaResult } from "./types.ts";

export type { InferSchemaArgs, InferSchemaDeps, InferSchemaResult };

// Bound on the slug derived from `args.name`. The plan-level slug_hint
// allows up to 63 chars (Postgres identifier limit) but the override
// path biases shorter for prettier dbId surfacing in the dashboard.
const SLUG_MAX_LEN = 30;

// Combining-mark range used by NFD normalization to expose accents
// as separate code points. Stripping this range turns "café" → "cafe"
// without losing the base letter.
const COMBINING_MARKS_RE = /[̀-ͯ]/g;

// Deterministic lower_snake_case slug. Strips combining marks
// ("café" → "cafe"), collapses non-alphanumerics to `_`, ensures the
// first char is a letter, clamps length. Always returns a valid
// `Identifier` (worst case `db_<digits>` for all-digit input).
export function slugifyName(input: string): string {
  let s = input.normalize("NFD").replace(COMBINING_MARKS_RE, "");
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  if (s.length === 0) return "db";
  if (!/^[a-z]/.test(s)) s = `db_${s}`;
  if (s.length > SLUG_MAX_LEN) s = s.slice(0, SLUG_MAX_LEN).replace(/_+$/, "");
  return s.length > 0 ? s : "db";
}

// Heuristic: a plan with no real schema (no PK referencing actual
// columns on any table) means the LLM produced shallow filler for a
// goal it couldn't pin down. Surfacing this as `ambiguous_goal` lets
// the caller re-prompt rather than burning a Zod-pass on noise.
function isShallowPlan(plan: SchemaPlan): boolean {
  if (plan.tables.length === 0) return true;
  return !plan.tables.some(
    (t) =>
      t.primary_key.length > 0 && t.primary_key.every((pk) => t.columns.some((c) => c.name === pk)),
  );
}

// SK-HDC-022 — an inferred NOT NULL foreign key dead-ends the creator's very
// next write. The goal string never names which parent row a new child belongs
// to ("add an idea to build X" says nothing about which of the seeded demo
// users owns it), so a speculative `NOT NULL` owner column makes the obvious
// next action structurally impossible: the planner must invent a parent key
// (23503), borrow an arbitrary one (silent misattribution), or give up.
//
// Referential integrity is kept — the FK constraint still rejects a value that
// names no parent. Only the *mandatory* part is dropped, and only for FK
// columns the plan did not make part of the child's primary key: a link/child
// table keyed on its parents ("idea_tags(idea_id, tag_id)") genuinely cannot
// exist without them, and a nullable PK member is not even legal Postgres.
// Bonus: `ON DELETE SET NULL` on a NOT NULL column is a provision-time DDL
// error the free chain does emit; relaxing removes that failure mode too.
export function relaxSpeculativeForeignKeys(plan: SchemaPlan): SchemaPlan {
  const relaxable = new Map<string, Set<string>>();
  const pkByTable = new Map(plan.tables.map((t) => [t.name, new Set(t.primary_key)]));
  for (const fk of plan.foreign_keys) {
    const pk = pkByTable.get(fk.from_table);
    if (!pk) continue; // FK on an unknown table — compile-ddl rejects it later.
    for (const column of fk.from_columns) {
      if (pk.has(column)) continue;
      const columns = relaxable.get(fk.from_table);
      if (columns) columns.add(column);
      else relaxable.set(fk.from_table, new Set([column]));
    }
  }
  if (relaxable.size === 0) return plan;
  return {
    ...plan,
    tables: plan.tables.map((t) => {
      const columns = relaxable.get(t.name);
      if (!columns) return t;
      return {
        ...t,
        columns: t.columns.map((c) =>
          columns.has(c.name) && c.nullable === false ? { ...c, nullable: true } : c,
        ),
      };
    }),
  };
}

export async function inferSchema(
  deps: InferSchemaDeps,
  args: InferSchemaArgs,
): Promise<InferSchemaResult> {
  // 1. schemaInfer-tier LLM call. The router wraps this in `llm.schema_infer`
  //    per GLOBAL-014 / SK-HDC's GLOBAL-014 commentary. The provider is told
  //    via the system prompt (packages/llm/src/prompts/schema-inference.ts)
  //    to emit a SchemaPlan-shaped JSON object directly; the provider's
  //    `parseJsonResponse` handles JSON-mode + ```json fence stripping
  //    before returning.
  let candidate: Record<string, unknown>;
  let model: string;
  let confidence: number;
  try {
    const resp = await deps.llm.schemaInfer({ goal: args.goal });
    candidate = resp.plan;
    model = resp.model;
    confidence = resp.confidence;
  } catch {
    // LLM error details (provider messages, API keys in URLs, stack traces)
    // must not reach the client — GLOBAL-012. The OTel span on the LLM call
    // (emitted by the router per SK-LLM-006) captures the root cause.
    return { ok: false, reason: "llm_failed" };
  }

  // 2. Slug override (pre-validation so the override participates in
  //    the same Identifier-shape check as the LLM's own output).
  if (typeof args.name === "string" && args.name.trim().length > 0) {
    candidate = { ...candidate, slug_hint: slugifyName(args.name) };
  }

  // 3. Zod validation (SK-HDC-003 layer 1 of defense-in-depth). The
  //    libpg_query parse over the compiled DDL is layer 2, owned by
  //    Worksheet B (`apps/api/src/ask/sql-validate-ddl.ts`).
  const parsed = SchemaPlanSchema.safeParse(candidate);
  if (!parsed.success) {
    // Don't send raw Zod issues to the client — they expose our schema shape.
    // The issue count is enough to correlate with OTel if needed.
    return {
      ok: false,
      reason: "plan_invalid",
      details: { issue_count: parsed.error.issues.length },
    };
  }

  // 4. Shallow-plan heuristic — runs after Zod so we know the shape
  //    is sound; only the *content* is too thin.
  if (isShallowPlan(parsed.data)) {
    return { ok: false, reason: "ambiguous_goal" };
  }

  // 5. Relax speculative NOT NULL foreign keys (SK-HDC-022) so the creator's
  //    next write into a child table is possible without a parent key the goal
  //    never supplied. Runs on the inferred path only — hand-authored presets
  //    (SK-HDC-020) skip `inferSchema` entirely and keep their constraints.
  return { ok: true, plan: relaxSpeculativeForeignKeys(parsed.data), model, confidence };
}
