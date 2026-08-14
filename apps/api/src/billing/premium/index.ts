// Hosted-premium meter orchestration (SK-PREMIUM-009 / SK-PREMIUM-006 /
// SK-PREMIUM-010 / SK-PREMIUM-011). The `/v1/ask` handler calls into here so
// the dispatch-path handler stays lean and the accounting is unit-tested in
// one place. Everything is either pure or a single fast D1 write; the slow
// Stripe report is deferred to the caller's `ctx.waitUntil` (SK-PREMIUM-002 #4
// — meter events never block the response).
//
// **Dark by default.** `premiumConfigured` gates the whole lane on the operator
// having provisioned `PREMIUM_ANTHROPIC_API_KEY`, the AI Gateway, AND flipped
// `PREMIUM_METER_LIVE` (all human-only, blocked-by-human). With any of those
// unset the lane is never eligible and `/v1/ask` serves the free/BYOLLM router
// exactly as before — the dormancy the tests assert.

import {
  PREMIUM_MODEL,
  premiumQueryCostUsdCents,
  type TokenUsage,
  totalBillableTokens,
} from "@nlqdb/llm";
import {
  premiumCapHitTotal,
  premiumCostPerQueryUsd,
  premiumOverflowFallbackTotal,
  premiumTokensPerQuery,
} from "@nlqdb/otel";
import type { BillingPlan } from "../../stripe/billing-status.ts";
import { consumeAllowance } from "./allowance.ts";
import { sizedBucket, slotsForTokens } from "./guardrails.ts";
import { type PremiumTier, tierForPlan } from "./limits.ts";
import { meterEventId, type OverageEvent, recordOverageLedger, reportMeterEvent } from "./meter.ts";
import type { PreDispatchDecision } from "./overflow.ts";

export * from "./allowance.ts";
export * from "./cap.ts";
export * from "./guardrails.ts";
export * from "./limits.ts";
export * from "./meter.ts";
export * from "./overflow.ts";
export * from "./reconcile.ts";

// The `env` subset the premium lane reads. All optional at the type level so a
// deploy with none of them set compiles and stays dark.
export type PremiumEnv = {
  PREMIUM_METER_LIVE?: string;
  PREMIUM_ANTHROPIC_API_KEY?: string;
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  STRIPE_SECRET_KEY?: string;
};

// True only when every operator prerequisite for a LIVE hosted-premium meter is
// present. The single dormancy gate (SK-PREMIUM-009 `PREMIUM_METER_LIVE` +
// GLOBAL-026 "wired but dark"): no key / no gateway / flag off ⇒ dark.
export function premiumConfigured(env: PremiumEnv): boolean {
  return Boolean(
    env.PREMIUM_METER_LIVE &&
      env.PREMIUM_ANTHROPIC_API_KEY &&
      env.PREMIUM_ANTHROPIC_API_KEY.trim() !== "" &&
      env.AI_GATEWAY_ACCOUNT_ID &&
      env.AI_GATEWAY_ID,
  );
}

export type PremiumEligibility =
  | { eligible: false }
  | { eligible: true; tier: PremiumTier; periodStart: number };

// A request is premium-eligible when the lane is configured live, the caller is
// on a paid tier, and their subscription has a current-period boundary to key
// the allowance to. Free/unknown tiers and anon principals are never eligible
// (GLOBAL-026 — free tier never sees hosted premium).
export function resolvePremiumEligibility(args: {
  env: PremiumEnv;
  plan: BillingPlan;
  currentPeriodEnd: number | null;
}): PremiumEligibility {
  if (!premiumConfigured(args.env)) return { eligible: false };
  const tier = tierForPlan(args.plan);
  if (!tier || args.currentPeriodEnd == null) return { eligible: false };
  return { eligible: true, tier, periodStart: args.currentPeriodEnd };
}

// A stable usage accumulator handed to `buildPremiumRouter`'s `onUsage` sink.
// route + plan (+ summarize) each report usage; we sum them so the query is
// metered once, on its total footprint.
export function makeUsageAccumulator(): {
  sink: (u: TokenUsage) => void;
  total: () => TokenUsage;
} {
  const acc: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  return {
    sink: (u) => {
      acc.inputTokens += u.inputTokens;
      acc.outputTokens += u.outputTokens;
      acc.cacheReadTokens += u.cacheReadTokens;
      acc.cacheWriteTokens += u.cacheWriteTokens;
    },
    total: () => ({ ...acc }),
  };
}

export type PremiumSettlement = {
  // Allowance slots this query consumed (soft-cap slot math).
  slots: number;
  consumedAfter: number;
  total: number;
  remaining: number;
  // Overage cost in USD cents for the portion past the included allowance.
  overageCents: number;
  // Human trace line for the response (`GLOBAL-011` honest latency):
  // pre-exhaustion "used N of 200"; post-exhaustion "billed $0.0X overage".
  traceLine: string;
};

// SYNCHRONOUS settlement: decrement the allowance (atomic, no double-spend),
// compute the overage cost, and record the calibration histograms. Fast — one
// batched D1 write + pure math — so the trace line is accurate in the response.
// The slow Stripe report is the caller's `reportPremiumOverage` in waitUntil.
// Called ONLY after a successful dispatch returned usage (SK-PREMIUM-006 —
// failed/refused calls consume nothing).
export async function settlePremiumQuery(
  db: D1Database,
  args: { customerId: string; periodStart: number; tier: PremiumTier; usage: TokenUsage },
): Promise<PremiumSettlement> {
  const billable = totalBillableTokens(args.usage);
  const slots = slotsForTokens(billable);
  const sized = sizedBucket(billable);
  const costCents = premiumQueryCostUsdCents(PREMIUM_MODEL, args.usage);

  const labels = { provider: "anthropic", model: PREMIUM_MODEL, sized };
  premiumTokensPerQuery().record(billable, labels);
  premiumCostPerQueryUsd().record(costCents / 100, labels);

  const consume = await consumeAllowance(db, {
    customerId: args.customerId,
    periodStart: args.periodStart,
    tier: args.tier,
    slots,
  });
  const remaining = Math.max(0, consume.total - consume.consumedAfter);
  // Bill only the fraction of this query's slots that fell past the allowance.
  const overageCents = slots > 0 ? costCents * (consume.overageSlots / slots) : 0;

  const traceLine =
    overageCents > 0
      ? `This request billed $${(overageCents / 100).toFixed(2)} on overage.`
      : `This request used ${consume.consumedAfter} of your ${consume.total} included premium requests.`;

  return {
    slots,
    consumedAfter: consume.consumedAfter,
    total: consume.total,
    remaining,
    overageCents,
    traceLine,
  };
}

// ASYNCHRONOUS overage report (caller: `ctx.waitUntil`). Idempotent ledger write
// + Stripe Billing Meter event. No-ops when there's no overage. `requestKey` is
// the request's `Idempotency-Key` (or a stable request id) so a retry can't
// double-bill.
export async function reportPremiumOverage(
  env: PremiumEnv,
  db: D1Database,
  args: {
    customerId: string;
    stripeCustomerId: string;
    periodStart: number;
    overageCents: number;
    requestKey: string;
  },
): Promise<void> {
  if (args.overageCents <= 0) return;
  const ev: OverageEvent = {
    eventId: meterEventId(args.customerId, args.requestKey),
    customerId: args.customerId,
    periodStart: args.periodStart,
    model: PREMIUM_MODEL,
    costCents: args.overageCents,
    stripeCustomerId: args.stripeCustomerId,
  };
  const { firstInsert } = await recordOverageLedger(db, ev);
  // Only report to Stripe on the first ledger insert (dispatch-after-insert,
  // SK-STRIPE-002 / SK-IDEMP-006) — a retry hits the ledger's ON CONFLICT and
  // never re-reports.
  if (firstInsert) await reportMeterEvent(env, db, ev);
}

// Surface a free-chain fall-through at the metric layer. The trace surfacing
// (`overflow_fallback: true`) is set by the handler; this is the counter half:
// `fallback` = allowance-exhaustion opt-in (SK-PREMIUM-011), `cap` = the hard
// per-key spend-cap hit (SK-PREMIUM-006, GLOBAL-014).
export function recordOverflowFallback(reason: PreDispatchDecision["reason"]): void {
  if (reason === "fallback") premiumOverflowFallbackTotal().add(1);
  else if (reason === "cap") premiumCapHitTotal().add(1);
}
