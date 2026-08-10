// EK-06 box 4 — the revocation-latency bound (SK-EKP-008).
//
// A cross-tenant grant is revoked by stamping `revoked_at` on the `grants`
// row (`grants.ts`). Two clocks bound how long a revoked grant can still be
// served, and SK-EKP-008 pins BOTH to the same 30 s ceiling:
//
//   - NEW queries — the broker checks `getActiveGrant` on every request and
//     may cache that status for at most this bound. A positive status older
//     than the bound is no longer trusted; the check re-runs (fail-closed:
//     unknown/errored → reject, never a stale serve past the bound).
//   - IN-FLIGHT queries — a query already executing when the grant is
//     revoked is bounded by the granted path's `statement_timeout`, which
//     SK-EKP-008 fixes at ≤ the same 30 s (the 2026-08-07 hardening: the
//     original wording silently excluded in-flight queries).
//
// The status cache is env-tunable **downward only** (`GRANT_STATUS_TTL_MS`):
// config may tighten revocation latency below 30 s but can never widen it
// past the ceiling. Both clocks read the ceiling from `GRANT_REVOCATION_BOUND_MS`
// so neither can drift above it. This module is the box-4 primitive; the
// live measurement (revoke a grant, assert rejection within the bound on the
// wired `/v1/ask` route) lands with box 2's executor wiring.

import type { GrantRecord } from "./grants.ts";

// SK-EKP-008 ceiling: 30 s. NOT env-tunable upward — this is the invariant a
// reviewer holds the wired route to.
export const GRANT_REVOCATION_BOUND_MS = 30_000;

// Resolve the effective status-cache TTL from the optional
// `GRANT_STATUS_TTL_MS` env value. Downward-only clamp to [0, ceiling]:
// a value at or above the ceiling pins to the ceiling (never widens);
// absent or non-numeric input fails safe to the ceiling (the documented
// default). 0 is permitted — it means "never cache", i.e. re-check every
// request (strictly tighter, so always safe for the NEW-query clock).
export function resolveGrantStatusTtlMs(raw: string | undefined): number {
  // `Number("")`/`Number("  ")` is 0, not NaN — treat blank as absent so an
  // empty env var falls back to the ceiling rather than silently disabling
  // the cache.
  if (raw === undefined || raw.trim() === "") return GRANT_REVOCATION_BOUND_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return GRANT_REVOCATION_BOUND_MS;
  return Math.min(Math.trunc(parsed), GRANT_REVOCATION_BOUND_MS);
}

// The granted path's `SET LOCAL statement_timeout` value — the IN-FLIGHT
// clock, pinned to the ceiling expressed as a Postgres interval. Unlike the
// cache TTL, this clock must never resolve to 0: in Postgres
// `statement_timeout = 0` *disables* the timeout (unbounded), which would
// break the in-flight bound. It is therefore fixed at the ceiling (≤ 30 s
// satisfied by equality), independent of the cache env knob.
export const GRANT_STATEMENT_TIMEOUT = msToPgInterval(GRANT_REVOCATION_BOUND_MS);

// Whole-second bounds render as `<n>s`; a sub-second tightening renders as
// `<n>ms`. Both are valid Postgres interval literals for statement_timeout.
function msToPgInterval(ms: number): string {
  return ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`;
}

// A lookup that returns the caller's active grant, or null when there is
// none. Throwing propagates (the caller rejects fail-closed) — an errored
// status is never cached.
export type GrantLookup = () => Promise<GrantRecord | null>;

// Isolate-local status cache implementing the NEW-query revocation bound.
// POSITIVE-only by design: a live grant is cached until it ages past
// `ttlMs`, so a revoke propagates within `ttlMs` (≤ ceiling). A null or
// errored status is never cached — activation of a fresh grant is immediate
// and a failed check always re-runs fail-closed. `now` is injected so the
// bound is measurable in a unit test without a wall clock.
export function makeGrantStatusCache(opts: { now: () => number; ttlMs: number }) {
  const { now, ttlMs } = opts;
  const hits = new Map<string, { at: number; grant: GrantRecord }>();
  return {
    async status(key: string, lookup: GrantLookup): Promise<GrantRecord | null> {
      const cached = hits.get(key);
      if (cached && now() - cached.at < ttlMs) return cached.grant;
      const fresh = await lookup();
      if (fresh) hits.set(key, { at: now(), grant: fresh });
      else hits.delete(key);
      return fresh;
    },
  };
}
