// The pure resolver deciding which trace steps the Trace pane renders for a
// reply (SK-WEB-005 trace pane × GLOBAL-011 honest latency). Kept free of
// React/ChatPanel imports so it's unit-testable on its own; ChatPanel and the
// test both import from here.
//
// GLOBAL-011 (honest latency — never spinner-lie): once a reply has settled
// into a terminal state, no pipeline step may still render as "pending". The
// streaming (`askStream`) path fills each step from live trace events, so its
// settled replies carry ok/error steps. The non-stream `ask()` path — the
// post-sign-in "All databases" replay and the 0-DB create reply — receives no
// per-step telemetry (AskOk.trace carries only sql/plan_id/confidence/model/
// cache_hit, never step timings), so its steps stay seeded-pending forever and
// render as permanent spinners under a finished answer. A cache-hit stream that
// skips plan/validate/exec leaves those steps pending too. This resolver drops
// still-pending steps from any settled reply so the trace shows only what
// actually ran; a reply still in flight (or paused at the confirm gate) keeps
// its live pipeline, spinners and all.

// Reply states that are still active — the pipeline is running, or paused
// awaiting the user's confirm action — and whose pending steps are honest.
// Every other kind (ok, created, ambiguous, clarify, error) is terminal.
const ACTIVE_STATE_KINDS = new Set(["pending", "needs-confirm"]);

// Structural — matches ChatPanel's `TraceStepRecord` without importing it.
export type StepLike = { status: "pending" | "ok" | "error" };

export function displayTraceSteps<T extends StepLike>(steps: T[], replyStateKind: string): T[] {
  if (ACTIVE_STATE_KINDS.has(replyStateKind)) return steps;
  return steps.filter((s) => s.status !== "pending");
}
