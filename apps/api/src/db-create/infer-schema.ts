// Stage 1 of the typed-plan pipeline (docs/design.md §3.6.2): goal
// string in, validated `SchemaPlan` out. The LLM picks structure, our
// code emits SQL — see docs/research-receipts.md §2 for the Cortex
// Analyst / SchemaAgent / CHASE-SQL receipts and SK-HDC-002 /
// SK-HDC-003 in `.claude/skills/hosted-db-create/SKILL.md`.
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
import type { LLMRouter } from "@nlqdb/llm";

export type InferSchemaDeps = {
  llm: LLMRouter;
};

export type InferSchemaArgs = {
  // The user's natural-language description of what they want.
  goal: string;
  // Optional override for the generated slug. When set, replaces the
  // LLM's `slug_hint` with a deterministic slugify of `name`.
  name?: string;
};

export type InferSchemaResult =
  | { ok: true; plan: SchemaPlan }
  | { ok: false; reason: "ambiguous_goal" | "llm_failed" }
  | { ok: false; reason: "plan_invalid"; details: { issue_count: number } };

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
  try {
    const resp = await deps.llm.schemaInfer({ goal: args.goal });
    candidate = resp.plan;
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

  return { ok: true, plan: parsed.data };
}
