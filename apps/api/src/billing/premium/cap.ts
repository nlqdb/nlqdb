// Per-key overage spend cap (SK-PREMIUM-006). Pure. The cap applies to OVERAGE
// spend after the included allowance is exhausted — included-allowance requests
// are free at the meter and never tick it (SK-PREMIUM-009 amendment in
// SK-PREMIUM-006). Soft warn at 80% (email — deferred, gap-noted), hard
// fall-through to the strict-$0 chain at 100%.
//
// v1 tracks overage spend at the (customer, period) grain in
// `premium_allowance_period.overage_spent_cents`; the per-(DB, key) grain from
// SK-PREMIUM-001/006 and the user-adjustable stored cap + dashboard UI are a
// tracked GLOBAL-003 gap (premium-tier FEATURE.md) — the default cap constant
// applies until then.

import { CAP_WARN_FRACTION, DEFAULT_CAP_USD_CENTS } from "./limits.ts";

export type CapVerdict = {
  // True when spending one more cent would exceed the cap — the router falls
  // through to the free chain (SK-PREMIUM-006 hard cap).
  exceeded: boolean;
  // True at ≥80% — the soft warn threshold (email deferred).
  warn: boolean;
  spentCents: number;
  capCents: number;
};

export function evaluateCap(spentCents: number, capCents = DEFAULT_CAP_USD_CENTS): CapVerdict {
  return {
    exceeded: spentCents >= capCents,
    warn: spentCents >= capCents * CAP_WARN_FRACTION,
    spentCents,
    capCents,
  };
}
