# SK-PREMIUM-002 — Pricing is provider list + 0% markup, billed via Stripe Billing Meters

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** Premium-model usage is billed at the upstream provider's list
  price with a **0% markup**. Per-call USD cost is computed from the rate table
  in [`packages/llm/src/pricing.ts`](../../../../packages/llm/src/pricing.ts) —
  the single source of truth, human-reviewed on every PR — and reported to
  Stripe as **Billing Meter events**, aggregated by `(customer, period)`.
  Without the add-on enabled no overage line appears; Hobby/Pro alone never
  produce one.

- **Core value:** Free, Open source, Honest latency

- **Why:** A markup turns the add-on into a profit center and loses the
  build-vs-buy math against direct provider use. Pass-through pricing keeps the
  add-on positioned as "we did the routing, prompt-caching, and reliability
  work; the model is at cost" — verifiable on the invoice.

- **Consequence in code:** `apps/api/src/billing/premium/meter.ts` reads the
  four-class `TokenUsage` surfaced by the LLM router
  (`packages/llm/src/pricing.ts::premiumQueryCostUsdCents`) and reports the
  resulting cents as a Stripe Billing Meter event. Cache tokens bill at their
  real rates — reads at the cache-read price, writes at the cache-write price —
  **never as full input tokens**. The premium dispatch sends
  `cf-aig-skip-cache: true` so an AI-Gateway cache HIT (which costs $0
  upstream) can never be metered as real COGS — every metered call is a
  genuine upstream call; nlqdb's own plan-cache sits in front, so this costs
  nothing in practice (`SK-PREMIUM-007`). The metered overage subscription item
  `nlqdb.premium_llm.overage.anthropic.<model>` is created by the checked-in
  bootstrap script and attached lazily on first overage; the
  [`SK-STRIPE-004`](../../stripe-billing/FEATURE.md) Checkout flow carries the
  plan (the included allowance rides the base plan). Rate changes in
  `pricing.ts` require a CHANGELOG entry + a customer email — no silent
  re-pricing.

- **Supersession (2026-08, this PR):** the prior plan **batched meter events
  through Lago-on-Fly** ([`phase-plan.md §6`](../../../phase-plan.md)). That is
  **replaced**: we report to **Stripe Billing Meters directly**, no Lago. The
  event contract, idempotency, and a daily reconciliation against Stripe meter
  summaries live in
  [`SK-PREMIUM-017`](./SK-PREMIUM-017-stripe-billing-meters.md). `phase-plan.md
  §6` is updated to match.

- **Alternatives rejected:**
  - Flat per-query premium price — opaque; good queries subsidise bad ones; can't audit.
  - Token-bucket "credits" in $ packs — needs an internal currency (accounting + refund + expiration + tax). Postponed.
  - 10–30% markup — off-brand vs the FSL self-host positioning (`GLOBAL-019`); +0% is the floor that matches the value claim.
  - **Lago as the metering layer** — an extra hosted service (Fly) + sync surface to run and reconcile, for a single-provider meter that Stripe Billing Meters already aggregate natively. Dropped for the direct Stripe path (SK-PREMIUM-017).

- **Source:** docs/architecture.md §5 · §6 · `llm-router/FEATURE.md`
