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

import { type WidenPlan, WidenPlanSchema } from "@nlqdb/db/types";
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
    const resp = await deps.llm.extendSchema({ goal: args.goal, schema: args.schema });
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

  return { ok: true, plan: parsed.data satisfies WidenPlan, model, confidence };
}
