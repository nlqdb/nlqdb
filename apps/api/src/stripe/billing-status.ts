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

// Stripe's two *terminal* subscription statuses — no open invoice now, none
// in future — so a fresh Checkout is the only path back (re-subscribe). Every
// other status means a live subscription still exists, including `incomplete`
// (its first invoice stays payable for 23h before it expires) and `unpaid` /
// `paused`; tier changes for those go through the Billing Portal (Stripe
// prorates), since a second `mode: 'subscription'` Checkout opens a brand-new
// Stripe customer + parallel subscription and double-bills (SK-STRIPE-010).
export const CHECKOUT_REOPEN_STATUSES = new Set(["canceled", "incomplete_expired"]);

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
