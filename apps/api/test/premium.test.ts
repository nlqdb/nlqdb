// Hosted-premium billing subsystem — pure-logic coverage (no worker harness).
// Covers the dormancy gate (the lane must be a provable no-op with the flag
// off), the allowance/overflow/cap/guardrail math, meter idempotency, and the
// `/v1/ask` premium routing in `resolveAskRouter`.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it } from "vitest";
import { resolveAskRouter } from "../src/ask/byollm.ts";
import {
  checkHardCeiling,
  computeDrift,
  consumeAllowance,
  evaluateCap,
  isOverflowPolicy,
  makeUsageAccumulator,
  meterEventId,
  overageMeterName,
  premiumConfigured,
  resolvePreDispatchLane,
  resolvePremiumEligibility,
  settlePremiumQuery,
  sizedBucket,
  slotsForTokens,
  tierForPlan,
} from "../src/billing/premium/index.ts";

// Minimal stateful fake D1 modelling one allowance period row — enough to drive
// `consumeAllowance`'s batched `INSERT ... ; UPDATE ... RETURNING` and the
// period-row SELECT. Proves the slot decrement + overage split without standing
// up miniflare.
function fakeD1(startConsumed: number): D1Database {
  let consumed = startConsumed;
  const stmt = (sql: string) => {
    let args: unknown[] = [];
    return {
      bind(...a: unknown[]) {
        args = a;
        return this;
      },
      async first() {
        if (sql.includes("allowance_consumed_requests AS consumed")) return { consumed };
        return null;
      },
      async run() {
        return {};
      },
      _sql: sql,
      get _args() {
        return args;
      },
    };
  };
  return {
    prepare: (sql: string) => stmt(sql),
    async batch(stmts: ReturnType<typeof stmt>[]) {
      const bump = stmts[1];
      if (!bump) throw new Error("expected a bump statement");
      consumed += Number(bump._args[0]);
      return [{}, { results: [{ consumed, total: 200 }] }];
    },
  } as unknown as D1Database;
}

const SMALL_USAGE = {
  inputTokens: 1000,
  outputTokens: 500,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

const FREE = { __free: true } as unknown as LLMRouter;
const PREMIUM = { __premium: true } as unknown as LLMRouter;

const LIVE_ENV = {
  PREMIUM_METER_LIVE: "1",
  PREMIUM_ANTHROPIC_API_KEY: "sk-ant-real",
  AI_GATEWAY_ACCOUNT_ID: "acct",
  AI_GATEWAY_ID: "gw",
};

describe("dormancy gate (premiumConfigured)", () => {
  it("is dark with no env set — the wired-but-dark invariant", () => {
    expect(premiumConfigured({})).toBe(false);
  });
  it("stays dark until ALL of flag + key + gateway are present", () => {
    expect(premiumConfigured({ PREMIUM_METER_LIVE: "1" })).toBe(false);
    expect(premiumConfigured({ PREMIUM_METER_LIVE: "1", PREMIUM_ANTHROPIC_API_KEY: "k" })).toBe(
      false,
    );
    expect(premiumConfigured({ ...LIVE_ENV, PREMIUM_ANTHROPIC_API_KEY: "   " })).toBe(false);
    expect(premiumConfigured(LIVE_ENV)).toBe(true);
  });
});

describe("resolvePremiumEligibility", () => {
  it("is never eligible while dark, even for a paid user", () => {
    expect(
      resolvePremiumEligibility({ env: {}, plan: "pro", currentPeriodEnd: 1000 }).eligible,
    ).toBe(false);
  });
  it("is never eligible on free/unknown plans or without a period boundary", () => {
    expect(
      resolvePremiumEligibility({ env: LIVE_ENV, plan: "free", currentPeriodEnd: 1000 }).eligible,
    ).toBe(false);
    expect(
      resolvePremiumEligibility({ env: LIVE_ENV, plan: "hobby", currentPeriodEnd: null }).eligible,
    ).toBe(false);
  });
  it("is eligible for a paid user on a live deployment", () => {
    const e = resolvePremiumEligibility({ env: LIVE_ENV, plan: "hobby", currentPeriodEnd: 1234 });
    expect(e).toEqual({ eligible: true, tier: "hobby", periodStart: 1234 });
  });
});

describe("tierForPlan", () => {
  it("maps paid plans, rejects the rest", () => {
    expect(tierForPlan("hobby")).toBe("hobby");
    expect(tierForPlan("pro")).toBe("pro");
    expect(tierForPlan("free")).toBeNull();
    expect(tierForPlan("unknown")).toBeNull();
  });
});

describe("guardrails", () => {
  it("charges one slot at/under the soft cap and ceil(tokens/50k) above it", () => {
    expect(slotsForTokens(0)).toBe(1);
    expect(slotsForTokens(50_000)).toBe(1);
    expect(slotsForTokens(50_001)).toBe(2);
    expect(slotsForTokens(120_000)).toBe(3);
  });
  it("refuses above the hard ceiling with a one-sentence GLOBAL-012 message", () => {
    expect(checkHardCeiling(500_000).ok).toBe(true);
    const refused = checkHardCeiling(500_001);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.maxTokens).toBe(500_000);
      expect(refused.message).toMatch(/too large/i);
    }
  });
  it("buckets sizes for the histograms", () => {
    expect(sizedBucket(1000)).toBe("standard");
    expect(sizedBucket(60_000)).toBe("large");
    expect(sizedBucket(600_000)).toBe("refused");
  });
});

describe("resolvePreDispatchLane (overflow)", () => {
  it("uses the premium lane while allowance remains", () => {
    expect(resolvePreDispatchLane({ remaining: 5, policy: "meter", capExceeded: false })).toEqual({
      lane: "premium",
      reason: "allowance",
    });
  });
  it("meters overage by default at exhaustion", () => {
    expect(resolvePreDispatchLane({ remaining: 0, policy: "meter", capExceeded: false })).toEqual({
      lane: "premium",
      reason: "meter",
    });
  });
  it("falls back to free under overflow_policy=fallback", () => {
    expect(
      resolvePreDispatchLane({ remaining: 0, policy: "fallback", capExceeded: false }),
    ).toEqual({
      lane: "free",
      reason: "fallback",
    });
  });
  it("hard-falls-through to free when the cap is hit, regardless of policy", () => {
    expect(resolvePreDispatchLane({ remaining: 100, policy: "meter", capExceeded: true })).toEqual({
      lane: "free",
      reason: "cap",
    });
  });
  it("validates the policy literal", () => {
    expect(isOverflowPolicy("meter")).toBe(true);
    expect(isOverflowPolicy("fallback")).toBe(true);
    expect(isOverflowPolicy("nope")).toBe(false);
  });
});

describe("evaluateCap", () => {
  it("warns at 80% and hard-stops at 100%", () => {
    expect(evaluateCap(700, 1000)).toMatchObject({ warn: false, exceeded: false });
    expect(evaluateCap(800, 1000)).toMatchObject({ warn: true, exceeded: false });
    expect(evaluateCap(1000, 1000)).toMatchObject({ warn: true, exceeded: true });
  });
});

describe("meter identity", () => {
  it("event id is deterministic per (customer, request-key) — idempotent retries", () => {
    expect(meterEventId("cus_1", "req_9")).toBe("premium:cus_1:req_9");
    expect(meterEventId("cus_1", "req_9")).toBe(meterEventId("cus_1", "req_9"));
  });
  it("overage meter name is per provider+model", () => {
    expect(overageMeterName()).toBe("nlqdb.premium_llm.overage.anthropic.claude-sonnet-4-6");
  });
});

describe("makeUsageAccumulator", () => {
  it("sums usage across calls so a query is metered once on its total footprint", () => {
    const acc = makeUsageAccumulator();
    acc.sink({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheWriteTokens: 0 });
    acc.sink({ inputTokens: 20, outputTokens: 8, cacheReadTokens: 0, cacheWriteTokens: 2 });
    expect(acc.total()).toEqual({
      inputTokens: 30,
      outputTokens: 13,
      cacheReadTokens: 1,
      cacheWriteTokens: 2,
    });
  });
});

describe("computeDrift (reconciliation)", () => {
  it("is internal − stripe cents", () => {
    expect(computeDrift(100, 100)).toBe(0);
    expect(computeDrift(150, 100)).toBe(50);
    expect(computeDrift(90, 100)).toBe(-10);
  });
});

describe("consumeAllowance + settlePremiumQuery (D1 math)", () => {
  it("consumes one slot inside the allowance and reports no overage", async () => {
    const r = await consumeAllowance(fakeD1(0), {
      customerId: "u1",
      periodStart: 100,
      tier: "hobby",
      slots: 1,
    });
    expect(r).toMatchObject({ consumedBefore: 0, consumedAfter: 1, total: 200, overageSlots: 0 });
  });

  it("splits overage slots for a query that crosses the allowance boundary", async () => {
    // Already at 200/200; this query's single slot is fully overage.
    const r = await consumeAllowance(fakeD1(200), {
      customerId: "u1",
      periodStart: 100,
      tier: "hobby",
      slots: 1,
    });
    expect(r).toMatchObject({ consumedAfter: 201, total: 200, overageSlots: 1 });
  });

  it("settlement trace reads 'used N of 200' inside the allowance (no overage bill)", async () => {
    const s = await settlePremiumQuery(fakeD1(0), {
      customerId: "u1",
      periodStart: 100,
      tier: "hobby",
      usage: SMALL_USAGE,
    });
    expect(s.overageCents).toBe(0);
    expect(s.traceLine).toBe("This request used 1 of your 200 included premium requests.");
  });

  it("settlement bills overage once the allowance is exhausted", async () => {
    const s = await settlePremiumQuery(fakeD1(200), {
      customerId: "u1",
      periodStart: 100,
      tier: "hobby",
      usage: SMALL_USAGE,
    });
    expect(s.overageCents).toBeGreaterThan(0);
    expect(s.traceLine).toMatch(/billed \$\d/);
  });
});

describe("resolveAskRouter premium routing", () => {
  const base = { headerCredential: null, freeRouter: FREE, gateway: {}, userId: "u1" } as const;

  it("routes to the premium router when eligible + a router was built", () => {
    const r = resolveAskRouter({ ...base, premiumEligible: true, premiumRouter: PREMIUM });
    expect(r).toMatchObject({ ok: true, router: PREMIUM });
    if (r.ok) {
      expect(r.attributes["llm.dispatch_lane"]).toBe("premium");
      expect(r.attributes["llm.billed_to"]).toBe("metered");
    }
  });

  it("serves the free router (not metered) when eligible but the query fell back", () => {
    const r = resolveAskRouter({ ...base, premiumEligible: true });
    expect(r).toMatchObject({ ok: true, router: FREE });
    if (r.ok) {
      expect(r.attributes["llm.dispatch_lane"]).toBe("free");
      expect(r.attributes["llm.billed_to"]).toBe("platform");
    }
  });

  it("does NOT 409 model_unavailable for `best` when premium is eligible", () => {
    const r = resolveAskRouter({
      ...base,
      preset: "best",
      premiumEligible: true,
      premiumRouter: PREMIUM,
    });
    expect(r.ok).toBe(true);
  });

  it("still 409s `best` with no BYOLLM key and no premium eligibility (unchanged)", () => {
    const r = resolveAskRouter({ ...base, preset: "best" });
    expect(r).toEqual({ ok: false, reason: "frontier_unavailable" });
  });
});
