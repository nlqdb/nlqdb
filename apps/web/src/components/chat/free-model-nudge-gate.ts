// SK-PREMIUM-004 — the pure predicate deciding whether the free-model nudge
// fires for a reply. Kept free of React/ChatPanel imports so it's unit-testable
// on its own; ChatPanel and the test both import from here.

// Plan-confidence below this reads as "the model wasn't sure", mirroring the
// 0.7 routing floor (SK-ASK-009). Above it, a free answer is confident enough
// that the nudge would just be banner-blindness.
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// Only these API error codes mean the free *model* struggled: couldn't plan
// (`llm_failed`), produced disallowed SQL (`sql_rejected`), or produced SQL
// referencing a table the DB doesn't have (`schema_mismatch`, SK-ASK-016 — the
// LLM hallucinated a relation; deterministic, a replan re-picks it). All three
// are the model's fault. Rate-limit / auth / network / db-reachability failures
// are not, so a "switch models" nudge there is misleading and is excluded.
const MODEL_QUALITY_ERROR_CODES = new Set(["llm_failed", "sql_rejected", "schema_mismatch"]);

// The minimal reply shape the gate reads — structural so `Reply` (defined in
// ChatPanel) is assignable without a circular import.
export type StruggleInput = {
  state:
    | { kind: "error"; code?: string }
    | { kind: "ok"; ok: { trace?: { confidence?: number } | null } }
    | { kind: string };
  trace?: { confidence?: number } | null;
};

export function freeChainStruggled(reply: StruggleInput): boolean {
  if (reply.state.kind === "error") {
    const code = (reply.state as { code?: string }).code;
    return code !== undefined && MODEL_QUALITY_ERROR_CODES.has(code);
  }
  if (reply.state.kind === "ok") {
    const ok = (reply.state as { ok: { trace?: { confidence?: number } | null } }).ok;
    const confidence = reply.trace?.confidence ?? ok.trace?.confidence;
    return typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;
  }
  return false;
}
