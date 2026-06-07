// Billing-status resolver. Pure — no I/O, no Stripe call; the route owns
// the single-row D1 read and passes the row (or null) in. The /pricing
// page reads the result to badge the caller's real tier and offer the
// Stripe Billing Portal only to actual subscribers (SK-STRIPE-009).

export type BillingPlan = "free" | "hobby" | "pro" | "unknown";

// The subset of the `customers` row the status read needs.
export type CustomerRow = {
  status: string;
  price_id: string | null;
  current_period_end: number | null;
  cancel_at_period_end: number;
};

export type BillingStatus = {
  plan: BillingPlan;
  // The Stripe subscription status verbatim, or "none" when the caller
  // has no `customers` row (never reached checkout).
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  // Whether to offer the Billing Portal. True iff a row exists — any row
  // carries a stripe_customer_id the portal needs, including a canceled
  // one (they may still want invoices or to re-subscribe).
  manageable: boolean;
};

export function resolveBillingStatus(
  row: CustomerRow | null,
  priceIdHobby: string | undefined,
  priceIdPro: string | undefined,
): BillingStatus {
  if (!row) {
    return {
      plan: "free",
      status: "none",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      manageable: false,
    };
  }
  return {
    plan: resolvePlan(row.price_id, priceIdHobby, priceIdPro),
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end === 1,
    manageable: true,
  };
}

// Statuses where the prior subscription is terminal, so a fresh Checkout is
// the right path (re-subscribe). Any OTHER status means a live subscription
// still exists and tier changes must go through the Billing Portal (Stripe
// prorates) — a second `mode: 'subscription'` Checkout would create a
// parallel subscription and double-bill (SK-STRIPE-010).
export const CHECKOUT_REOPEN_STATUSES = new Set(["canceled", "incomplete", "incomplete_expired"]);

// True when an existing `customers.status` must block a new Checkout. Reads
// fail-safe: a missing row (never subscribed) allows checkout, and any
// non-terminal — including an unrecognized future Stripe status — blocks it,
// so a duplicate subscription can never slip through.
export function blocksNewCheckout(status: string | null | undefined): boolean {
  return status != null && !CHECKOUT_REOPEN_STATUSES.has(status);
}

// Maps a Stripe price ID back to a tier name. "unknown" when the row has
// no price yet (status `incomplete` between checkout and
// subscription.created) or the env price IDs are unset/unrecognized — the
// page treats "unknown" as "don't badge a tier" rather than guessing.
function resolvePlan(
  priceId: string | null,
  priceIdHobby: string | undefined,
  priceIdPro: string | undefined,
): BillingPlan {
  if (!priceId) return "unknown";
  if (priceIdHobby && priceId === priceIdHobby) return "hobby";
  if (priceIdPro && priceId === priceIdPro) return "pro";
  return "unknown";
}
