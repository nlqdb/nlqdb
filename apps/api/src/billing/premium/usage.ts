// Hosted-premium usage projection for the `/app/billing` page
// (SK-PREMIUM-009 / SK-PREMIUM-011). `GET /v1/billing/usage` reads the
// caller's current-period allowance so the page can render the honest
// "N of M frontier requests this period" bar — a pure D1 read, no Stripe
// call, mirroring `GET /v1/billing/status` (SK-STRIPE-009).
//
// The period is keyed by `customers.current_period_end` (the same boundary
// `premium_allowance_period` rows are keyed on), so this projection reads
// exactly the row the dispatch path writes — no separate period math. Free
// users, unknown/incomplete plans, and users with no `customers` row resolve
// to a well-formed zero shape (plan "free", included/consumed/overage 0), so
// the page renders an empty state instead of erroring.

import { type BillingPlan, type CustomerRow, resolveBillingStatus } from "../../stripe/billing-status.ts";
import { readAllowance } from "./allowance.ts";
import { tierForPlan } from "./limits.ts";

export type BillingUsage = {
  plan: BillingPlan;
  // The current billing-period boundary the allowance row is keyed on
  // (`customers.current_period_end`); null when the caller has no paid period.
  periodStart: number | null;
  // Included monthly premium-request allowance for the plan (0 for free/unknown).
  included: number;
  // Allowance requests consumed this period (0 before the first premium dispatch).
  consumed: number;
  // Overage meter events recorded this period (0 while inside the allowance).
  overage: number;
};

const ZERO_USAGE: BillingUsage = {
  plan: "free",
  periodStart: null,
  included: 0,
  consumed: 0,
  overage: 0,
};

// Resolve the caller's current-period premium usage from D1. Pure reads:
// one `customers` row, then (paid callers only) the allowance row + a meter-
// event count for the period. Free/unknown/no-period callers short-circuit to
// the zero shape without touching the premium tables.
export async function resolveBillingUsage(
  db: D1Database,
  userId: string,
  priceIdHobby: string | undefined,
  priceIdPro: string | undefined,
): Promise<BillingUsage> {
  const row = await db
    .prepare(
      "SELECT status, price_id, current_period_end, cancel_at_period_end FROM customers WHERE user_id = ?",
    )
    .bind(userId)
    .first<CustomerRow>();

  const status = resolveBillingStatus(row, priceIdHobby, priceIdPro);
  const tier = tierForPlan(status.plan);
  // No hosted-premium allowance (free / unknown / incomplete) or no billing
  // period to key the allowance to → well-formed zero shape, still naming the
  // resolved plan so the page can branch its empty state.
  if (!tier || status.currentPeriodEnd == null) {
    return { ...ZERO_USAGE, plan: status.plan };
  }

  const periodStart = status.currentPeriodEnd;
  // `readAllowance` sources `included` from the same `INCLUDED_ALLOWANCE`
  // constant the meter charges against — no second copy of the tier numbers.
  const { consumed, total } = await readAllowance(db, userId, periodStart, tier);
  const overageRow = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM premium_meter_events WHERE customer_id = ? AND period_start = ?",
    )
    .bind(userId, periodStart)
    .first<{ n: number }>();

  return {
    plan: status.plan,
    periodStart,
    included: total,
    consumed,
    overage: overageRow?.n ?? 0,
  };
}
