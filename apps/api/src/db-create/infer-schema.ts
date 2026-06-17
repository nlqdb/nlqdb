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

// SK-HDC-020 — validation-guided re-inference. A first plan that fails Zod
// is usually almost right (the dominant cause is a reserved-word identifier
// the prompt's short example list doesn't cover — measured deterministic on
// real P1 goals), so a single re-call with the rejected plan + issues fed
// back recovers it, mirroring the planner's execution-guided repair
// (SK-ASK-022). One repair only: failure-path cost, bounded latency.
const INFER_MAX_ATTEMPTS = 2;
// Rejected plan echoed back to the model so it edits rather than redesigns;
// capped so the retry prompt's token budget stays predictable.
const PREV_PLAN_CAP = 6000;
// First few issues are enough to steer the fix; the path+message form is the
// same one the eval harness logs. Internal only — never returned to the
// client (GLOBAL-012).
function summarizeIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 8)
    .map((i) => `- ${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

export async function inferSchema(
  deps: InferSchemaDeps,
  args: InferSchemaArgs,
): Promise<InferSchemaResult> {
  let previousAttempt: { plan: string; issues: string } | undefined;

  for (let attempt = 0; attempt < INFER_MAX_ATTEMPTS; attempt++) {
    // 1. schemaInfer-tier LLM call. The router wraps this in `llm.schema_infer`
    //    per GLOBAL-014 / SK-HDC's GLOBAL-014 commentary. The provider is told
    //    via the system prompt (packages/llm/src/prompts/schema-inference.ts)
    //    to emit a SchemaPlan-shaped JSON object directly; the provider's
    //    `parseJsonResponse` handles JSON-mode + ```json fence stripping
    //    before returning. On a repair attempt `previousAttempt` carries the
    //    rejected plan + issues (SK-HDC-020).
    let candidate: Record<string, unknown>;
    try {
      const resp = await deps.llm.schemaInfer({
        goal: args.goal,
        ...(previousAttempt ? { previousAttempt } : {}),
      });
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
      // SK-HDC-020 — re-infer once with the validation issues fed back before
      // surfacing `plan_invalid`. The client never sees raw Zod issues (they
      // expose our schema shape); the issue count is enough to correlate with
      // OTel.
      if (attempt + 1 < INFER_MAX_ATTEMPTS) {
        previousAttempt = {
          plan: JSON.stringify(candidate).slice(0, PREV_PLAN_CAP),
          issues: summarizeIssues(parsed.error.issues),
        };
        continue;
      }
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

  // Unreachable: the loop returns on every path within INFER_MAX_ATTEMPTS.
  return { ok: false, reason: "llm_failed" };
}
