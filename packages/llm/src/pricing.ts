// Hosted-premium rate table + cost function (`SK-PREMIUM-002`). This file is
// the SINGLE source of truth for the per-model list prices the meter bills at
// **provider list + 0% markup** (`GLOBAL-026`). Every numeric move here is
// human-reviewed on the PR and needs a CHANGELOG entry + customer email
// (SK-PREMIUM-002) — no silent re-pricing.
//
// v1 ships Anthropic only, one model (`claude-sonnet-4-6`, the `SK-QUAL-009`
// baseline — deliberately not bumped so the eval's free-vs-frontier delta
// stays measured against a fixed frontier). GPT-5 / Gemini rows in the
// hosted-premium catalog stay "coming soon" until their rates land here and a
// provider lane exists.
//
// Cache tokens bill at their real rates — reads at the cache-read price, writes
// at the cache-write price — never as full input (SK-PREMIUM-002 #7). The
// four-class `TokenUsage` from the router carries the split; this module just
// multiplies each class by its rate.

import type { TokenUsage } from "./types.ts";

// Re-export under the premium-facing name used across the billing subsystem.
export type PremiumUsage = TokenUsage;

// v1 hosted-premium provider + model. Anthropic-only; `claude-sonnet-4-6` is
// pinned to the `SK-QUAL-009` baseline (do not bump without a paired eval).
export const PREMIUM_PROVIDER = "anthropic" as const;
export const PREMIUM_MODEL = "claude-sonnet-4-6" as const;

// USD **cents per 1,000,000 tokens** for each usage class. Integer cents keep
// the table readable and PR-reviewable. Verified against Anthropic's published
// list price for Claude Sonnet 4.6 (2026-08): $3.00 / $15.00 per MTok
// input/output; prompt caching writes (5-minute TTL) at 1.25× input = $3.75,
// cache reads at 0.1× input = $0.30. Re-validate against the pricing page
// before flipping `PREMIUM_METER_LIVE` (blocked-by-human).
export type PremiumRate = {
  inputCentsPerMTok: number;
  outputCentsPerMTok: number;
  cacheWriteCentsPerMTok: number;
  cacheReadCentsPerMTok: number;
};

export const PREMIUM_RATES: Record<string, PremiumRate> = {
  "claude-sonnet-4-6": {
    inputCentsPerMTok: 300,
    outputCentsPerMTok: 1500,
    cacheWriteCentsPerMTok: 375,
    cacheReadCentsPerMTok: 30,
  },
};

// One row in the hosted-premium picker (SK-PREMIUM-013's subscribe door). Only
// `anthropic`/`claude-sonnet-4-6` is `live`; the rest are `coming_soon` until a
// rate row + lane exist. Surfaced over the wire so surfaces never hardcode this.
export type HostedPremiumModel = {
  provider: string;
  model: string;
  label: string;
  status: "live" | "coming_soon";
};

export const HOSTED_PREMIUM_MODELS: HostedPremiumModel[] = [
  { provider: "anthropic", model: PREMIUM_MODEL, label: "Claude Sonnet 4.6", status: "live" },
  { provider: "openai", model: "gpt-5", label: "GPT-5", status: "coming_soon" },
  {
    provider: "google-ai-studio",
    model: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    status: "coming_soon",
  },
];

// Full-precision per-query cost in USD cents (float — NOT rounded here, so the
// meter reports exact pass-through and no rounding drift accrues across a
// month; callers round only for display/gauges). Returns 0 for an unknown
// model (the caller must guard: an unmetered model must never dispatch on the
// premium lane) so a missing rate can never silently bill a guessed number.
export function premiumQueryCostUsdCents(model: string, usage: PremiumUsage): number {
  const rate = PREMIUM_RATES[model];
  if (!rate) return 0;
  return (
    (usage.inputTokens * rate.inputCentsPerMTok +
      usage.outputTokens * rate.outputCentsPerMTok +
      usage.cacheWriteTokens * rate.cacheWriteCentsPerMTok +
      usage.cacheReadTokens * rate.cacheReadCentsPerMTok) /
    1_000_000
  );
}

// Total billable tokens across all four classes — the `tokens_per_query`
// histogram value + the soft-cap slot input (SK-PREMIUM-010).
export function totalBillableTokens(usage: PremiumUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}

export function isPremiumModelPriced(model: string): boolean {
  return model in PREMIUM_RATES;
}
