// Unit tests for the `/v1/billing/usage` projection (SK-PREMIUM-009). D1 is
// stubbed at the prepared-statement level, routing on the SQL prefix — the
// same convention as `db-connect/connect.test.ts`. Three shapes matter: a
// free/no-row caller (zero shape, no premium reads), a paid caller inside the
// allowance (period math from the allowance row), and a paid caller with
// overage meter events recorded.

import { describe, expect, it } from "vitest";
import { resolveBillingUsage } from "./usage.ts";

const PRICE_HOBBY = "price_hobby";
const PRICE_PRO = "price_pro";

type CustomerRow = {
  status: string;
  price_id: string | null;
  current_period_end: number | null;
  cancel_at_period_end: number;
};

// D1 stub: `customer` seeds the `customers` row (null = no row), `consumed`
// seeds the allowance row's consumed count (undefined = no period row yet),
// `overageCount` seeds the meter-event COUNT(*).
function stubD1(opts: {
  customer: CustomerRow | null;
  consumed?: number;
  overageCount?: number;
}): D1Database {
  const prepare = (sql: string) => ({
    bind: (..._params: unknown[]) => ({
      first: async () => {
        if (sql.startsWith("SELECT status")) return opts.customer;
        if (sql.startsWith("SELECT allowance_consumed_requests")) {
          return opts.consumed === undefined ? null : { consumed: opts.consumed };
        }
        if (sql.startsWith("SELECT COUNT(*)")) return { n: opts.overageCount ?? 0 };
        throw new Error(`unexpected SQL: ${sql}`);
      },
    }),
  });
  return { prepare } as unknown as D1Database;
}

describe("resolveBillingUsage", () => {
  it("returns the zero shape for a free caller with no customers row", async () => {
    const db = stubD1({ customer: null });
    const usage = await resolveBillingUsage(db, "user_1", PRICE_HOBBY, PRICE_PRO);
    expect(usage).toEqual({
      plan: "free",
      periodStart: null,
      included: 0,
      consumed: 0,
      overage: 0,
    });
  });

  it("returns the zero shape (unknown plan) when the row has no period yet", async () => {
    // `incomplete` between checkout and subscription.created: no price, no
    // period boundary — must not touch the premium tables.
    const db = stubD1({
      customer: { status: "incomplete", price_id: null, current_period_end: null, cancel_at_period_end: 0 },
    });
    const usage = await resolveBillingUsage(db, "user_2", PRICE_HOBBY, PRICE_PRO);
    expect(usage.plan).toBe("unknown");
    expect(usage.periodStart).toBeNull();
    expect(usage.included).toBe(0);
    expect(usage.consumed).toBe(0);
    expect(usage.overage).toBe(0);
  });

  it("projects the hobby allowance for a paid caller inside the allowance", async () => {
    const db = stubD1({
      customer: {
        status: "active",
        price_id: PRICE_HOBBY,
        current_period_end: 1_800_000_000,
        cancel_at_period_end: 0,
      },
      consumed: 42,
      overageCount: 0,
    });
    const usage = await resolveBillingUsage(db, "user_3", PRICE_HOBBY, PRICE_PRO);
    expect(usage).toEqual({
      plan: "hobby",
      periodStart: 1_800_000_000,
      included: 200,
      consumed: 42,
      overage: 0,
    });
  });

  it("counts a cold period (no allowance row yet) as zero consumed", async () => {
    const db = stubD1({
      customer: {
        status: "active",
        price_id: PRICE_PRO,
        current_period_end: 1_800_000_000,
        cancel_at_period_end: 0,
      },
      consumed: undefined,
    });
    const usage = await resolveBillingUsage(db, "user_4", PRICE_HOBBY, PRICE_PRO);
    expect(usage.plan).toBe("pro");
    expect(usage.included).toBe(600);
    expect(usage.consumed).toBe(0);
    expect(usage.overage).toBe(0);
  });

  it("surfaces overage meter-event count for a paid caller past the allowance", async () => {
    const db = stubD1({
      customer: {
        status: "active",
        price_id: PRICE_PRO,
        current_period_end: 1_800_000_000,
        cancel_at_period_end: 0,
      },
      consumed: 615,
      overageCount: 15,
    });
    const usage = await resolveBillingUsage(db, "user_5", PRICE_HOBBY, PRICE_PRO);
    expect(usage).toEqual({
      plan: "pro",
      periodStart: 1_800_000_000,
      included: 600,
      consumed: 615,
      overage: 15,
    });
  });
});
