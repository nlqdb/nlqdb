// Allowance-exhaustion behavior (SK-PREMIUM-011). Pure. Decides, BEFORE the LLM
// call, which lane a premium-eligible request runs on:
//
//   • included allowance remaining → premium lane, no meter
//   • exhausted, policy "meter" (default) → premium lane, bill overage
//   • exhausted, policy "fallback" (opt-in) → free chain, no charge, surfaced
//   • per-key spend cap hard-hit → free chain (absolute ceiling, any policy)
//
// The slot count of a single query is only known post-call, so a query that
// straddles the boundary (some slots included, some over) runs on the premium
// lane here and meters only its overage portion after `consumeAllowance` —
// `overflow.ts` owns the lane, `meter.ts` owns the fractional overage bill.

export type OverflowPolicy = "meter" | "fallback";

export function isOverflowPolicy(v: unknown): v is OverflowPolicy {
  return v === "meter" || v === "fallback";
}

export type PreDispatchDecision = {
  // Lane to run the query on.
  lane: "premium" | "free";
  // Why — drives the trace line and metrics.
  reason: "allowance" | "meter" | "fallback" | "cap";
};

export function resolvePreDispatchLane(args: {
  // Included allowance still available at request time (from `readAllowance`).
  remaining: number;
  policy: OverflowPolicy;
  // Per-key spend cap already at/over 100% for this period (SK-PREMIUM-006).
  capExceeded: boolean;
}): PreDispatchDecision {
  // Cap is the absolute ceiling regardless of allowance or policy — a request
  // over the cap falls through to the strict-$0 chain (SK-PREMIUM-006).
  if (args.capExceeded) return { lane: "free", reason: "cap" };
  if (args.remaining > 0) return { lane: "premium", reason: "allowance" };
  // Allowance exhausted — the per-account policy decides.
  if (args.policy === "fallback") return { lane: "free", reason: "fallback" };
  return { lane: "premium", reason: "meter" };
}
