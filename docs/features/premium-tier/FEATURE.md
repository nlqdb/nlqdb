---
name: premium-tier
description: The hosted-premium and BYOLLM lanes of the LLM router per GLOBAL-026 — frontier-model routing (Claude Sonnet 4.6 / Opus 4.7 / GPT-5) on paid plans, pure-metered at provider list + 0% markup, plus paste-your-key BYOLLM on every tier; surface-parity model picker, per-key spend cap.
when-to-load:
  globs:
    - apps/api/src/billing/premium/**
    - apps/api/src/ask/model-picker.ts
    - apps/web/src/components/PremiumCta*
    - packages/llm/src/chains/paid.ts
    - packages/sdk/src/options/model.ts
    - cli/cmd/model.go
  topics: [premium, byollm, pay-per-token, model-picker, upgrade-cta, frontier-model, spend-cap, hosted-premium-meter]
---

# Feature: Premium Tier (premium-models add-on)

**One-liner:** The hosted-premium and BYOLLM lanes of the LLM router per [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md). Premium = frontier-model routing (Claude Sonnet 4.6 / Opus 4.7 / GPT-5) on paid plans, pure-metered at provider list + 0% markup with no included allowance. BYOLLM = paste-your-key on any tier (free included). Surface-parity model picker, per-key spend cap, and the in-context upgrade CTA.
**Status:** partial — BYOLLM (SK-PREMIUM-008) ships in Phase 2; hosted-premium architectural slot (router precedence, schema, span names) lands in the same slice but the **meter stays dark** until the [`phase-plan.md §6`](../../phase-plan.md) trigger trips. SK-PREMIUM-001…007 are design-locked; meter-firing code is gated behind §6.
**Contribution to north-star:** **Engine quality** (hosted-premium lights up the frontier dispatch lane that [`quality-eval`](../quality-eval/FEATURE.md) measures the delta against; BYOLLM keeps heavy-eval-signal users inside the product) and **UX** (per-key spend cap + "answer-first never block" CTA keep the upgrade moment from becoming a paywall).
**Owners (code):** none yet — `apps/api/src/billing/**`, `apps/api/src/ask/**`, `packages/llm/**`, `apps/web/**`, `cli/`, `packages/sdk/**`, `packages/elements/**`, `packages/mcp/**` will all carry slices.
**Cross-refs:** docs/architecture.md §6 (pricing — Premium-models row) · docs/architecture.md §8 (AI model selection — model catalog) · docs/architecture.md §5 (Premium models add-on) · `docs/features/llm-router/FEATURE.md` (`SK-LLM-007` tier-aware chain selector, `SK-LLM-008` Pro-tier privacy, `SK-LLM-009` prompt caching) · `docs/features/stripe-billing/FEATURE.md` (`SK-STRIPE-004` Checkout linkage) · `docs/features/rate-limit/FEATURE.md` (per-key spend cap is open) · `docs/features/web-app/FEATURE.md` (CTA surface) · `docs/features/sdk/FEATURE.md` / `cli/FEATURE.md` / `mcp-server/FEATURE.md` / `elements/FEATURE.md` (surface-parity per `GLOBAL-003`)

## Touchpoints — read this feature before editing

Planned: `apps/api/src/billing/premium/**` (pricing, metering, spend-cap), `apps/api/src/ask/model-picker.ts`, `apps/web/src/components/PremiumCta*`, `packages/llm/src/chains/paid.ts`, `packages/sdk/src/options/model.ts`, `cli/cmd/model.go`, `packages/mcp/src/tools/model.ts`, `packages/elements/src/attributes.ts`. BYOLLM additions touch `apps/api/migrations/`, `apps/api/src/api-keys.ts`, `/v1/keys/byollm` route, `/app/keys` UI section, and parity surfaces (SDK / CLI / MCP / elements) per `GLOBAL-003`.

## Decisions

### SK-PREMIUM-001 — The premium-models add-on is opt-in per-DB or per-API-key, never per-account

- **Decision:** Premium-model routing is enabled at the granularity of *(DB, API key)* pairs, never as an account-wide flag. A user with five DBs can opt one DB into the paid chain while the other four stay on the strict-$0 chain. An API key inherits the DB's setting unless the key carries an explicit override (e.g. a CI key locked to the free chain even though the DB has premium enabled).
- **Core value:** Effortless UX, Bullet-proof, Honest latency
- **Why:** Account-level toggles produce two failure modes we refuse: (1) a CI key racks up frontier-model token spend on a low-stakes scrape job; (2) a single experimental DB silently turns every other DB into a paid call. The pricing table in `docs/architecture.md §6` already commits to "Opt-in only, per-DB or per-API-key (never silently routed)" — this decision pins that commitment to the LLM router's chain-selector input shape so it can't be relaxed without superseding this SK-ID.
- **Consequence in code:** The chain-selector function `chooseChain(req)` in `packages/llm/src/router.ts` (added per `SK-LLM-007`) takes a `premium: boolean` derived from `(db_id, api_key_id) → premium_enabled`. The lookup lives in `apps/api/src/billing/premium/lookup.ts` and is cached in KV with a 60s TTL. PRs that propose a `user.premium = true` short-circuit are rejected. Toggle endpoints are `POST /v1/db/:id/premium` and `PATCH /v1/keys/:id { premium }` — both require `Idempotency-Key` per `GLOBAL-005`.
- **Alternatives rejected:**
  - Account-wide toggle — single switch turns every CI key into a paid call site. Rejected for the failure modes above.
  - Per-request toggle (`x-nlqdb-model: best` header per call) — already covered for explicit power users via `SK-PREMIUM-003`'s preset, but the pricing-control unit must be the (DB, key) pair so spend caps are enforceable; per-call only would let a runaway loop bypass caps.
  - Per-query auto-detection ("hard query → silently use premium") — explicitly rejected by the architecture commitment (`docs/architecture.md §0`); silent paid routing is the dark pattern we won't ship.
- **Source:** docs/architecture.md §5 ("Premium models" row)

### SK-PREMIUM-002 — Pricing is provider list + 0% markup, billed monthly via Stripe metered usage

- **Decision:** Premium-model usage is billed at the upstream provider's list price with a 0% markup. Tokens are metered per call through Cloudflare AI Gateway (`SK-LLM-004`) and aggregated by `(customer_id, db_id, api_key_id, provider, model, period)`. A separate Stripe metered-usage subscription item carries the LLM-tokens line; without the add-on enabled, no `LLM tokens` line appears on a customer's invoice — Hobby and Pro alone never produce one (per `docs/architecture.md §6`).
- **Core value:** Free, Open source, Honest latency
- **Why:** A markup turns the add-on into a profit center and makes the build-vs-buy math against direct provider use lose. Pass-through pricing keeps the add-on positioned as "we did the routing, prompt-caching, and reliability work; the model is at cost" — defensible if we later raise it, indefensible to start at 30% markup and trim. The 0% number is also a marketing promise we can verify on the invoice (per-call provider model + per-call cents listed in the trace).
- **Consequence in code:** `apps/api/src/billing/premium/meter.ts` reads `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` from the LLM-router span and the model's list price from `packages/llm/src/pricing.ts` (one row per `(provider, model)`); the rate table is the single source of truth for "what we charge" and is human-reviewed on every PR. Stripe's metered-usage `subscription_item_id` for the LLM-tokens line is created on first opt-in (the Phase 2 Checkout flow per `SK-STRIPE-004` is extended with the add-on item) and updated via `subscriptionItem.usageRecords.create` after each request, batched through Lago (`docs/phase-plan.md §6`). Markup deltas in `pricing.ts` require a CHANGELOG entry and a customer email — no silent re-pricing.
- **Alternatives rejected:**
  - Flat per-query premium price ($0.05/query) — opaque; bad queries that cost us $0.50 are subsidised by good ones that cost $0.005, and customers can't audit. Rejected for the pricing-honesty stance in `docs/architecture.md §5`.
  - Token-bucket "credits" sold in $10 packs — easier billing UX, but requires an internal currency that needs accounting + refund + expiration policy + tax surface. Postpone until pass-through pricing produces enough complaints to justify the extra surface.
  - 10–30% markup — defensible eventually, but the open-source / Apache-2.0 positioning (`GLOBAL-019`) means we explicitly compete with self-hosting; +0% is the price floor that matches the value claim ("we route, you don't have to").
- **Source:** docs/architecture.md §5 · docs/architecture.md §6 · docs/features/llm-router/FEATURE.md ("How credits flow into the product without breaking UX")

### SK-PREMIUM-003 — The user-facing knob is goal-first presets, not raw model names

- **Decision:** Every surface exposes the choice as `model: "auto" | "fast" | "best"` (and an Enterprise-only `"custom"`), not as `claude-sonnet-4-6` / `gpt-5` strings. `auto` (default) lets the classifier route — frontier model only when the request crosses the hard-plan confidence threshold; `fast` pins the strict-$0 chain even if premium is enabled; `best` pins the frontier-model chain regardless of confidence (with a per-call cost confirmation chip on the chat surface, no chip on programmatic surfaces). `custom` is reserved for Enterprise contracts that pin a specific provider.
- **Core value:** Goal-first, Simple, Effortless UX
- **Why:** Users don't wake up wanting "Sonnet 4.6" — they want "answer this hard question right" or "stay cheap." Exposing model strings leaks a moving decision (`docs/architecture.md §8`'s table updates every quarter as providers ship new models) into customer code, where the wrong model name on the wrong day becomes a 4xx. Presets let us re-wire the underlying chain (`SK-LLM-007`) without a customer-facing breaking change. The `auto` default is the goal-first promise: the user states what they want, we pick.
- **Consequence in code:** SDK option type is `model: "auto" | "fast" | "best"` (Enterprise build adds `"custom"`). CLI flag is `--model <preset>` and persistent setting is `nlq model set <preset>`. MCP tool descriptors carry a `model` parameter with the same enum. `<nlq-data model="best">` on the elements surface. The HTTP API accepts the same enum on `/v1/ask`. Provider+model strings live only in `packages/llm/src/chains/{free,paid}.ts`; no other package imports them. Tests assert that no `apps/web/**`, `cli/**`, `packages/sdk/**`, or `packages/mcp/**` file references a model string.
- **Alternatives rejected:**
  - Expose raw model names — leaks our routing decision into customer code; every new frontier model is a customer-side change.
  - Single boolean (`premium: true`) — loses the `fast` use case (a premium-enabled DB still wants the strict-$0 chain on a CI run). Two booleans (`premium`, `force_free`) is two flags doing what one enum does.
  - Per-call temperature / max-tokens knobs — leaks LLM-API-shape into our API surface; we can revisit if Pro customers ask, but the day-1 surface is the preset.
- **Source:** docs/architecture.md §0 (Goal-first) · docs/architecture.md §8 (model catalog) · GLOBAL-002 (parity) · GLOBAL-017 (one way to do each thing)

### SK-PREMIUM-004 — In-context upgrade CTA fires on classifier "hard plan" verdict, never on cost surprise

- **Decision:** When the classifier (`llm.classify`) flags a request as `hard_plan` *and* the current chain is the strict-$0 chain, the chat surface renders a non-blocking "upgrade for higher accuracy" chip below the answer with three actions: "Upgrade this DB" (one-click → Stripe Checkout for the add-on; first-charge double-confirm per `docs/architecture.md §6` — gated on the [`phase-plan.md §6`](../../phase-plan.md) trigger; until then the action says "Notify me when paid plans launch"), "Use BYOLLM" (opens the paste-your-key flow per `SK-PREMIUM-008` — works for every tier including free), and "Dismiss for this DB" (writes a per-(user, db) preference). The chip never blocks the response — the free-chain answer renders first; the chip is *additional* context, not a paywall.
- **Core value:** Effortless UX, Honest latency, Goal-first
- **Why:** The current flow has zero affordance for "this query would be more accurate on Sonnet 4.6" — the user gets the free-chain answer with no signal that an upgrade exists. Surfacing the chip *only* on hard-plan verdicts (not every query) keeps it out of the way for the 80% of queries the strict-$0 chain handles fine. Putting the chip below the answer (not above, not modal) preserves `GLOBAL-007` ("no login wall before first value") in spirit — the answer is delivered first, the upsell is a disclosure. Never firing on "we're about to bill you more" prevents the dark pattern where a customer thinks they hit a cap when they really hit a sales prompt.
- **Consequence in code:** `apps/web/src/components/PremiumCta.tsx` consumes `response.classifier.verdict === 'hard_plan'` from the trace surface (already shipped per `SK-WEB-005`). The "Upgrade this DB" action POSTs to a new `/v1/billing/checkout/premium { db_id }` that creates a Stripe Checkout Session with `client_reference_id: userId` and the premium-models metered subscription item, redirecting back to the chat with `?premium_enabled=db_<id>`. The "Dismiss for this DB" preference lives in D1 `user_db_prefs (user_id, db_id, premium_cta_dismissed_at)`; the chip is suppressed for 30d after dismiss. Programmatic surfaces (SDK / CLI / MCP / elements) do not surface the chip — they surface the verdict in the trace and let the embedding app render its own UI per `GLOBAL-002`.
- **Alternatives rejected:**
  - Block the response and require an upgrade for hard plans — turns the chip into a paywall; collapses activation, breaks the "answer first" promise.
  - Show the chip on every query — banner blindness within minutes; rejected for the same reason `docs/architecture.md §0` rejects "are you sure" prompts.
  - Email-based upsell on hard-plan accumulation — slow signal-to-action loop; the right moment is when the user is already in the chat looking at the (suboptimal) answer.
  - Render an in-context model picker dropdown on every reply — rejected for the goal-first stance in `SK-PREMIUM-003`; the picker exists in DB settings, not next to every answer.
- **Source:** docs/architecture.md §0 (Goal-first, Effortless UX) · docs/architecture.md §6 (honest billing) · `SK-WEB-005` (three-part chat response)

### SK-PREMIUM-005 — Surface parity per `GLOBAL-003` — model picker, opt-in, and CTA all ship together

- **Decision:** The premium-models add-on is not "shipped" until every surface in the parity set has the matching capability: HTTP API accepts the `model` enum on `/v1/ask`; SDK exposes `model` option; CLI exposes `--model` flag and `nlq model set`; MCP tools carry a `model` parameter; `<nlq-data>` accepts a `model` attribute; web app exposes the per-DB toggle in DB settings + the in-context CTA from `SK-PREMIUM-004`. A PR that ships only one surface lands the others as TODO blocks in the same PR or is rejected.
- **Core value:** Simple, Bullet-proof, Effortless UX
- **Why:** `GLOBAL-003` is explicit: "New capabilities ship to all surfaces in one PR." Premium-models is the highest-risk place to violate it — a paid feature that only works on the web product makes the SDK/CLI/MCP customers second-class billers. Shipping the surface-set together also forces the model-string-to-preset translation in `SK-PREMIUM-003` to be real (you can't ship `--model best` on the CLI and `model: "claude-sonnet-4-6"` on the SDK). The in-context CTA is web-only by exception, not by default — programmatic surfaces surface the verdict in the trace and let the embedder render its own UI.
- **Consequence in code:** Every premium-tier slice's PR touches at minimum: `apps/api/src/ask/`, `packages/sdk/`, `cli/`, `packages/mcp/`, `packages/elements/`, `apps/web/`. The `Open questions` block in any one of those features must explicitly cite premium-tier when the surface gap is intentional (e.g. `<nlq-action>` in Phase 2 ships without a model picker because the write path doesn't use plan-tier LLM). PRs that skip a surface without a written gap-note in the affected feature are rejected.
- **Alternatives rejected:**
  - Web-first, then SDK / CLI / MCP — already the failure mode `GLOBAL-003` was written to prevent. Rejected for the reasons documented in [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md).
  - Surface gap tolerated for "complex" capabilities — slippery; once tolerated for premium-tier, every future big feature claims the same exception.
- **Source:** [GLOBAL-003](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) · [GLOBAL-002](../../decisions/GLOBAL-002-behavior-parity.md) (parity)

### SK-PREMIUM-006 — Per-key spend cap is mandatory; default 100% hard at sign-up; one-click extension

- **Decision:** Every `(DB, API key)` pair with premium enabled carries a monthly spend cap denominated in USD. Default cap on opt-in is the user-set monthly budget (defaults to **$10/key/mo**); soft cap fires at 80% (email warning), hard cap defaults to 100% (router falls through to the strict-$0 chain and emits `nlqdb.premium.hard_cap_hit.total{customer_id, db_id, key_id}`). Hard cap extension is one click in the dashboard, generates an email confirmation, and applies for the remainder of the billing period only (resets next period). Cap can be raised via API but never silently — every change emits `billing.premium_cap_changed` to LogSnag.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Pay-per-token without a cap is the runaway-bill story that breaks the "no surprise $4,000 bills. Ever." promise in `docs/architecture.md §5`. A cap that defaults to "off" or to a high number is the same risk re-shaped. Hard-falling-through to the strict-$0 chain at 100% (instead of 4xx-erroring) is the consequence of the goal-first stance in `SK-PREMIUM-003` — the user gets *an* answer, just not the frontier-model one. The 30-day extension reset prevents drift toward "everyone has $1k caps after a year."
- **Consequence in code:** `apps/api/src/billing/premium/cap.ts` enforces the cap inline in the `/v1/ask` pipeline before the LLM router is invoked; over-cap requests rewrite the chain selector to `free` and add a `cap_hit: true` field to the response trace. The KV-cached lookup from `SK-PREMIUM-001` carries `cap_usd_cents` and `period_spent_cents`; `period_spent_cents` increments via the metering write from `SK-PREMIUM-002` (with `ctx.waitUntil`). Extension endpoint is `POST /v1/billing/premium/cap/extend { db_id, key_id, new_cap_usd }` with `Idempotency-Key` per `GLOBAL-005`. Telemetry: `nlqdb.premium.spend_usd_cents{customer_id, db_id, key_id, period}` gauge + `nlqdb.premium.cap_hit.total` counter (cardinality budget per `docs/performance.md §3.3`).
- **Alternatives rejected:**
  - 4xx error at hard cap — strands the user mid-task with no answer; the goal-first stance prefers a graceful chain fallback.
  - Soft cap only (warn but never stop) — produces the runaway bill in the worst case; rejected for the pricing-honesty stance.
  - Cap denominated in tokens not USD — token prices change; USD is the unit the user commits to. Internal accounting can use tokens; the user-facing cap is dollars.
  - Account-level cap instead of per-key — collides with `SK-PREMIUM-001`'s per-(DB, key) granularity; a per-key cap is the smaller blast radius.
- **Source:** docs/architecture.md §5 (honest billing rules) · docs/architecture.md §6 (per-key spend cap) · `docs/features/rate-limit/FEATURE.md` (open: spend cap)

### SK-PREMIUM-007 — Plan cache stays product-funded; cap accounting starts at the LLM call site

- **Decision:** Plan-cache hits (per `SK-LLM-010` / `GLOBAL-006`) cost the customer **zero LLM tokens** even when premium is enabled — the plan-cache lookup short-circuits before any LLM call site. The metering hook is wired at the LLM router span boundary, not at the `/v1/ask` request boundary, so a cached plan that runs against a premium-enabled DB never appears on the LLM-tokens invoice line. The customer's per-DB queries-over-the-included-50k counter still ticks (Pro pricing line, `docs/architecture.md §6`); only the LLM-tokens add-on line is gated behind a real LLM call.
- **Core value:** Free, Honest latency, Bullet-proof
- **Why:** Charging for cached plans would invert the cost incentive — users would avoid asking the same useful question twice. The plan cache exists *because* repeat patterns are the cheap case; passing the savings through to the customer is the only honest framing. Wiring the meter at the router span boundary (instead of the request boundary) is the structural fix that makes the right thing the easy thing — the meter literally cannot fire without an LLM call to attach to. This is also a precondition for `SK-PREMIUM-006`'s cap accuracy: cap math in token-USD only counts real upstream calls.
- **Consequence in code:** The metering call site lives in `packages/llm/src/router.ts` inside the per-provider try/finally that already emits `gen_ai.*` attributes (`SK-LLM-006`); a cache-hit path in `apps/api/src/ask/` never enters that span. Tests assert that a second identical premium-enabled `/v1/ask` request emits no `nlqdb.premium.spend_usd_cents` increment. The customer-facing invoice line item shows `LLM tokens — Sonnet 4.6 (123,456 input / 45,678 output)`; cached plans are invisible on the invoice by construction.
- **Alternatives rejected:**
  - Charge a small "cache lookup" fee — re-introduces the "avoid repeating useful queries" disincentive; the cache-hit cost to us is sub-ms KV reads, not a profit center.
  - Bill cached plans at the original miss's price — same disincentive, plus accounting complexity (the original plan's price ages out as model prices change).
  - Bill at the request boundary, refund cache hits — accounting churn; the structural fix (meter at the call site) makes the refund unnecessary.
- **Source:** SK-LLM-010 (plan cache first) · GLOBAL-006 (content-addressed plans) · docs/architecture.md §6 (Premium models row)

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-002** — Behavior parity across surfaces.
  - *In this feature:* The `model` preset enum (`auto | fast | best`) must be identical across HTTP, SDK, CLI, MCP, elements. Web's in-context CTA is the one surface-specific affordance per `SK-PREMIUM-004` — programmatic surfaces expose the verdict in the trace, not a chip.
- **GLOBAL-003** — New capabilities ship to all surfaces in one PR.
  - *In this feature:* `SK-PREMIUM-005` is the explicit local restatement; surface gaps require a written exception in the affected feature.
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this feature:* Premium toggle endpoints (`POST /v1/db/:id/premium`, `PATCH /v1/keys/:id`, `POST /v1/billing/premium/cap/extend`) and the Stripe Checkout creation endpoint all accept `Idempotency-Key`.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.
  - *In this feature:* `SK-PREMIUM-007` enforces that cached plans are zero-cost on the customer-facing invoice; the cache key does not gain a `model` dimension just because premium exists.
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
  - *In this feature:* Free tier never routes to the paid chain. Premium-tier code in the Worker bundle must respect the 3 MiB ceiling — pricing tables are loaded from KV, not bundled, if they grow.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
  - *In this feature:* The `nlqdb.premium.spend_usd_cents` gauge and `nlqdb.premium.cap_hit.total` counter are wired alongside the existing `gen_ai.*` attributes on the LLM-router span; no new span is needed, only new attributes/metrics.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
  - *In this feature:* The `model` preset is the single way to express "I want better accuracy on this DB" — no parallel `--accuracy=high` flag, no `priority=premium` overload of the existing priority hint.
- **GLOBAL-019** — Free + Open Source core (Apache-2.0); Cloud is convenience, not a moat.
  - *In this feature:* The 0% markup in `SK-PREMIUM-002` is the consequence — we explicitly compete with self-hosting. Markup is a future decision that must be re-justified, not a default that drifts upward.
- **GLOBAL-025** — North-star: engine quality, onboarding, UX.
  - *In this feature:* Hosted-premium lights up the frontier dispatch lane that `quality-eval` measures the free-vs-frontier delta against. BYOLLM keeps the heaviest eval-signal users inside the product. Per-key spend cap (`SK-PREMIUM-006`) and "answer-first never block" CTA (`SK-PREMIUM-004`) are UX-quality contributions.
- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid.
  - *In this feature:* This GLOBAL is the *parent* of `SK-PREMIUM-008` (BYOLLM resolution) and `SK-PREMIUM-009` (pure-metered hosted-premium shape). The Phase 2 / §6 split — BYOLLM ships now, hosted-premium meter ships when §6 trips — comes from here.

### SK-PREMIUM-008 — BYOLLM: every tier, 0% markup, server-side keys only

**Body:** [`decisions/SK-PREMIUM-008-byollm.md`](./decisions/SK-PREMIUM-008-byollm.md).

Resolves the 8-point BYOK decision tree previously held as Open: providers (Anthropic / OpenAI / Gemini / OpenRouter), through-Gateway dispatch with per-user namespace, encrypted-blob storage with Workers-Secret KEK, free-tier *included*, fail-loud on key error per [`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md), retention-off certification for Pro, MCP-server-side-only key handling. Ships in Phase 2 alongside the `quality-eval` harness.

### SK-PREMIUM-009 — Hosted-premium meter: pure-metered, 0% markup, no allowance, §6-gated

**Body:** [`decisions/SK-PREMIUM-009-hosted-premium-meter.md`](./decisions/SK-PREMIUM-009-hosted-premium-meter.md).

When [`phase-plan.md §6`](../../phase-plan.md) trips, paid plans gain the hosted-premium dispatch lane: provider list + 0% markup, **no included allowance** (first token costs real money), per-key spend cap from `SK-PREMIUM-006` enforced upstream. Subscription pays for features; meter pays for compute. Pre-§6 the lane is feature-flagged dark; the architectural slot (router precedence, schema, OTel attributes) lands in Phase 2 so flipping it on is a flag, not a refactor.

## Open questions / known unknowns

- **Hard-plan classifier confidence threshold.** `SK-LLM-001` names the `hard` tier but pins no confidence number. The CTA in `SK-PREMIUM-004` fires on "hard plan" verdict, so the threshold directly drives upsell frequency. Strawman: 0.85 confidence → `hard_plan` true; tunable per env var; A/B-able once we have traffic.
- **Quality-score histogram.** `docs/features/llm-router/FEATURE.md` proposes `nlqdb.plan.quality_score`. The CTA's persuasiveness depends on showing the customer their measured quality delta on the strict-$0 chain. Histogram shape + LLM-as-judge prompt + statistical confidence interval all open.
- **Lago wiring for usage metering.** `phase-plan.md §6` calls for Lago-on-Fly as the metering layer batched into Stripe. Premium-tier billing depends on this path; it must land before the §6-gated portion of `SK-PREMIUM-009` ships.
- **Per-key spend cap UI.** `SK-PREMIUM-006` defines the data model but not the dashboard — DB settings page, API-keys page, or both? Probably both, with the API-keys page as the canonical write surface.
- **Dunning when the add-on payment fails.** `stripe-billing/FEATURE.md` covers dunning broadly; premium-tier needs the specific behavior pinned (drop to strict-$0 immediately, or after one retry, or after the standard Stripe period).
- **Anonymous-mode interaction.** Anonymous users have no Stripe customer; the CTA from `SK-PREMIUM-004` should not appear for them. Cross-sell path through "create account, then BYOLLM" is the natural flow now that BYOLLM is universal — exact surface open.
- **BYOLLM provider catalog.** `SK-PREMIUM-008` covers Anthropic + OpenAI + Gemini + OpenRouter. Generic OpenAI-compatible endpoint (Bedrock, Together, self-hosted) deferred until a paying customer asks.
- **Reseller / agency case.** Out of scope for v1; per-account billing only.

## Source pointers

- `docs/architecture.md §5, §6, §8` — premium-models exposition, pricing row, model catalog.
- `docs/features/llm-router/FEATURE.md` — `SK-LLM-007` chain selector, `SK-LLM-008` privacy, `SK-LLM-009` prompt caching, `SK-LLM-010` plan-cache first, `SK-LLM-016` BYOLLM dispatch, `SK-LLM-017` hosted-premium dispatch.
- `docs/features/stripe-billing/FEATURE.md` — `SK-STRIPE-004` Checkout linkage; Open: dunning + Lago wiring.
- `docs/features/rate-limit/FEATURE.md` — Open: per-key spend cap.
- `docs/features/web-app/FEATURE.md` — `SK-WEB-005` three-part chat reply (trace surface the CTA hooks into).
- [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md), [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md) — parents of `SK-PREMIUM-008` and `SK-PREMIUM-009`.
