// Hosted-premium numeric constants — the ONE place tier allowances and
// guardrail thresholds live (SK-PREMIUM-009 / SK-PREMIUM-010). Every move here
// is PR-reviewed with a CHANGELOG entry, same discipline as the rate table in
// `@nlqdb/llm`'s `pricing.ts` (SK-PREMIUM-002 precedent). Kept inline-free: no
// magic numbers scattered across the dispatch path.

export type PremiumTier = "hobby" | "pro";

// Included monthly premium-request allowance per tier (SK-PREMIUM-009). Unit is
// **requests**, not tokens or dollars, so the number doesn't churn as provider
// prices move (GLOBAL-026).
//
// CALIBRATE-BY 2026-08-15 (SK-PREMIUM-010): these are seed targets, not
// measured. Recalibrate against the `nlqdb.premium.cost_per_query_usd` p50 once
// ≥6 weeks of hosted-premium traffic exists, holding the inequality
//   p50_cost_per_query × allowance ≤ tier_price × (1 − target_gross_margin)
// with target_gross_margin ≥ 0.60. At the $10 / $25 tier prices, that caps the
// break-even p50 at:
//   Hobby: 1000¢ × 0.40 / 200 = 2.00¢/query
//   Pro:   2500¢ × 0.40 / 600 = 1.67¢/query
// If the measured p50 runs above those, cut the allowance (or the soft cap) —
// don't silently erode the margin.
export const INCLUDED_ALLOWANCE: Record<PremiumTier, number> = {
  hobby: 200,
  pro: 600,
};

// Per-query soft cap (SK-PREMIUM-010 (1)): a query whose billable tokens exceed
// this consumes ceil(tokens / soft_cap) allowance slots rather than one, so one
// monster query can't be sold as "one request". ~50k tokens is the seed;
// tbd-by-2026-08-15 against the token-per-query histogram.
export const SOFT_CAP_TOKENS = 50_000;

// Per-query hard ceiling (SK-PREMIUM-010 (2)): above this the request is refused
// with a one-sentence error (GLOBAL-012), bounding the worst-case per-call cost.
export const HARD_CEILING_TOKENS = 500_000;

// Default per-(DB, key) monthly OVERAGE spend cap (SK-PREMIUM-006), in USD
// cents. This is NOT a tier price — it's the ceiling on metered overage spend
// after the included allowance is exhausted; included-allowance requests never
// tick it. $10/key/mo default; user-adjustable; soft warn at 80%, hard
// fall-through to the free chain at 100%.
export const DEFAULT_CAP_USD_CENTS = 1000;
export const CAP_WARN_FRACTION = 0.8;

// The `PREMIUM_METER_LIVE` gate is an EXPLICIT truthy flag, not "any non-empty
// string" — otherwise `PREMIUM_METER_LIVE=false` (or `no`/`0`) would light the
// meter, the opposite of the operator's intent. Enable only on `"1"` or
// `"true"` (case-insensitive). `"true"` (4 chars) stays valid so the ≥4-char
// secret-mirror can carry it.
export function meterLive(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true";
}

// Map a Stripe-derived billing plan to a premium tier, or null for a plan with
// no hosted-premium allowance (free / unknown). The `customers.price_id` →
// plan resolution already lives in stripe/billing-status.ts; this only adds the
// tier→allowance bridge.
export function tierForPlan(plan: string): PremiumTier | null {
  return plan === "hobby" || plan === "pro" ? plan : null;
}
