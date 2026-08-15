// Daily premium-meter reconciliation (SK-PREMIUM-017). Runs from the daily cron
// (`scheduled()`). Two layers:
//
//   • Always-on (no Stripe needed): sum the ledger rows in the window still
//     stuck at `pending`/`error` — overage we recorded but never confirmed to
//     Stripe. That total is the operator's drift signal and is recorded on
//     `nlqdb.premium.meter_reconcile_drift_usd_cents` every run.
//   • When live + configured: additionally cross-check each active customer's
//     internal `reported` total against Stripe's meter-event summary for the
//     window, logging any per-customer discrepancy (a double-report shows up
//     here as a negative delta).
//
// Dark by default: with `PREMIUM_METER_LIVE` unset the Stripe cross-check is
// skipped and only the (cheap, D1-only) stuck-row layer runs. Best-effort — a
// Stripe read failure logs and returns rather than throwing (a cron failure
// would page for a read-only comparison).

import { premiumMeterReconcileDriftUsdCents } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { newStripeClient } from "../../stripe/client.ts";
import { meterLive } from "./limits.ts";

// Both sides sum the same sub-cent-quantized values, so a healthy drift is only
// float-summation noise; anything above this (1e-6 ¢) is a real dropped/double
// report. Well below any single event's cost, well above accumulated float error.
export const DRIFT_EPSILON_CENTS = 1e-6;

// Pure: drift = internal reported total − Stripe reported total, in USD cents.
// Positive → we recorded overage Stripe hasn't billed; negative → Stripe billed
// more than our ledger (a double-report). Within ±DRIFT_EPSILON_CENTS is health.
export function computeDrift(internalCents: number, stripeCents: number): number {
  return internalCents - stripeCents;
}

export type ReconcileResult = {
  ran: boolean;
  reason?: string;
  // Ledger rows in the window not confirmed to Stripe (pending + error), in
  // cents. Always computed.
  stuckCents: number;
  // Per-customer Stripe cross-check when it ran (else undefined).
  crossChecked?: number;
};

export async function reconcilePremiumMeter(
  env: {
    STRIPE_SECRET_KEY?: string;
    PREMIUM_METER_LIVE?: string;
    STRIPE_PREMIUM_METER_ID?: string;
  },
  db: D1Database,
  windowStart: number,
  windowEnd: number,
): Promise<ReconcileResult> {
  // Stripe's meter-summary endpoint rejects timestamps that aren't aligned to
  // minute boundaries; floor both edges once so the D1 sums and the Stripe
  // read cover the identical window.
  windowStart = Math.floor(windowStart / 60) * 60;
  windowEnd = Math.floor(windowEnd / 60) * 60;

  // Layer 1 — stuck rows (unreported / errored). Pure D1; always runs.
  const stuckRow = await db
    .prepare(
      "SELECT COALESCE(SUM(cost_cents), 0) AS total FROM premium_meter_events " +
        "WHERE stripe_status IN ('pending','error') AND reported_at >= ? AND reported_at < ?",
    )
    .bind(windowStart, windowEnd)
    .first<{ total: number }>();
  const stuckCents = stuckRow?.total ?? 0;
  premiumMeterReconcileDriftUsdCents().record(stuckCents);
  if (stuckCents > 0) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "premium_meter_stuck_rows", stuck_cents: stuckCents }),
    );
  }

  // Layer 2 — Stripe cross-check. Only when live + configured.
  if (!meterLive(env.PREMIUM_METER_LIVE)) return { ran: false, reason: "meter_dark", stuckCents };
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PREMIUM_METER_ID) {
    return { ran: false, reason: "stripe_unconfigured", stuckCents };
  }

  // GLOBAL-014 — the Stripe reads are external calls; span the cross-check.
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.billing.premium.reconcile", async (span) => {
    try {
      const stripe = newStripeClient(env.STRIPE_SECRET_KEY as string);
      // Distinct customers with a reported row in the window — Stripe summaries
      // are per-customer, so we compare each one's internal reported total.
      const active = await db
        .prepare(
          "SELECT customer_id, COALESCE(SUM(cost_cents),0) AS total FROM premium_meter_events " +
            "WHERE stripe_status = 'reported' AND reported_at >= ? AND reported_at < ? GROUP BY customer_id",
        )
        .bind(windowStart, windowEnd)
        .all<{ customer_id: string; total: number }>();

      let crossChecked = 0;
      for (const row of active.results ?? []) {
        const stripeCustomerId = await stripeCustomerFor(db, row.customer_id);
        if (!stripeCustomerId) continue;
        const summaries = await stripe.billing.meters.listEventSummaries(
          env.STRIPE_PREMIUM_METER_ID as string,
          { customer: stripeCustomerId, start_time: windowStart, end_time: windowEnd },
        );
        let stripeCents = 0;
        for (const s of summaries.data) stripeCents += s.aggregated_value;
        const drift = computeDrift(row.total, stripeCents);
        crossChecked += 1;
        if (Math.abs(drift) > DRIFT_EPSILON_CENTS) {
          console.warn(
            JSON.stringify({
              level: "warn",
              msg: "premium_meter_reconcile_drift",
              customer_id: row.customer_id,
              internal_cents: row.total,
              stripe_cents: stripeCents,
              drift_cents: drift,
            }),
          );
        }
      }
      span.setAttribute("nlqdb.premium.reconcile_cross_checked", crossChecked);
      return { ran: true, stuckCents, crossChecked };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      console.error(
        JSON.stringify({
          level: "error",
          msg: "premium_reconcile_stripe_read_failed",
          error: error.message,
        }),
      );
      return { ran: false, reason: "stripe_error", stuckCents };
    } finally {
      span.end();
    }
  });
}

async function stripeCustomerFor(db: D1Database, userId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT stripe_customer_id AS id FROM customers WHERE user_id = ?")
    .bind(userId)
    .first<{ id: string }>();
  return row?.id ?? null;
}
