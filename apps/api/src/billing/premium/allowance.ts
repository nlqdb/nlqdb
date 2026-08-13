// Included-allowance accounting (SK-PREMIUM-009). The period row is keyed by
// (customer_id, period_start) where `period_start` is the current billing-
// period boundary (`customers.current_period_end`): when Stripe advances that
// boundary on renewal, the next dispatch creates a fresh zero-consumed row —
// that IS the no-carryover monthly reset (SK-PREMIUM-009), no sweep needed.
//
// The decrement is atomic. `SK-PREMIUM-006` requires that concurrent requests
// can't double-spend the last slot, so we never read-then-write: a single
// `UPDATE ... RETURNING` inside a `db.batch()` (D1's implicit transaction)
// increments and returns the post-increment total in one atomic step. The
// caller derives overage from (consumedBefore, consumedAfter, total).
//
// Decrement happens ONLY on a successful upstream dispatch (SK-PREMIUM-006):
// the caller calls this after the LLM router returned usage, so a failed or
// refused call consumes nothing.

import { premiumAllowanceConsumed, premiumAllowanceRemaining } from "@nlqdb/otel";
import type { PremiumTier } from "./limits.ts";
import { INCLUDED_ALLOWANCE } from "./limits.ts";

export type ConsumeArgs = {
  customerId: string;
  // Current billing-period boundary (`customers.current_period_end`).
  periodStart: number;
  tier: PremiumTier;
  // Allowance slots this query consumes (soft-cap slot math, ≥ 1).
  slots: number;
};

export type ConsumeResult = {
  consumedBefore: number;
  consumedAfter: number;
  total: number;
  // Slots of THIS query that fell past the included allowance and therefore
  // meter as overage. 0 when the whole query fit inside the allowance.
  overageSlots: number;
};

export async function consumeAllowance(db: D1Database, args: ConsumeArgs): Promise<ConsumeResult> {
  const total = INCLUDED_ALLOWANCE[args.tier];
  // 1. Ensure the period row exists (idempotent — first dispatch of the period
  //    creates it at consumed=0). 2. Atomically add this query's slots and
  //    return the new consumed count. Batched → one D1 transaction, so two
  //    concurrent dispatches serialize and neither double-spends.
  const ensure = db
    .prepare(
      "INSERT INTO premium_allowance_period " +
        "(customer_id, period_start, plan_tier, allowance_total_requests, allowance_consumed_requests, overage_spent_cents, updated_at) " +
        "VALUES (?, ?, ?, ?, 0, 0, unixepoch()) " +
        "ON CONFLICT(customer_id, period_start) DO NOTHING",
    )
    .bind(args.customerId, args.periodStart, args.tier, total);
  const bump = db
    .prepare(
      "UPDATE premium_allowance_period " +
        "SET allowance_consumed_requests = allowance_consumed_requests + ?, updated_at = unixepoch() " +
        "WHERE customer_id = ? AND period_start = ? " +
        "RETURNING allowance_consumed_requests AS consumed, allowance_total_requests AS total",
    )
    .bind(args.slots, args.customerId, args.periodStart);

  const results = await db.batch<{ consumed: number; total: number }>([ensure, bump]);
  const row = results[1]?.results?.[0];
  const consumedAfter = row?.consumed ?? args.slots;
  const rowTotal = row?.total ?? total;
  const consumedBefore = consumedAfter - args.slots;
  const overageSlots =
    Math.max(0, consumedAfter - rowTotal) - Math.max(0, consumedBefore - rowTotal);

  const remaining = Math.max(0, rowTotal - consumedAfter);
  premiumAllowanceConsumed().record(consumedAfter, { customer_id: args.customerId });
  premiumAllowanceRemaining().record(remaining, { customer_id: args.customerId });

  return { consumedBefore, consumedAfter, total: rowTotal, overageSlots };
}

// Read remaining allowance without consuming — for the chat CTA's "your next
// query will [meter / fall back]" boundary hint (SK-PREMIUM-011). Best-effort:
// a cold period (no row yet) means the full allowance remains.
export async function readAllowance(
  db: D1Database,
  customerId: string,
  periodStart: number,
  tier: PremiumTier,
): Promise<{ consumed: number; total: number; remaining: number }> {
  const total = INCLUDED_ALLOWANCE[tier];
  const row = await db
    .prepare(
      "SELECT allowance_consumed_requests AS consumed FROM premium_allowance_period WHERE customer_id = ? AND period_start = ?",
    )
    .bind(customerId, periodStart)
    .first<{ consumed: number }>();
  const consumed = row?.consumed ?? 0;
  return { consumed, total, remaining: Math.max(0, total - consumed) };
}
