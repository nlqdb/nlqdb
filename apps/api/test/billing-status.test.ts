// Unit tests for the billing-status resolver (SK-STRIPE-009). Pure — no I/O.

import { describe, expect, it } from "vitest";
import {
  blocksNewCheckout,
  type CustomerRow,
  resolveBillingStatus,
} from "../src/stripe/billing-status.ts";

const HOBBY = "price_hobby_123";
const PRO = "price_pro_456";

function row(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    status: overrides.status ?? "active",
    price_id: overrides.price_id !== undefined ? overrides.price_id : HOBBY,
    current_period_end:
      overrides.current_period_end !== undefined ? overrides.current_period_end : 1_800_000_000,
    cancel_at_period_end: overrides.cancel_at_period_end ?? 0,
  };
}

describe("resolveBillingStatus", () => {
  it("reports a free, non-manageable user when there is no customers row", () => {
    expect(resolveBillingStatus(null, HOBBY, PRO)).toEqual({
      plan: "free",
      status: "none",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      manageable: false,
    });
  });

  it("maps the Hobby price ID to the hobby plan", () => {
    const result = resolveBillingStatus(row({ price_id: HOBBY }), HOBBY, PRO);
    expect(result.plan).toBe("hobby");
    expect(result.manageable).toBe(true);
  });

  it("maps the Pro price ID to the pro plan", () => {
    expect(resolveBillingStatus(row({ price_id: PRO }), HOBBY, PRO).plan).toBe("pro");
  });

  it("returns 'unknown' for an unrecognized price ID", () => {
    expect(resolveBillingStatus(row({ price_id: "price_other" }), HOBBY, PRO).plan).toBe("unknown");
  });

  it("returns 'unknown' when the row has no price yet (incomplete checkout)", () => {
    const result = resolveBillingStatus(row({ price_id: null, status: "incomplete" }), HOBBY, PRO);
    expect(result.plan).toBe("unknown");
    expect(result.status).toBe("incomplete");
    expect(result.manageable).toBe(true);
  });

  it("returns 'unknown' when the env price IDs are not configured", () => {
    expect(resolveBillingStatus(row({ price_id: HOBBY }), undefined, undefined).plan).toBe(
      "unknown",
    );
  });

  it("passes the subscription status through verbatim", () => {
    expect(resolveBillingStatus(row({ status: "past_due" }), HOBBY, PRO).status).toBe("past_due");
  });

  it("normalizes cancel_at_period_end from 0/1 to boolean", () => {
    expect(
      resolveBillingStatus(row({ cancel_at_period_end: 1 }), HOBBY, PRO).cancelAtPeriodEnd,
    ).toBe(true);
    expect(
      resolveBillingStatus(row({ cancel_at_period_end: 0 }), HOBBY, PRO).cancelAtPeriodEnd,
    ).toBe(false);
  });

  it("passes current_period_end through, including null", () => {
    expect(
      resolveBillingStatus(row({ current_period_end: 1_900_000_000 }), HOBBY, PRO).currentPeriodEnd,
    ).toBe(1_900_000_000);
    expect(
      resolveBillingStatus(row({ current_period_end: null }), HOBBY, PRO).currentPeriodEnd,
    ).toBeNull();
  });

  it("stays manageable for a canceled subscriber (portal still serves invoices)", () => {
    const result = resolveBillingStatus(row({ status: "canceled" }), HOBBY, PRO);
    expect(result.manageable).toBe(true);
    expect(result.status).toBe("canceled");
  });
});

describe("blocksNewCheckout", () => {
  it("allows checkout when the caller has no customers row", () => {
    expect(blocksNewCheckout(undefined)).toBe(false);
    expect(blocksNewCheckout(null)).toBe(false);
  });

  it("allows re-checkout from a terminal status", () => {
    for (const status of ["canceled", "incomplete_expired"]) {
      expect(blocksNewCheckout(status)).toBe(false);
    }
  });

  it("blocks checkout while a live subscription exists", () => {
    // `incomplete` is NOT terminal — its first invoice is payable for 23h, so
    // a second Checkout would open a parallel chargeable subscription.
    for (const status of ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]) {
      expect(blocksNewCheckout(status)).toBe(true);
    }
  });

  it("fails safe: blocks an unrecognized future status", () => {
    expect(blocksNewCheckout("some_new_stripe_status")).toBe(true);
  });
});
