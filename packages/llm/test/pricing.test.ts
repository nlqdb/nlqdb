// Hosted-premium pricing (SK-PREMIUM-002) + usage extraction (SK-PREMIUM-002 #7).
import { describe, expect, it } from "vitest";
import {
  isPremiumModelPriced,
  PREMIUM_MODEL,
  type PremiumUsage,
  premiumQueryCostUsdCents,
  totalBillableTokens,
} from "../src/pricing.ts";
import { parseChatUsage } from "../src/providers/openai-compatible.ts";

describe("premiumQueryCostUsdCents", () => {
  it("bills each token class at its own rate for claude-sonnet-4-6", () => {
    const usage: PremiumUsage = {
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 200,
      cacheWriteTokens: 100,
    };
    // (1000*300 + 500*1500 + 100*375 + 200*30) / 1e6 cents
    expect(premiumQueryCostUsdCents(PREMIUM_MODEL, usage)).toBeCloseTo(1.0935, 6);
  });

  it("bills cache reads at the cache-read rate, NEVER as full input (SK-PREMIUM-002 #7)", () => {
    const cacheReadOnly: PremiumUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1000,
      cacheWriteTokens: 0,
    };
    // 1000 * 30 / 1e6 = 0.03¢ (cache-read), not 1000 * 300 / 1e6 = 0.3¢ (input).
    expect(premiumQueryCostUsdCents(PREMIUM_MODEL, cacheReadOnly)).toBeCloseTo(0.03, 6);
  });

  it("returns 0 for an unmetered model (guard — the caller must never dispatch it on premium)", () => {
    expect(
      premiumQueryCostUsdCents("gpt-5", {
        inputTokens: 1e6,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(0);
    expect(isPremiumModelPriced("gpt-5")).toBe(false);
    expect(isPremiumModelPriced(PREMIUM_MODEL)).toBe(true);
  });
});

describe("totalBillableTokens", () => {
  it("sums all four classes", () => {
    expect(
      totalBillableTokens({
        inputTokens: 1,
        outputTokens: 2,
        cacheReadTokens: 3,
        cacheWriteTokens: 4,
      }),
    ).toBe(10);
  });
});

describe("parseChatUsage", () => {
  it("subtracts cache reads from prompt tokens so input is the non-cached remainder", () => {
    expect(
      parseChatUsage({
        prompt_tokens: 1000,
        completion_tokens: 500,
        prompt_tokens_details: { cached_tokens: 200 },
        cache_creation_input_tokens: 100,
      }),
    ).toEqual({ inputTokens: 800, outputTokens: 500, cacheReadTokens: 200, cacheWriteTokens: 100 });
  });

  it("clamps input to 0 when cached_tokens exceeds prompt_tokens", () => {
    const u = parseChatUsage({ prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 500 } });
    expect(u.inputTokens).toBe(0);
    expect(u.cacheReadTokens).toBe(500);
  });

  it("defaults every class to 0 on missing/garbage usage", () => {
    expect(parseChatUsage(undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(
      parseChatUsage({ prompt_tokens: -5, completion_tokens: "x" as unknown }).inputTokens,
    ).toBe(0);
  });
});
