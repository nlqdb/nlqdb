// Overage metering (SK-PREMIUM-002, superseding the Lago plan → SK-PREMIUM-017).
// Two writes per overage query, both AFTER the response has shipped (never
// blocking — the caller runs this in `ctx.waitUntil`):
//
//   1. Internal ledger: an idempotent row in `premium_meter_events` keyed by a
//      deterministic event id, plus a running `overage_spent_cents` bump on the
//      allowance-period row. This is the source of truth the daily
//      reconciliation compares against Stripe (SK-PREMIUM-017), and it's what
//      makes the report safe to retry — a duplicate id no-ops.
//   2. Stripe Billing Meter event (`billing.meterEvents.create`) with the same
//      id as its Stripe-side `identifier`, so Stripe dedups too. Fires ONLY
//      when `PREMIUM_METER_LIVE` is set (human-only) — dark otherwise.
//
// Cache tokens are already priced correctly upstream (`premiumQueryCostUsdCents`
// bills reads at the cache-read rate, writes at the write rate — never as full
// input, SK-PREMIUM-002 #7). This module only moves the resulting cents.

import { PREMIUM_MODEL, PREMIUM_PROVIDER } from "@nlqdb/llm";
import type Stripe from "stripe";
import { newStripeClient } from "../../stripe/client.ts";

// The metered overage subscription-item name (SK-PREMIUM-002 / #8): one per
// (provider, model). Also the Stripe Billing Meter `event_name` the events
// reference. Attached lazily on first overage.
export function overageMeterName(model: string = PREMIUM_MODEL): string {
  return `nlqdb.premium_llm.overage.${PREMIUM_PROVIDER}.${model}`;
}

// Deterministic, idempotent event id. Scoped to the customer + the request's
// idempotency key (or a caller-supplied stable request id) so a retried
// `/v1/ask` never double-bills (SK-PREMIUM-002 / GLOBAL-005). Used as BOTH the
// ledger PK and the Stripe `identifier`.
export function meterEventId(customerId: string, requestKey: string): string {
  return `premium:${customerId}:${requestKey}`;
}

export type OverageEvent = {
  eventId: string;
  customerId: string;
  periodStart: number;
  model: string;
  costCents: number;
  stripeCustomerId: string;
};

// Write the internal ledger row + bump the period's overage spend. Idempotent:
// the `INSERT ... ON CONFLICT DO NOTHING RETURNING` gates the spend bump so a
// retry with the same event id neither double-inserts nor double-counts spend
// (SK-STRIPE-002 pattern). Returns whether this was the first insert (i.e.
// whether the Stripe report should follow — dispatch-after-insert).
export async function recordOverageLedger(
  db: D1Database,
  ev: OverageEvent,
): Promise<{ firstInsert: boolean }> {
  const inserted = await db
    .prepare(
      "INSERT INTO premium_meter_events (event_id, customer_id, period_start, model, cost_cents, reported_at, stripe_status) " +
        "VALUES (?, ?, ?, ?, ?, unixepoch(), 'pending') " +
        "ON CONFLICT(event_id) DO NOTHING RETURNING 1 AS ok",
    )
    .bind(ev.eventId, ev.customerId, ev.periodStart, ev.model, ev.costCents)
    .first<{ ok: number }>();
  if (inserted === null) return { firstInsert: false };
  await db
    .prepare(
      "UPDATE premium_allowance_period SET overage_spent_cents = overage_spent_cents + ?, updated_at = unixepoch() " +
        "WHERE customer_id = ? AND period_start = ?",
    )
    .bind(ev.costCents, ev.customerId, ev.periodStart)
    .run();
  return { firstInsert: true };
}

// Report the overage to Stripe as a Billing Meter event. **Dark unless
// `PREMIUM_METER_LIVE` is truthy.** Best-effort: on any Stripe error we mark
// the ledger row `error` and log — the row stays as the queryable signal for
// the reconciliation job, never re-billing on its own. The Stripe `identifier`
// equals the ledger id, so a manual replay is also idempotent Stripe-side.
export async function reportMeterEvent(
  env: { STRIPE_SECRET_KEY?: string; PREMIUM_METER_LIVE?: string },
  db: D1Database,
  ev: OverageEvent,
): Promise<{ reported: boolean; reason?: string }> {
  if (!env.PREMIUM_METER_LIVE) return { reported: false, reason: "meter_dark" };
  if (!env.STRIPE_SECRET_KEY) return { reported: false, reason: "stripe_unconfigured" };
  const stripe = newStripeClient(env.STRIPE_SECRET_KEY);
  try {
    await stripe.billing.meterEvents.create({
      event_name: overageMeterName(ev.model),
      identifier: ev.eventId,
      payload: {
        stripe_customer_id: ev.stripeCustomerId,
        // Meter value in USD cents; the human-configured overage Price sets
        // 1 unit = $0.01 so the sum invoices at exact provider list (0% markup).
        value: String(Math.round(ev.costCents)),
      },
    });
    await db
      .prepare("UPDATE premium_meter_events SET stripe_status = 'reported' WHERE event_id = ?")
      .bind(ev.eventId)
      .run();
    return { reported: true };
  } catch (err) {
    await db
      .prepare("UPDATE premium_meter_events SET stripe_status = 'error' WHERE event_id = ?")
      .bind(ev.eventId)
      .run()
      .catch(() => {});
    console.error(
      JSON.stringify({
        level: "error",
        msg: "premium_meter_report_failed",
        event_id: ev.eventId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { reported: false, reason: "stripe_error" };
  }
}

// Lazily attach the metered overage subscription item on first overage
// (SK-PREMIUM-002 / #8). Idempotent: skip when the subscription already carries
// an item on the overage price. Dark unless live + priced. Returns the item id
// or null (not attached — dark, unconfigured, or already present is not an
// error). The overage Price is created by the checked-in bootstrap script.
export async function ensureOverageItem(
  stripe: Stripe,
  args: { subscriptionId: string; overagePriceId: string },
): Promise<string | null> {
  const sub = await stripe.subscriptions.retrieve(args.subscriptionId);
  const existing = sub.items.data.find((i) => i.price?.id === args.overagePriceId);
  if (existing) return existing.id;
  const item = await stripe.subscriptionItems.create({
    subscription: args.subscriptionId,
    price: args.overagePriceId,
  });
  return item.id;
}
