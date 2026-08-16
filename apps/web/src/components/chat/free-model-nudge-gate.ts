// SK-PREMIUM-004 — the pure predicate deciding whether the free-model nudge
// fires for a reply. Kept free of React/ChatPanel imports so it's unit-testable
// on its own; ChatPanel and the test both import from here.

// Plan-confidence below this reads as "the model wasn't sure", mirroring the
// 0.7 routing floor (SK-ASK-009). Above it, a free answer is confident enough
// that the nudge would just be banner-blindness.
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// Only these API error codes mean the free *model* struggled: couldn't plan
// (`llm_failed`) or produced disallowed SQL (`sql_rejected`). Rate-limit / auth
// / network / db-reachability failures are not the model's fault, so a "switch
// models" nudge there is misleading and is deliberately excluded.
const MODEL_QUALITY_ERROR_CODES = new Set(["llm_failed", "sql_rejected"]);

// The minimal reply shape the gate reads — structural so `Reply` (defined in
// ChatPanel) is assignable without a circular import.
export type StruggleInput = {
  state:
    | { kind: "error"; code?: string; referencedTables?: string[] }
    | { kind: "ok"; ok: { trace?: { confidence?: number } | null } }
    | { kind: string };
  trace?: { confidence?: number } | null;
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
