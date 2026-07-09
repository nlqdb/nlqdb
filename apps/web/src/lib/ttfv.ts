// SK-ONBOARD-005 — TTFV (landing → first answer) instrument.
//
// TTFV is the second GLOBAL-025 pillar's Phase-2 exit-gate criterion
// (p50 ≤ 60 s). It is browser-measured by necessity: `performance.now()`
// at the first answer is ms since page navigation start — the full
// landing→answer span, including hydration and the user's think/type
// time. The server can't see when the user landed, so unlike the
// first-10-queries KPI (SK-ONBOARD-006, server-side D1 counters) TTFV
// can't ride a D1 counter; it rides the same client LogSnag funnel as
// the other `home.*`/`onboarding.*` demand signals (SK-ONBOARD-008).
//
// `makeTtfvOnce()` returns a fire-once recorder: the first call yields
// the payload, every later call yields null. That guard is the
// load-bearing property — a re-render or a resubmit must never
// double-count a single landing (a stranger gets one SK-ANON-012 create
// call, so their first ok IS their first answer).

export const TTFV_EVENT = "onboarding.first_answer";

export interface TtfvPayload {
  event: typeof TTFV_EVENT;
  props: { ttfv_ms: number; surface: string };
}

export function makeTtfvOnce(now: () => number = () => performance.now()) {
  let fired = false;
  return (surface: string): TtfvPayload | null => {
    if (fired) return null;
    fired = true;
    return { event: TTFV_EVENT, props: { ttfv_ms: Math.round(now()), surface } };
  };
}
