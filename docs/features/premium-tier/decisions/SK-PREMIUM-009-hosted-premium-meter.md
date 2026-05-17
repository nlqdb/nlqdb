# SK-PREMIUM-009 — Hosted-premium meter: pure-metered from first token, 0% markup, no included allowance, §6-gated meter

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** When [`phase-plan.md §6`](../../../phase-plan.md) trips and
  Stripe live ships, paid plans (Hobby $10, Pro $25) gain the
  **hosted-premium dispatch lane** per
  [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
  Premium-LLM usage bills via Stripe metered subscription items (per
  `SK-PREMIUM-002`) at **provider list + 0% markup, no included
  allowance** — first token costs real money. Subscription pays for
  *features*; meter pays for *compute*. Per-key spend cap from
  `SK-PREMIUM-006` enforces the user's pre-set monthly budget before
  the meter fires. Pre-§6: lane feature-flagged dark — `model: "best"`
  returns the free-chain answer plus `pending_premium_launch: true` in
  trace.
- **Core value:** Free, Honest latency, Effortless UX
- **Why:** Adopts the Bessemer 2026 hybrid (flat subscription + metered
  overage) with the metered portion being 100% of premium consumption.
  **No allowance** because (a) "did my $5 credit run out?" is the worst
  metered-UX moment; pure pass-through from the first token in a tier
  the user already paid to enter removes that moment, (b) allowance
  denomination churns (tokens drift with model release; dollars with
  list price), (c) subscriptions stay predictable ($10/mo is $10/mo
  regardless of usage), (d) §6-gated meter not §6-gated architecture
  — router precedence, schema, Stripe SKU shape, OTel attributes all
  land in Phase 2; lighting the lane is a feature-flag flip.
- **Consequence in code:** Stripe metered subscription items
  `nlqdb.premium_llm.tokens.<provider>.<model>` (one per provider +
  model) created lazily on first premium request post-§6. Pricing from
  `packages/llm/src/pricing.ts` per `SK-PREMIUM-002`. Meter writes
  through Lago into the Stripe item. Feature flag `PREMIUM_METER_LIVE`
  (Workers Secret) gates dispatch. Per-request invoice-line preview
  surfaces in the response trace ("This request would cost $0.03 on
  premium") even pre-§6, so users can model bills ahead.
- **Alternatives rejected:**
  - **Hobby includes $5 of premium credit** — Bessemer's allowance-
    hybrid; adds the "credit-ran-out" UX problem.
  - **Pure usage (no flat subscriptions)** — 78% of buyers report
    unexpected-bill pain on pure-usage products in 2026.
  - **Per-query flat fee** — opaque; subsidizes expensive queries with
    cheap ones (already rejected by `SK-PREMIUM-002`).
  - **Light the meter without §6** — premature payment infra;
    violates "pay only when someone pays you".
