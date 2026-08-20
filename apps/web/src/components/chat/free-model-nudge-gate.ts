// SK-PREMIUM-004 — the pure predicate deciding whether the free-model nudge
// fires for a reply, plus the resolver for which model to name on it. Kept free
// of React/ChatPanel imports so it's unit-testable on its own; ChatPanel and
// the test both import from here.

// Plan-confidence below this reads as "the model wasn't sure", mirroring the
// 0.7 routing floor (SK-ASK-009). Above it, a free answer is confident enough
// that the nudge would just be banner-blindness.
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// The API error codes that mean the free *model* struggled — a frontier model
// would plausibly have done better, so "switch models" is honest advice:
//   `llm_failed`     — couldn't produce a usable plan at all.
//   `sql_rejected`   — produced disallowed / unparseable SQL.
//   `invalid_value`  — generated SQL whose values didn't fit their columns
//                      (a bad cast / range — SQLSTATE class 22, SK-ASK-030): a
//                      planning-quality miss a frontier model typically avoids.
// (`schema_mismatch` is handled separately — see below.) Rate-limit / auth /
// network / db-reachability failures, and write *outcome* codes (`write_no_rows`,
// `write_constraint` — the data/intent, not the plan), are NOT the model's
// fault, so a "switch models" nudge there is misleading and stays excluded.
// A below-floor plan is no longer an error code either: GLOBAL-040 makes it a
// `clarify_required` guided turn (help, not a struggle to upsell over), and the
// sub-floor *ok-path* struggle below still catches the confident-but-shaky
// answer that actually ran — the case where "switch models" is honest advice.
const MODEL_QUALITY_ERROR_CODES = new Set(["llm_failed", "sql_rejected", "invalid_value"]);

// A cache-hit whose originating model we never recorded stores this placeholder
// (orchestrate.ts). It's not a real model id, so we never name it on the nudge.
const UNKNOWN_MODEL = "cached";

// The minimal reply shape the gate reads — structural so `Reply` (defined in
// ChatPanel) is assignable without a circular import. `model` on the error
// state carries the attempted model from an `llm_failed` envelope (SK-LLM-051);
// `trace.model` carries the model that produced a plan before a later failure.
export type StruggleInput = {
  state:
    | { kind: "error"; code?: string; referencedTables?: string[]; model?: string }
    | { kind: "ok"; ok: { trace?: { confidence?: number } | null } }
    | { kind: string };
  trace?: { confidence?: number; model?: string } | null;
};

export function freeChainStruggled(reply: StruggleInput): boolean {
  if (reply.state.kind === "error") {
    const err = reply.state as { code?: string; referencedTables?: string[] };
    if (err.code !== undefined && MODEL_QUALITY_ERROR_CODES.has(err.code)) return true;
    // `schema_mismatch` (SK-ASK-016) converges two paths behind one wire code:
    // the pre-flight hallucination (non-empty `referencedTables` — the model
    // invented a relation, a model-quality failure the nudge fires on) and the
    // exec-catch orphaned-schema / missing-relation case (empty — an infra
    // failure a frontier model fails identically, SK-ASK-019), so gate on the
    // referenced-table list being non-empty.
    return err.code === "schema_mismatch" && (err.referencedTables?.length ?? 0) > 0;
  }
  if (reply.state.kind === "ok") {
    const ok = (reply.state as { ok: { trace?: { confidence?: number } | null } }).ok;
    const confidence = reply.trace?.confidence ?? ok.trace?.confidence;
    return typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;
  }
  return false;
}

// The model to name on the nudge: the one that produced the plan before the
// failure (`trace.model`, streamed on the `plan` event before every post-plan
// error), else the model an `llm_failed` envelope reports it attempted. Returns
// null when no real model id is known — a pre-plan `llm_failed` on the free
// chain has no single model, and a legacy cache row stores only the placeholder
// — so the nudge falls back to its model-agnostic copy rather than naming a lie.
export function strugglingModel(reply: StruggleInput): string | null {
  const fromError =
    reply.state.kind === "error" ? (reply.state as { model?: string }).model : undefined;
  const model = reply.trace?.model ?? fromError;
  if (!model || model === UNKNOWN_MODEL) return null;
  return model;
}
