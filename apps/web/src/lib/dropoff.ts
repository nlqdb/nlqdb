// SK-ONBOARD-005 — onboarding drop-off funnel instrument.
//
// The drop-off KPI is the second GLOBAL-025 pillar's remaining
// uninstrumented signal: the funnel `landing.viewed →
// first_query.attempted → second_query.attempted`. It separates the
// three ways onboarding leaks — "users arrive and bounce" (drop-off,
// this file) vs. "arrive, query, and leave unanswered" (first-10
// success, SK-ONBOARD-006, server D1 counters) vs. "succeed and leave
// anyway" (retention). Like TTFV (lib/ttfv.ts) it is browser-measured
// by necessity — the server never sees a landing or an abandoned form —
// so it rides the same client LogSnag funnel (lib/logsnag.ts) as the
// other `home.*`/`onboarding.*` demand signals (SK-ONBOARD-008).
//
// Two fire-guards carry the whole design: `landing` fires once per mount
// (a re-render must never re-count a single arrival), and `attempt`
// carries a 1-based ordinal capped at 2 — the funnel names exactly two
// query stages, and a stranger's repeated retries past the second are
// noise, not new drop-off signal. Both events fire before the network
// call, so a `second_query.attempted` is recorded even when the
// SK-ANON-012 one-shot cap redirects the second submit to sign-in.

export const LANDING_EVENT = "onboarding.landing_viewed";
export const ATTEMPT_EVENT = "onboarding.query_attempted";

export interface DropoffEvent {
  event: string;
  props: { surface: string; ordinal?: number };
}

export function makeDropoffFunnel() {
  let landed = false;
  let attempts = 0;
  return {
    // `landing.viewed` — the top of the funnel; fires once per mount.
    landing(surface: string): DropoffEvent | null {
      if (landed) return null;
      landed = true;
      return { event: LANDING_EVENT, props: { surface } };
    },
    // `first_query.attempted` (ordinal 1) then `second_query.attempted`
    // (ordinal 2); further attempts are dropped.
    attempt(surface: string): DropoffEvent | null {
      if (attempts >= 2) return null;
      attempts += 1;
      return { event: ATTEMPT_EVENT, props: { surface, ordinal: attempts } };
    },
  };
}
