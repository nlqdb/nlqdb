---
name: premium-tier
description: Premium-models add-on — opt-in frontier-model routing (Claude Sonnet 4.6 / Opus 4.7 / GPT-5), pay-per-token billing, surface-parity model picker, BYOK decision tree.
when-to-load:
  globs:
    - apps/api/src/billing/premium/**
    - apps/api/src/ask/model-picker.ts
    - apps/web/src/components/PremiumCta*
    - packages/llm/src/chains/paid.ts
    - packages/sdk/src/options/model.ts
    - cli/cmd/model.go
  topics: [premium, pay-per-token, byok, model-picker, upgrade-cta, frontier-model, spend-cap]
---

# Feature: Premium Tier (premium-models add-on)

**One-liner:** Opt-in routing of the `plan` and `hard` LLM tiers through frontier models (Claude Sonnet 4.6 / Opus 4.7 / GPT-5), billed pay-per-token at provider list price + 0% markup, with a surface-parity model picker and a per-key spend cap.
**Status:** planned (Phase 2 pricing-row design-locked; Phase 3 ships alongside Pro)
**Owners (code):** none yet — `apps/api/src/billing/**`, `apps/api/src/ask/**`, `packages/llm/**`, `apps/web/**`, `cli/`, `packages/sdk/**`, `packages/elements/**`, `packages/mcp/**` will all carry slices.
**Cross-refs:** docs/design.md §6 (pricing — Premium-models row) · docs/design.md §8 (AI model selection — model catalog) · docs/plan.md §5.2 (Premium models add-on) · `.claude/skills/llm-router/SKILL.md` (`SK-LLM-007` tier-aware chain selector, `SK-LLM-008` Pro-tier privacy, `SK-LLM-009` prompt caching) · `.claude/skills/stripe-billing/SKILL.md` (`SK-STRIPE-004` Checkout linkage) · `.claude/skills/rate-limit/SKILL.md` (per-key spend cap is open) · `.claude/skills/web-app/SKILL.md` (CTA surface) · `.claude/skills/sdk/SKILL.md` / `cli/SKILL.md` / `mcp-server/SKILL.md` / `elements/SKILL.md` (surface-parity per `GLOBAL-003`)

## Touchpoints — read this skill before editing

- `apps/api/src/billing/premium/**` (planned — pricing, metering, spend-cap enforcement)
- `apps/api/src/ask/model-picker.ts` (planned — request → chain selector input)
- `apps/web/src/components/PremiumCta*` (planned — in-context upgrade CTA)
- `packages/llm/src/chains/paid.ts` (planned — premium chain definition)
- `packages/sdk/src/options/model.ts` (planned — `model: "auto" | "fast" | "best"` option)
- `cli/cmd/model.go` (planned — `nlq model set <preset>` and `--model` flag)
- `packages/mcp/src/tools/model.ts` (planned — MCP capability surface)
- `packages/elements/src/attributes.ts` (planned — `model` attribute on `<nlq-data>`)

## Decisions

### SK-PREMIUM-001 — The premium-models add-on is opt-in per-DB or per-API-key, never per-account

- **Decision:** Premium-model routing is enabled at the granularity of *(DB, API key)* pairs, never as an account-wide flag. A user with five DBs can opt one DB into the paid chain while the other four stay on the strict-$0 chain. An API key inherits the DB's setting unless the key carries an explicit override (e.g. a CI key locked to the free chain even though the DB has premium enabled).
- **Core value:** Effortless UX, Bullet-proof, Honest latency
- **Why:** Account-level toggles produce two failure modes we refuse: (1) a CI key racks up frontier-model token spend on a low-stakes scrape job; (2) a single experimental DB silently turns every other DB into a paid call. The pricing table in `docs/design.md §6` already commits to "Opt-in only, per-DB or per-API-key (never silently routed)" — this decision pins that commitment to the LLM router's chain-selector input shape so it can't be relaxed without superseding this SK-ID.
- **Consequence in code:** The chain-selector function `chooseChain(req)` in `packages/llm/src/router.ts` (added per `SK-LLM-007`) takes a `premium: boolean` derived from `(db_id, api_key_id) → premium_enabled`. The lookup lives in `apps/api/src/billing/premium/lookup.ts` and is cached in KV with a 60s TTL. PRs that propose a `user.premium = true` short-circuit are rejected. Toggle endpoints are `POST /v1/db/:id/premium` and `PATCH /v1/keys/:id { premium }` — both require `Idempotency-Key` per `GLOBAL-005`.
- **Alternatives rejected:**
  - Account-wide toggle — single switch turns every CI key into a paid call site. Rejected for the failure modes above.
  - Per-request toggle (`x-nlqdb-model: best` header per call) — already covered for explicit power users via `SK-PREMIUM-003`'s preset, but the pricing-control unit must be the (DB, key) pair so spend caps are enforceable; per-call only would let a runaway loop bypass caps.
  - Per-query auto-detection ("hard query → silently use premium") — explicitly rejected by the design.md commitment; silent paid routing is the dark pattern we won't ship.
- **Source:** docs/design.md §6 ("Premium models" row) · docs/plan.md §5.2

### SK-PREMIUM-002 — Pricing is provider list + 0% markup, billed monthly via Stripe metered usage

- **Decision:** Premium-model usage is billed at the upstream provider's list price with a 0% markup. Tokens are metered per call through Cloudflare AI Gateway (`SK-LLM-004`) and aggregated by `(customer_id, db_id, api_key_id, provider, model, period)`. A separate Stripe metered-usage subscription item carries the LLM-tokens line; without the add-on enabled, no `LLM tokens` line appears on a customer's invoice — Hobby and Pro alone never produce one (per `docs/design.md §6`).
- **Core value:** Free, Open source, Honest latency
- **Why:** A markup turns the add-on into a profit center and makes the build-vs-buy math against direct provider use lose. Pass-through pricing keeps the add-on positioned as "we did the routing, prompt-caching, and reliability work; the model is at cost" — defensible if we later raise it, indefensible to start at 30% markup and trim. The 0% number is also a marketing promise we can verify on the invoice (per-call provider model + per-call cents listed in the trace).
- **Consequence in code:** `apps/api/src/billing/premium/meter.ts` reads `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` from the LLM-router span and the model's list price from `packages/llm/src/pricing.ts` (one row per `(provider, model)`); the rate table is the single source of truth for "what we charge" and is human-reviewed on every PR. Stripe's metered-usage `subscription_item_id` for the LLM-tokens line is created on first opt-in (the Phase 2 Checkout flow per `SK-STRIPE-004` is extended with the add-on item) and updated via `subscriptionItem.usageRecords.create` after each request, batched through Lago (`docs/plan.md §5.4`). Markup deltas in `pricing.ts` require a CHANGELOG entry and a customer email — no silent re-pricing.
- **Alternatives rejected:**
  - Flat per-query premium price ($0.05/query) — opaque; bad queries that cost us $0.50 are subsidised by good ones that cost $0.005, and customers can't audit. Rejected for the pricing-honesty stance in `docs/plan.md §5.3`.
  - Token-bucket "credits" sold in $10 packs — easier billing UX, but requires an internal currency that needs accounting + refund + expiration policy + tax surface. Postpone until pass-through pricing produces enough complaints to justify the extra surface.
  - 10–30% markup — defensible eventually, but the open-source / Apache-2.0 positioning (`GLOBAL-019`) means we explicitly compete with self-hosting; +0% is the price floor that matches the value claim ("we route, you don't have to").
- **Source:** docs/design.md §6 · docs/plan.md §5.2 · docs/llm-credits-plan.md ("How credits flow into the product without breaking UX")

### SK-PREMIUM-003 — The user-facing knob is goal-first presets, not raw model names

- **Decision:** Every surface exposes the choice as `model: "auto" | "fast" | "best"` (and an Enterprise-only `"custom"`), not as `claude-sonnet-4-6` / `gpt-5` strings. `auto` (default) lets the classifier route — frontier model only when the request crosses the hard-plan confidence threshold; `fast` pins the strict-$0 chain even if premium is enabled; `best` pins the frontier-model chain regardless of confidence (with a per-call cost confirmation chip on the chat surface, no chip on programmatic surfaces). `custom` is reserved for Enterprise contracts that pin a specific provider.
- **Core value:** Goal-first, Simple, Effortless UX
- **Why:** Users don't wake up wanting "Sonnet 4.6" — they want "answer this hard question right" or "stay cheap." Exposing model strings leaks a moving decision (`docs/design.md §8`'s table updates every quarter as providers ship new models) into customer code, where the wrong model name on the wrong day becomes a 4xx. Presets let us re-wire the underlying chain (`SK-LLM-007`) without a customer-facing breaking change. The `auto` default is the goal-first promise: the user states what they want, we pick.
- **Consequence in code:** SDK option type is `model: "auto" | "fast" | "best"` (Enterprise build adds `"custom"`). CLI flag is `--model <preset>` and persistent setting is `nlq model set <preset>`. MCP tool descriptors carry a `model` parameter with the same enum. `<nlq-data model="best">` on the elements surface. The HTTP API accepts the same enum on `/v1/ask`. Provider+model strings live only in `packages/llm/src/chains/{free,paid}.ts`; no other package imports them. Tests assert that no `apps/web/**`, `cli/**`, `packages/sdk/**`, or `packages/mcp/**` file references a model string.
- **Alternatives rejected:**
  - Expose raw model names — leaks our routing decision into customer code; every new frontier model is a customer-side change.
  - Single boolean (`premium: true`) — loses the `fast` use case (a premium-enabled DB still wants the strict-$0 chain on a CI run). Two booleans (`premium`, `force_free`) is two flags doing what one enum does.
  - Per-call temperature / max-tokens knobs — leaks LLM-API-shape into our API surface; we can revisit if Pro customers ask, but the day-1 surface is the preset.
- **Source:** docs/design.md §0 (Goal-first) · docs/design.md §8 (model catalog) · GLOBAL-002 (parity) · GLOBAL-017 (one way to do each thing)

### SK-PREMIUM-004 — In-context upgrade CTA fires on classifier "hard plan" verdict, never on cost surprise

- **Decision:** When the classifier (`llm.classify`) flags a request as `hard_plan` *and* the current chain is the strict-$0 chain, the chat surface renders a non-blocking "upgrade for higher accuracy" chip below the answer with three actions: "Upgrade this DB" (one-click → Stripe Checkout for the add-on; first-charge double-confirm per `docs/design.md §6`), "Use BYOK" (deferred — see open-questions), and "Dismiss for this DB" (writes a per-(user, db) preference). The chip never blocks the response — the free-chain answer renders first; the chip is *additional* context, not a paywall.
- **Core value:** Effortless UX, Honest latency, Goal-first
- **Why:** The current flow has zero affordance for "this query would be more accurate on Sonnet 4.6" — the user gets the free-chain answer with no signal that an upgrade exists. Surfacing the chip *only* on hard-plan verdicts (not every query) keeps it out of the way for the 80% of queries the strict-$0 chain handles fine. Putting the chip below the answer (not above, not modal) preserves `GLOBAL-007` ("no login wall before first value") in spirit — the answer is delivered first, the upsell is a disclosure. Never firing on "we're about to bill you more" prevents the dark pattern where a customer thinks they hit a cap when they really hit a sales prompt.
- **Consequence in code:** `apps/web/src/components/PremiumCta.tsx` consumes `response.classifier.verdict === 'hard_plan'` from the trace surface (already shipped per `SK-WEB-005`). The "Upgrade this DB" action POSTs to a new `/v1/billing/checkout/premium { db_id }` that creates a Stripe Checkout Session with `client_reference_id: userId` and the premium-models metered subscription item, redirecting back to the chat with `?premium_enabled=db_<id>`. The "Dismiss for this DB" preference lives in D1 `user_db_prefs (user_id, db_id, premium_cta_dismissed_at)`; the chip is suppressed for 30d after dismiss. Programmatic surfaces (SDK / CLI / MCP / elements) do not surface the chip — they surface the verdict in the trace and let the embedding app render its own UI per `GLOBAL-002`.
- **Alternatives rejected:**
  - Block the response and require an upgrade for hard plans — turns the chip into a paywall; collapses activation, breaks the "answer first" promise.
  - Show the chip on every query — banner blindness within minutes; rejected for the same reason `docs/design.md §0` rejects "are you sure" prompts.
  - Email-based upsell on hard-plan accumulation — slow signal-to-action loop; the right moment is when the user is already in the chat looking at the (suboptimal) answer.
  - Render an in-context model picker dropdown on every reply — rejected for the goal-first stance in `SK-PREMIUM-003`; the picker exists in DB settings, not next to every answer.
- **Source:** docs/design.md §0 (Goal-first, Effortless UX) · docs/design.md §6 (honest billing) · `SK-WEB-005` (three-part chat response)

### SK-PREMIUM-005 — Surface parity per `GLOBAL-003` — model picker, opt-in, and CTA all ship together

- **Decision:** The premium-models add-on is not "shipped" until every surface in the parity set has the matching capability: HTTP API accepts the `model` enum on `/v1/ask`; SDK exposes `model` option; CLI exposes `--model` flag and `nlq model set`; MCP tools carry a `model` parameter; `<nlq-data>` accepts a `model` attribute; web app exposes the per-DB toggle in DB settings + the in-context CTA from `SK-PREMIUM-004`. A PR that ships only one surface lands the others as TODO blocks in the same PR or is rejected.
- **Core value:** Simple, Bullet-proof, Effortless UX
- **Why:** `GLOBAL-003` is explicit: "New capabilities ship to all surfaces in one PR." Premium-models is the highest-risk place to violate it — a paid feature that only works on the web product makes the SDK/CLI/MCP customers second-class billers. Shipping the surface-set together also forces the model-string-to-preset translation in `SK-PREMIUM-003` to be real (you can't ship `--model best` on the CLI and `model: "claude-sonnet-4-6"` on the SDK). The in-context CTA is web-only by exception, not by default — programmatic surfaces surface the verdict in the trace and let the embedder render its own UI.
- **Consequence in code:** Every premium-tier slice's PR touches at minimum: `apps/api/src/ask/`, `packages/sdk/`, `cli/`, `packages/mcp/`, `packages/elements/`, `apps/web/`. The `Open questions` block in any one of those skills must explicitly cite premium-tier when the surface gap is intentional (e.g. `<nlq-action>` in Phase 2 ships without a model picker because the write path doesn't use plan-tier LLM). PRs that skip a surface without a written gap-note in the affected skill are rejected.
- **Alternatives rejected:**
  - Web-first, then SDK / CLI / MCP — already the failure mode `GLOBAL-003` was written to prevent. Rejected for the reasons documented in `docs/decisions.md#GLOBAL-003`.
  - Surface gap tolerated for "complex" capabilities — slippery; once tolerated for premium-tier, every future big feature claims the same exception.
- **Source:** GLOBAL-003 (canonical text in `docs/decisions.md`) · GLOBAL-002 (parity)

### SK-PREMIUM-006 — Per-key spend cap is mandatory; default 100% hard at sign-up; one-click extension

- **Decision:** Every `(DB, API key)` pair with premium enabled carries a monthly spend cap denominated in USD. Default cap on opt-in is the user-set monthly budget (defaults to **$10/key/mo**); soft cap fires at 80% (email warning), hard cap defaults to 100% (router falls through to the strict-$0 chain and emits `nlqdb.premium.hard_cap_hit.total{customer_id, db_id, key_id}`). Hard cap extension is one click in the dashboard, generates an email confirmation, and applies for the remainder of the billing period only (resets next period). Cap can be raised via API but never silently — every change emits `billing.premium_cap_changed` to LogSnag.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Pay-per-token without a cap is the runaway-bill story that breaks the "no surprise $4,000 bills. Ever." promise in `docs/plan.md §5.3`. A cap that defaults to "off" or to a high number is the same risk re-shaped. Hard-falling-through to the strict-$0 chain at 100% (instead of 4xx-erroring) is the consequence of the goal-first stance in `SK-PREMIUM-003` — the user gets *an* answer, just not the frontier-model one. The 30-day extension reset prevents drift toward "everyone has $1k caps after a year."
- **Consequence in code:** `apps/api/src/billing/premium/cap.ts` enforces the cap inline in the `/v1/ask` pipeline before the LLM router is invoked; over-cap requests rewrite the chain selector to `free` and add a `cap_hit: true` field to the response trace. The KV-cached lookup from `SK-PREMIUM-001` carries `cap_usd_cents` and `period_spent_cents`; `period_spent_cents` increments via the metering write from `SK-PREMIUM-002` (with `ctx.waitUntil`). Extension endpoint is `POST /v1/billing/premium/cap/extend { db_id, key_id, new_cap_usd }` with `Idempotency-Key` per `GLOBAL-005`. Telemetry: `nlqdb.premium.spend_usd_cents{customer_id, db_id, key_id, period}` gauge + `nlqdb.premium.cap_hit.total` counter (cardinality budget per `docs/performance.md §3.3`).
- **Alternatives rejected:**
  - 4xx error at hard cap — strands the user mid-task with no answer; the goal-first stance prefers a graceful chain fallback.
  - Soft cap only (warn but never stop) — produces the runaway bill in the worst case; rejected for the pricing-honesty stance.
  - Cap denominated in tokens not USD — token prices change; USD is the unit the user commits to. Internal accounting can use tokens; the user-facing cap is dollars.
  - Account-level cap instead of per-key — collides with `SK-PREMIUM-001`'s per-(DB, key) granularity; a per-key cap is the smaller blast radius.
- **Source:** docs/plan.md §5.3 (no surprise bills) · docs/design.md §6 (per-key spend cap) · `.claude/skills/rate-limit/SKILL.md` (open: spend cap)

### SK-PREMIUM-007 — Plan cache stays product-funded; cap accounting starts at the LLM call site

- **Decision:** Plan-cache hits (per `SK-LLM-010` / `GLOBAL-006`) cost the customer **zero LLM tokens** even when premium is enabled — the plan-cache lookup short-circuits before any LLM call site. The metering hook is wired at the LLM router span boundary, not at the `/v1/ask` request boundary, so a cached plan that runs against a premium-enabled DB never appears on the LLM-tokens invoice line. The customer's per-DB queries-over-the-included-50k counter still ticks (Pro pricing line, `docs/design.md §6`); only the LLM-tokens add-on line is gated behind a real LLM call.
- **Core value:** Free, Honest latency, Bullet-proof
- **Why:** Charging for cached plans would invert the cost incentive — users would avoid asking the same useful question twice. The plan cache exists *because* repeat patterns are the cheap case; passing the savings through to the customer is the only honest framing. Wiring the meter at the router span boundary (instead of the request boundary) is the structural fix that makes the right thing the easy thing — the meter literally cannot fire without an LLM call to attach to. This is also a precondition for `SK-PREMIUM-006`'s cap accuracy: cap math in token-USD only counts real upstream calls.
- **Consequence in code:** The metering call site lives in `packages/llm/src/router.ts` inside the per-provider try/finally that already emits `gen_ai.*` attributes (`SK-LLM-006`); a cache-hit path in `apps/api/src/ask/` never enters that span. Tests assert that a second identical premium-enabled `/v1/ask` request emits no `nlqdb.premium.spend_usd_cents` increment. The customer-facing invoice line item shows `LLM tokens — Sonnet 4.6 (123,456 input / 45,678 output)`; cached plans are invisible on the invoice by construction.
- **Alternatives rejected:**
  - Charge a small "cache lookup" fee — re-introduces the "avoid repeating useful queries" disincentive; the cache-hit cost to us is sub-ms KV reads, not a profit center.
  - Bill cached plans at the original miss's price — same disincentive, plus accounting complexity (the original plan's price ages out as model prices change).
  - Bill at the request boundary, refund cache hits — accounting churn; the structural fix (meter at the call site) makes the refund unnecessary.
- **Source:** SK-LLM-010 (plan cache first) · GLOBAL-006 (content-addressed plans) · docs/design.md §6 (Premium models row)

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-002** — Behavior parity across surfaces.
  - *In this skill:* The `model` preset enum (`auto | fast | best`) must be identical across HTTP, SDK, CLI, MCP, elements. Web's in-context CTA is the one surface-specific affordance per `SK-PREMIUM-004` — programmatic surfaces expose the verdict in the trace, not a chip.
- **GLOBAL-003** — New capabilities ship to all surfaces in one PR.
  - *In this skill:* `SK-PREMIUM-005` is the explicit local restatement; surface gaps require a written exception in the affected skill.
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this skill:* Premium toggle endpoints (`POST /v1/db/:id/premium`, `PATCH /v1/keys/:id`, `POST /v1/billing/premium/cap/extend`) and the Stripe Checkout creation endpoint all accept `Idempotency-Key`.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.
  - *In this skill:* `SK-PREMIUM-007` enforces that cached plans are zero-cost on the customer-facing invoice; the cache key does not gain a `model` dimension just because premium exists.
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
  - *In this skill:* Free tier never routes to the paid chain. Premium-tier code in the Worker bundle must respect the 3 MiB ceiling — pricing tables are loaded from KV, not bundled, if they grow.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
  - *In this skill:* The `nlqdb.premium.spend_usd_cents` gauge and `nlqdb.premium.cap_hit.total` counter are wired alongside the existing `gen_ai.*` attributes on the LLM-router span; no new span is needed, only new attributes/metrics.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
  - *In this skill:* The `model` preset is the single way to express "I want better accuracy on this DB" — no parallel `--accuracy=high` flag, no `priority=premium` overload of the existing priority hint.
- **GLOBAL-019** — Free + Open Source core (Apache-2.0); Cloud is convenience, not a moat.
  - *In this skill:* The 0% markup in `SK-PREMIUM-002` is the consequence — we explicitly compete with self-hosting. Markup is a future decision that must be re-justified, not a default that drifts upward.

## Open questions / known unknowns

### BYOK — decision tree (the question this skill exists to host)

**Status:** undecided. The current default is **no BYOK in v1**; this section enumerates the decision points so a future SK-PREMIUM block can resolve them with the five-fields rigor.

The case for BYOK:
- Customer already has Anthropic / OpenAI credits and doesn't want to double-pay.
- Customer is on an enterprise contract with a specific provider that gives them better-than-list pricing.
- Customer has a data-residency constraint that requires their own provider account (e.g. Azure-hosted OpenAI in a specific region).

The case against BYOK in v1:
- Surfaces a key-handling problem (per-customer encrypted blob, KEK rotation, leak audit) that we already deferred for "BYO Postgres" to Phase 4+.
- Routes around our 0% markup pricing — if BYOK is the cheap path, the add-on becomes a tax on customers who don't have credits.
- Splits the AI Gateway prompt-cache (`SK-LLM-004`) — BYOK customers don't share the cache namespace; warm-cache wins evaporate.
- Splits the quality-telemetry surface — BYOK responses don't share the `nlqdb.plan.quality_score` histogram if they bypass the Gateway.

**Decision points (must be resolved before BYOK SK-* lands):**

1. **Which providers can users BYOK?** Anthropic + OpenAI only? Plus Gemini? Plus a generic "OpenAI-compatible endpoint" (Bedrock, Together, OpenRouter, self-hosted)?
   - Trade-off: a long list grows the test matrix; a short list disappoints the "I have credits" customers we already lost a sale to.
2. **Does BYOK go through Cloudflare AI Gateway?** Either path has cost: through-Gateway loses the prompt-cache (different account); around-Gateway loses our unified telemetry.
   - Strawman: through-Gateway with `BYOK_<userid>` namespace; pay the cache-warmup cost on each customer's first hit.
3. **Where do BYOK keys live?** Per-customer encrypted blob in D1 with a Workers-held KEK (mirrors the Phase 4+ "BYO Postgres" shape from `docs/implementation.md §7`)? Or per-DB Workers Secret (caps out around 1k per Worker — won't scale)?
   - Strawman: D1 blob + KEK, same as the BYO-Postgres design, so we build the pattern once.
4. **Does BYOK count against the per-key spend cap from `SK-PREMIUM-006`?** If we bill the customer's provider directly, our cap is irrelevant — but our `nlqdb.premium.spend_usd_cents` becomes unmonotonic vs invoice.
   - Strawman: BYOK requests bypass the spend cap (cap is for our-billed tokens) but still emit `nlqdb.byok.spend_estimate_usd_cents{provider, model}` with a "estimated, not billed" disclaimer for the customer dashboard.
5. **Does BYOK gate behind a paid plan?** Hobby+ only, or also Free? If Free can BYOK, we're hosting their LLM call without revenue against our compute / Gateway / observability cost.
   - Strawman: Hobby+ only — BYOK is a paid-plan capability even though we don't bill the LLM line. The plan upsell is "we don't host your spend on our worker for free."
6. **Failure modes — the customer's key is revoked / expired / rate-limited.** Do we fall through to our paid chain (silent re-billing) or to the strict-$0 chain (silent quality drop) or 4xx (user-visible failure)?
   - Strawman: 4xx with a one-sentence error per `GLOBAL-012` ("Your Anthropic key returned 401. Update it at /settings/keys."). Silent fallback to either alternative is a dark pattern.
7. **Privacy promise from `SK-LLM-008`.** Pro customers route exclusively through retention-off paid providers. If a Pro customer BYOKs a key on a retention-on plan, do we honor their setting (and silently break the privacy contract) or refuse?
   - Strawman: refuse — the privacy contract is a property of the plan, not the key. BYOK + Pro requires the customer to certify (per-key checkbox + audit log entry) that their key is on a retention-off plan.
8. **MCP host scenario.** An MCP host wants to BYOK on behalf of the connected user. Does the key live on the host or in our control plane? Hosts are diverse (Claude Desktop, Cursor, Zed); we can't trust them with provider keys.
   - Strawman: BYOK is server-side only (our control plane); MCP hosts opt the user's request into BYOK via a tool parameter, never carry the key.

A future `SK-PREMIUM-008` lands when these are resolved. Until then, the in-context CTA from `SK-PREMIUM-004` shows the "Use BYOK" action as `disabled` with tooltip "Coming in Phase 3 — vote at /roadmap" so we measure interest without committing to the design.

### Other open questions

- **Hard-plan classifier confidence threshold.** `SK-LLM-001` names the `hard` tier but pins no confidence number. The CTA in `SK-PREMIUM-004` fires on "hard plan" verdict, so the threshold directly drives upsell frequency. Strawman: 0.85 confidence → `hard_plan` true; tunable per env var; A/B-able once we have traffic.
- **Quality-score histogram.** `docs/llm-credits-plan.md` proposes `nlqdb.plan.quality_score` (1 = clean, 0.5 = correction loop, 0 = rejected). The CTA's persuasiveness depends on showing the customer their measured quality delta on the strict-$0 chain. Histogram shape + LLM-as-judge prompt + statistical confidence interval all open.
- **Lago wiring for usage metering.** `docs/plan.md §5.4` calls for Lago-on-Fly as the metering layer batched into Stripe; the LLM-router → Lago path is not yet wired (`llm-router/SKILL.md` Open questions). Premium-tier billing depends on this path; it must land before `SK-PREMIUM-002` ships.
- **Per-key spend cap UI.** `SK-PREMIUM-006` defines the data model but not the dashboard — where does the cap live in the UI? DB settings page or API-keys page or both? Probably both, with the API-keys page as the canonical write surface.
- **Dunning when the add-on payment fails.** Stripe `invoice.payment_failed` for the metered LLM-tokens line — does the add-on pause (drop to strict-$0) immediately, after one retry, or after the standard Stripe dunning period? `stripe-billing/SKILL.md` Open questions cover dunning broadly; premium-tier needs the specific behavior pinned.
- **Anonymous-mode interaction.** Anonymous users don't have a Stripe customer; they can't enable premium. The CTA from `SK-PREMIUM-004` should *not* appear for anonymous-mode users — but the "create-an-account-and-upgrade" path is the natural cross-sell. Behavior open.
- **Reseller / agency case.** An agency that runs five client accounts wants one consolidated bill for premium-models usage across all of them. Out of scope for v1 (per-account billing only); deferred to Enterprise.

## Source pointers

- `docs/design.md §6` — Premium-models pricing row (the design-locked starting point)
- `docs/design.md §8` — AI model selection (model catalog: Sonnet 4.6, Opus 4.7, GPT-5)
- `docs/plan.md §5.2` — Premium models add-on (pricing exposition)
- `docs/plan.md §5.3` — Honest billing rules (no surprise bills)
- `docs/llm-credits-plan.md` — credit-program landscape; tier-aware routing flow
- `.claude/skills/llm-router/SKILL.md` — `SK-LLM-007` (chain selector), `SK-LLM-008` (privacy), `SK-LLM-009` (prompt caching), `SK-LLM-010` (plan-cache first)
- `.claude/skills/stripe-billing/SKILL.md` — `SK-STRIPE-004` (Checkout linkage), Open questions (dunning, Lago wiring)
- `.claude/skills/rate-limit/SKILL.md` — Open: per-key spend cap
- `.claude/skills/web-app/SKILL.md` — `SK-WEB-005` (three-part chat reply, the trace surface the CTA hooks into)
