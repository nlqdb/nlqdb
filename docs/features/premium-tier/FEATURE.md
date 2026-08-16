---
name: premium-tier
description: Premium LLM routing — BYOLLM on every tier (0% markup) and hosted-premium on paid plans with Shape B economics (flat sub + included monthly request allowance + soft-meter overage at provider list + 0% markup), plus surface-parity model picker, per-key spend cap, and upgrade CTA.
when-to-load:
  globs:
    - apps/api/src/billing/premium/**
    - apps/api/src/ask/model-picker.ts
    - apps/web/src/components/PremiumCta*
    - apps/web/src/components/chat/ModelPicker.tsx
    - packages/llm/src/catalog.ts
    - packages/llm/src/chains/paid.ts
    - packages/llm/src/chains/premium.ts
    - packages/sdk/src/options/model.ts
    - cli/cmd/model.go
  topics: [premium, byollm, hosted-premium, shape-b, allowance, model-picker, upgrade-cta, frontier-model, spend-cap]
---

# Feature: Premium Tier (premium-models add-on)

**One-liner:** Two LLM upgrade lanes per [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md): **BYOLLM** (every tier including free; the user's provider key, 0% markup) and **hosted premium** on paid plans (frontier routing — Sonnet 4.6 / GPT-5 / Gemini 2.5 Pro — under Shape B: flat sub + included monthly request allowance + soft-meter overage at provider list + 0% markup), with surface-parity model picker and per-key spend cap.
**Status:** partial. BYOLLM (`SK-PREMIUM-008`) ships. The hosted-premium lane (`SK-PREMIUM-009`/`010`/`011`/`006`/`017`) **went live 2026-08-14** (`PREMIUM_METER_LIVE` flipped + AI Gateway provisioned; `premium.live=true` in prod) — `/v1/ask` routes a paid, no-BYOLLM user to an Anthropic `claude-sonnet-4-6` lane, meters overage to Stripe Billing Meters, and enforces allowance + soft-cap slots + per-key spend cap. v1 Anthropic-only; GPT-5 / Gemini "coming soon".

**Contribution to north-star:** Engine quality (hosted-premium + BYOLLM give heavy users frontier-model accuracy on real schemas, feeding `quality-eval`'s free-vs-frontier delta KPI per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md)) and UX (request-denominated Shape B + opt-in fallback per `SK-PREMIUM-011` keep the boundary honest, no "first-token bill" surprise).
**Owners (code):** none yet — `apps/api/src/{billing,ask}/**`, `packages/{llm,sdk,elements,mcp}/**`, `apps/web/**`, `cli/` will all carry slices.
**Cross-refs:** docs/architecture.md §5/§6/§8 (add-on · pricing row · model catalog) · `llm-router/FEATURE.md` (`SK-LLM-007` chain selector, `SK-LLM-008` Pro privacy, `SK-LLM-009` caching) · `stripe-billing/FEATURE.md` (`SK-STRIPE-004` Checkout) · `rate-limit/FEATURE.md` (spend cap open) · `web-app/FEATURE.md` (CTA) · `sdk` / `cli` / `mcp-server` / `elements` FEATUREs (surface parity per `GLOBAL-003`) · [`agent-memory-pivot/FEATURE.md`](../agent-memory-pivot/FEATURE.md) (`SK-PIVOT-023` — the memory wedge's paid line is hosted memory *operations* riding this feature's premium chain; no memory-specific meter or SKU)

## Touchpoints — read this feature before editing

- `apps/api/src/billing/premium/**` (planned — pricing, metering, spend-cap)
- `packages/llm/src/byollm-dispatch.ts` + `apps/api/src/ask/byollm.ts` (preset → lane routing, `SK-PREMIUM-014`)
- `apps/web/src/components/PremiumCta*` (planned — in-context CTA)
- `packages/llm/src/chains/paid.ts` (planned — premium chain)
- `packages/sdk/src/index.ts` (`AskRequest.model` + `getModels()`)
- `cli/internal/cmd/ask.go` (`--model`; `nlq model set` planned)
- `packages/mcp/src/tools.ts` (`nlqdb_query.model`)
- `packages/elements/src/{element,fetch}.ts` (`<nlq-data model>`)

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

### SK-PREMIUM-002 — Pricing is provider list + 0% markup, billed via Stripe Billing Meters

**Body:** [`decisions/SK-PREMIUM-002-provider-list-zero-markup.md`](./decisions/SK-PREMIUM-002-provider-list-zero-markup.md).
Premium usage bills at provider list + 0% markup; per-call cost comes from `packages/llm/src/pricing.ts` (the single rate-table source) and is reported to Stripe as Billing Meter events. Cache reads/writes bill at their real cache rates, never as full input. **Superseded (2026-08):** the Lago metering layer is dropped for direct Stripe Billing Meters — event contract, idempotency, and daily reconciliation in [`SK-PREMIUM-017`](./decisions/SK-PREMIUM-017-stripe-billing-meters.md).

### SK-PREMIUM-017 — Overage metering rides Stripe Billing Meters directly (no Lago); idempotent events + daily reconciliation

**Body:** [`decisions/SK-PREMIUM-017-stripe-billing-meters.md`](./decisions/SK-PREMIUM-017-stripe-billing-meters.md).
Meter events report async after the response (`ctx.waitUntil`), keyed `premium:<customer>:<dispatch-id>` — a fresh id per executed dispatch, never the client `Idempotency-Key` (ledger PK + Stripe `identifier`, reported once on first insert; cost sub-cent-quantized once so both sides match), with a daily cron reconciling the ledger against Stripe meter summaries. Supersedes SK-PREMIUM-002's Lago mention and `phase-plan.md §6`.

### SK-PREMIUM-003 — The user-facing knob is goal-first presets, plus an advanced catalog-served named picker

**Body:** [`decisions/SK-PREMIUM-003-model-knob.md`](./decisions/SK-PREMIUM-003-model-knob.md).
The primary knob is presets `model: "auto"|"fast"|"best"` (+Enterprise `"custom"`), never raw model strings in customer code. Amended by `SK-PREMIUM-013` ("Both"): surfaces may also offer an **advanced named picker** — but model strings still never live in a surface file; the catalog is served from `@nlqdb/llm` over the wire (`GET /v1/models`), so a new frontier model is a one-line `catalog.ts` edit, not a customer-code change.

### SK-PREMIUM-004 — In-context free-model nudge fires when the free chain visibly struggled, never on cost surprise

- **Decision:** When the user is on the strict-$0 (free) chain *and* a reply visibly struggled — it failed on a model-quality code (`llm_failed` = couldn't plan, `sql_rejected` = produced disallowed SQL) or came back below the `0.7` plan-confidence floor — the chat renders a short, non-blocking nudge below that reply: a one-line warning plus a single "Switch model" CTA that opens the header `ModelPicker` (BYOLLM today, hosted-premium when `SK-PREMIUM-009` ships). The nudge never blocks the response — the free-chain answer/error renders first; the nudge is *additional* context, not a paywall. It is gated on the *struggled* condition (not every reply) and on *free chain* (a BYOLLM/frontier user never sees it). The founder-approved copy is blunt — *"The free model sucks — use a frontier model for better answers."* — deliberately overriding the softer framing implied by the `GLOBAL-026` "free is great" positioning; conversion signal is weighted above brand tone here.
- **Core value:** Effortless UX, Honest latency, Goal-first
- **Why:** The free chain sometimes errors, and when it doesn't its answers can be lower-accuracy than a frontier model — with no affordance telling the user a better model exists. Firing *only* when the free model actually struggled (a model-quality error or a sub-floor confidence) keeps it out of the way for the queries the free chain handles fine, so it isn't banner-blindness. Gating on the free chain avoids the wrong message ("the free model sucks") reaching a user who already brought a frontier key. Rendering below the answer (not above, not modal) preserves `GLOBAL-007` ("no login wall before first value") — the answer is delivered first, the nudge is a disclosure. Never firing on "we're about to bill you more" prevents the dark pattern where a customer thinks they hit a cap when they really hit a sales prompt.
- **Consequence in code:** `apps/web/src/components/chat/FreeModelNudge.tsx` renders the warning + CTA. `ChatPanel` gates it on `onFreeChain && freeChainStruggled(reply)`: `freeChainStruggled` reads the reply's error `code` (kept on the `error` reply state) or `trace.confidence` against `LOW_CONFIDENCE_THRESHOLD = 0.7`; `onFreeChain` is learned from the `ModelPicker`'s `BYOLLM_STATUS_EVENT` broadcast (`configured === false` ⇒ free). The CTA dispatches `MODEL_PICKER_OPEN_EVENT`; `ModelPicker` listens, opens, and scrolls itself into view. This is web-only per `GLOBAL-002` — programmatic surfaces (SDK / CLI / MCP / elements) expose `trace.confidence` and the error code and let the embedding app render its own UI. The one-click Stripe-Checkout upgrade action and the per-(user, db) "dismiss for 30d" preference remain **deferred** (tracked in Open questions) — the shipped slice is the nudge + BYOLLM switch, not the hosted-premium checkout (`SK-PREMIUM-009`).
- **Alternatives rejected:**
  - Fire on the classifier `hard_plan` verdict — no such verdict is surfaced to any client today (`trace` carries `confidence`, not a classifier label); wiring a new cross-surface field for the trigger was heavier than reusing the confidence floor + error code that already ride the response.
  - Show the nudge on every free reply — banner blindness within minutes; rejected for the same reason `docs/architecture.md §0` rejects "are you sure" prompts. Gating on the struggled condition is the compromise.
  - Show it to BYOLLM/frontier users too — the copy is wrong for them (they're already on a frontier model) and switching does nothing.
  - Block the response and require an upgrade — turns the nudge into a paywall; collapses activation, breaks the "answer first" promise.
- **Source:** docs/architecture.md §0 (Goal-first, Effortless UX) · docs/architecture.md §6 (honest billing) · `SK-WEB-005` (three-part chat response) · [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md) (free-vs-frontier lanes)

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

**Body:** [`decisions/SK-PREMIUM-006-per-key-spend-cap.md`](./decisions/SK-PREMIUM-006-per-key-spend-cap.md).
Every `(DB, API key)` pair with premium enabled carries a monthly USD spend cap (default $10/key/mo, soft warn at 80%, hard fall-through to strict-$0 chain at 100%, one-click extension with email confirmation). Under `SK-PREMIUM-009`'s Shape B the cap applies to **overage spend after allowance exhaustion** — included-allowance requests never tick the cap.

### SK-PREMIUM-008 — BYOLLM: every tier including free; server-side keys; 0% markup; fail-loud on key error

**Body:** [`decisions/SK-PREMIUM-008-byollm.md`](./decisions/SK-PREMIUM-008-byollm.md).
Any authenticated user (free, Hobby, Pro, Enterprise) may paste an Anthropic / OpenAI / Gemini / xAI-Grok / OpenRouter key. The router dispatches through their key at 0% markup per [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md); keys live encrypted in `api_keys` with `scope = "byollm"` and a Workers-Secret KEK. Failures fail loud per [`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md). Resolves the 8-point decision tree previously held Open here. (Grok + OpenRouter added 2026-07 per `SK-PREMIUM-015`; OpenRouter rides its dedicated AI Gateway path.)

### SK-PREMIUM-009 — Hosted-premium meter (Shape B): flat sub + included monthly request allowance + soft-meter overage; §6-gated

**Body:** [`decisions/SK-PREMIUM-009-hosted-premium-meter.md`](./decisions/SK-PREMIUM-009-hosted-premium-meter.md).
Live 2026-08-14 (§6 tripped): paid plans get hosted-premium routing. Hobby $10/mo ≈ 200 included premium requests/mo; Pro $25/mo ≈ 600 (target, calibrated against `nlqdb.premium.cost_per_query_usd` per `SK-PREMIUM-010`). Allowance unit is **requests** (not dollars, not tokens); no carryover; soft-meter overage at provider list + 0% markup; opt-in fallback to free chain per `SK-PREMIUM-011`.

### SK-PREMIUM-010 — Allowance guardrails: per-query soft cap, hard ceiling, instrumentation-first

**Body:** [`decisions/SK-PREMIUM-010-allowance-guardrails.md`](./decisions/SK-PREMIUM-010-allowance-guardrails.md).
Three guardrails protect the included allowance from `SK-PREMIUM-009`: per-query soft cap (~50k tokens; oversize = multiple allowance slots), hard ceiling (~500k tokens; refused with one-sentence error per `GLOBAL-012`), and cost-per-query instrumentation that ships **first** (by 2026-07-01) so allowance counts are calibrated against `p50_cost_per_query × allowance ≤ tier_price × (1 − target_gross_margin)`, target ≥ 60% gross margin post-COGS.

### SK-PREMIUM-011 — Exhaustion policy: soft-meter overage by default, opt-in fallback to free chain

**Body:** [`decisions/SK-PREMIUM-011-overflow-policy.md`](./decisions/SK-PREMIUM-011-overflow-policy.md).
At allowance exhaustion, the per-account `users.overflow_policy` decides behavior: default `"meter"` continues at metered overage; opt-in `"fallback"` routes the rest of the billing period through the free chain with `overflow_fallback: true` surfaced in trace (never silent — `GLOBAL-023`). Per-key spend cap from `SK-PREMIUM-006` is the absolute ceiling regardless of policy.

### SK-PREMIUM-012 — Account-stored BYOLLM credential: `api_keys` row schema + resolution

**Body:** [`decisions/SK-PREMIUM-012-account-stored-byollm-storage.md`](./decisions/SK-PREMIUM-012-account-stored-byollm-storage.md).
Pins SK-PREMIUM-008's storage mechanics: the account-stored key is an `api_keys` row (`scope = "byollm"`, `key_type = "byollm"`) holding the GLOBAL-031 sealed envelope in `key_hash` (reversible blob, not the HMAC), one row/account, hard-DELETE clear. Session-only `POST/GET/DELETE /v1/keys/byollm` + the `/v1/ask` step-2 lane (`resolveAskRouter` `accountCredential`, fail-loud) ship here; `llm.byollm_source ∈ {header, account}` labels the lane.

### SK-PREMIUM-013 — Model catalog endpoint + the two-door frontier picker

**Body:** [`decisions/SK-PREMIUM-013-model-catalog-and-picker.md`](./decisions/SK-PREMIUM-013-model-catalog-and-picker.md).
`GET /v1/models` serves the canonical `@nlqdb/llm` catalog (presets + `free` + named frontier BYOLLM entries) so surfaces render the picker without hardcoding model strings (resolves SK-PREMIUM-003's "Both"). Selecting a frontier model routes **two doors**: **BYOLLM** (live — gentle inline key form) or **subscribe** (hosted-premium credits, SK-PREMIUM-009 — live). The web ships a header **model pill** + popover; `trace.model` rides MCP too. The SK-PREMIUM-004 CTA remains a tracked gap.

### SK-PREMIUM-015 — Frontier picker sourced live from models.dev, one row per provider

**Body:** [`decisions/SK-PREMIUM-015-dynamic-catalog-models-dev.md`](./decisions/SK-PREMIUM-015-dynamic-catalog-models-dev.md).
`GET /v1/models` builds the frontier rows live from [models.dev](https://models.dev) (MIT, keyless) instead of a hand-maintained list that silently went stale, grouped **one row per provider** (Claude / GPT / Gemini / Grok / OpenRouter) each with a searchable model list + flagship default. The mapper (`buildCatalogFromModelsDev`) is pure; the fetch carries its own span ([`GLOBAL-014`](../../decisions/GLOBAL-014-otel-on-external-calls.md)) + edge cache and degrades to a bundled snapshot ([`GLOBAL-013`](../../decisions/GLOBAL-013-free-tier-bundle-budget.md)). Wire shape moves from `{ presets, models[] }` to `{ presets, free, providers[] }`. **Leverage: invest** — a new model within a provider costs 0 (auto-pulled); a new compat provider is 3 config lines.

### SK-PREMIUM-014 — The `model` preset rides `/v1/ask` on every surface; `fast` pins free, `best` fails loud without a frontier lane

**Body:** [`decisions/SK-PREMIUM-014-model-preset-wire.md`](./decisions/SK-PREMIUM-014-model-preset-wire.md).
`/v1/ask` accepts `model: "auto"|"fast"|"best"` (unknown → 400 `invalid_model`); `selectDispatchLane` owns the routing: `fast` pins the strict-$0 chain even over stored credentials, `best` requires a frontier lane and 409s `model_unavailable` (with `link`) when none exists — never a silent downgrade. SDK `model`, CLI `--model`, MCP `model`, `<nlq-data model>` are passthroughs of the same enum (GLOBAL-002).

### SK-PREMIUM-016 — "Count me in" sends the user a confirmation email on first click

**Body:** [`decisions/SK-PREMIUM-016-count-me-in-confirmation-email.md`](./decisions/SK-PREMIUM-016-count-me-in-confirmation-email.md).
The model-picker success copy already promises *"we'll email you when the paid plan ships"* but no email was sent — a broken promise. The first `POST /v1/premium/interest` for an account now sends the **user** a *"You're on the hosted-premium list"* confirmation (alongside the existing founder notify), both through the shared best-effort `notify()` rail + `premiumInterestConfirmEmail` template, deduped once-per-account by the existing `premium_interest` first-insert gate. Fire-and-forget (`waitUntil`); only when the session carries an email.

### SK-PREMIUM-018 — Hosted-premium eligibility extends to `sk_live_` / `sk_mcp_`; `pk_live_` stays excluded

**Body:** [`decisions/SK-PREMIUM-018-sk-key-premium-eligibility.md`](./decisions/SK-PREMIUM-018-sk-key-premium-eligibility.md).
The `/v1/ask` hosted-premium lane is eligible for `user` + `sk_live_` + `sk_mcp_` (a paying customer's SDK/CLI/MCP traffic reaches the paid chain — an `sk_*` key's `tenant_id` IS the account user id, so the same `customers JOIN user` lookup resolves it). `pk_live_` is **excluded** (browser-exposed publishable key — a drive-by embed could burn the allowance); `anon` has no account. The kind gate is the pure `isPremiumEligiblePrincipalKind(principal.kind)`; paid-status + per-key spend cap (`SK-PREMIUM-006`) still bound an eligible caller. Closes the "session-`user` only" parked gap below.

### SK-PREMIUM-019 — Per-API-key `default_model`; precedence: request > per-key default > server default

**Body:** [`decisions/SK-PREMIUM-019-per-key-default-model.md`](./decisions/SK-PREMIUM-019-per-key-default-model.md).
A nullable `api_keys.default_model` holds a `/v1/ask` preset (`"fast" | "best"`; `"auto"`/NULL = no default). Effective preset = **request `model` > per-key `default_model` > server default** (premium if eligible, else free). Per-key only — no account-wide default (`SK-PREMIUM-001`); web/session keeps the `ModelPicker`. `resolveEffectiveModelPreset` owns the ladder; `/v1/ask` applies the key default only on the no-`model` path for `sk_live`/`sk_mcp`. Write surface `POST /v1/keys/:id/default-model` (session-only, idempotent, `Idempotency-Key` per `GLOBAL-005`); dashboard `<select>` Auto/Fast/Best. SDK/CLI/MCP set-default is a tracked `GLOBAL-003` gap.

### SK-PREMIUM-007 — Plan cache stays product-funded; cap accounting starts at the LLM call site

**Body:** [`decisions/SK-PREMIUM-007-plan-cache-zero-cost.md`](./decisions/SK-PREMIUM-007-plan-cache-zero-cost.md).
Plan-cache hits cost the customer zero LLM tokens even with premium enabled: the meter is wired at the LLM router span boundary (not the `/v1/ask` request boundary), so a cached plan structurally cannot produce an LLM-tokens invoice line — and cap math (`SK-PREMIUM-006`) only counts real upstream calls.

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
  - *In this feature:* aggregate-only premium instruments — `nlqdb.premium.{cap_hit,overflow_fallback_events}.total` counters, `nlqdb.premium.{cost_per_query_usd,tokens_per_query}` histograms (labels `provider`/`model`/`sized`), and the `nlqdb.premium.meter_reconcile_drift_usd_cents` gauge — all in the performance.md §3.2 catalog. Per-(customer, period) allowance/overage accounting is **D1-sourced** (`premium_allowance_period`) + the response `premium` trace, never an OTel label (performance.md §3.3 forbids user-grain labels on per-request metrics). The meter/reconcile Stripe calls carry `nlqdb.billing.premium.{meter_event,overage_item,reconcile}` spans.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
  - *In this feature:* The `model` preset is the single way to express "I want better accuracy on this DB" — no parallel `--accuracy=high` flag, no `priority=premium` overload of the existing priority hint.
- **GLOBAL-019** — Free + Open Source core (FSL-1.1-ALv2 → Apache-2.0); Cloud is convenience, not a moat.
  - *In this feature:* The 0% markup in `SK-PREMIUM-002` is the consequence — we explicitly compete with self-hosting. Markup is a future decision that must be re-justified, not a default that drifts upward.
- **GLOBAL-025** — North-star: engine quality, onboarding, UX — each with explicit KPIs.
  - *In this feature:* Hosted-premium routing and BYOLLM are the levers for the engine north-star (frontier accuracy on real schemas). `SK-PREMIUM-010`'s instrumentation-first cost-per-query histogram is the input to the Phase 3 unit-economics KPI.
- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid (flat sub + included monthly request allowance + soft-meter overage, 0% markup).
  - *In this feature:* This feature owns the commercial shape of the upgrade lanes; `llm-router/FEATURE.md` owns the dispatch precedence (`SK-LLM-016`, `SK-LLM-017`).
- **GLOBAL-031** — One AES-256-GCM at-rest envelope + one Workers-held KEK for every BYO secret.
  - *In this feature:* account-stored BYOLLM keys (`api_keys` `scope = "byollm"`, envelope in `key_hash`; `SK-PREMIUM-012`) seal through `secret-envelope.ts` (context `byollm:<tenantId>`); per-request `x-nlq-byollm-key` keys are never persisted, so they don't touch the envelope.

## Open questions / known unknowns

The 8-point BYOK decision tree that previously lived here is resolved by [`SK-PREMIUM-008`](./decisions/SK-PREMIUM-008-byollm.md) (see its `Why` field). Historical case-for / case-against context lives in that file's `## Resolution history` section.

### Other open questions

- **Add-on payment-fail routing** — Resolved per `GLOBAL-033` (cost → `GLOBAL-026` free chain forever): on `invoice.payment_failed` for the metered LLM-tokens line, route premium-enabled DBs back to the strict-$0 free chain — never block the product — and re-enable the add-on on a successful charge. `stripe-billing` owns the dunning mechanics (`SK-STRIPE-011`/`SK-STRIPE-013` + `SK-STRIPE-005` `past_due` sync); this bullet owns only the chain-selection consequence.
- **Anonymous-mode interaction** — Resolved per `GLOBAL-033` (UX): anon principals have no Stripe customer, so the `SK-PREMIUM-004` premium CTA does **not** render for them; the create-an-account cross-sell takes its place on that surface.
- **Parked (GLOBAL-003 tracked gaps, post-`SK-PREMIUM-014`):** per-provider BYOLLM key storage (SK-PREMIUM-012 is one row/account, so switching frontier models re-enters the key), the `nlq model set` persistence verb (the CLI ships `--model` per call), `<nlq-action model>` (the read element has the attribute; add the write element's when a persona test asks), and the hosted-premium interest capture — `POST /v1/premium/interest` + SDK `registerPremiumInterest()`, the web picker's "Count me in" door: records demand in the `premium_interest` D1 table (one row/account, the §6 go/no-go signal) and emails the founder once on first insert (`SK-IDEMP-006`); not a waitlist/gate (`GLOBAL-027` holds); web-only, CLI/MCP keep "coming soon". Everything else in the preset-parity set shipped: the `model` param + routing on `/v1/ask`, SDK `model`, CLI `--model`, `<nlq-data model>`, MCP `model` (`SK-PREMIUM-014`); BYOLLM lanes + picker/catalog per `SK-PREMIUM-008`/`012`/`013`.
- **Create/DDL router scope — Resolved (GLOBAL-033, UX/simplicity):** `SK-PREMIUM-014`'s "never a silent downgrade" does **not** extend to the create/DDL router. The `model` preset is scoped to the analytical `/v1/ask` *query* path (`selectDispatchLane`); schema inference + DDL compilation (`db-create/build-deps.ts` wires `getLLMRouter()` — the strict-$0 chain — unconditionally, ignoring preset and stored key) is a structural generation task guarded by the classifier confidence floor + the DDL validator (`sql-validate-ddl.ts`), well within free-chain competence with no measured accuracy gain from a frontier/BYOLLM lane. Because the preset's contract (`SK-PREMIUM-003`/`SK-PREMIUM-014`) never claimed to govern provisioning, the free chain there is out-of-scope, not a downgrade — so no 409 and no trace note. Routing a one-shot create through the user's BYOLLM key would spend their tokens for zero benefit (P5).
- **Founder-funded frontier lane vs `best` — Resolved (GLOBAL-033, cost-control):** the `SK-FRONTIER-001` lane does **not** satisfy `model: "best"` — a keyless user still 409s `model_unavailable`. Two code-confirmed grounds: (1) it's an **auto/free-path augmentation** (`ask/frontier-router.ts` runs only when no BYOLLM lane was selected and only upgrades the free path), so a keyless user already gets it on `auto` — they never needed `best`; (2) its availability is non-deterministic (per-tier budget → KV `"none"` → `null`; `SK-FRONTIER-004` excludes e2e/synthetic/preview), so gating `best` on it would flap the contract and let any caller drain scarce founder budget on demand. `best` stays the deterministic entitlement (own BYOLLM key or a live hosted-premium lane, else 409); the founder lane lifts `auto` silently-*upward*, never the downgrade `SK-PREMIUM-014` forbids.
- **Parked until `quality-eval` Phase 2:** `nlqdb.plan.quality_score` histogram (shape + judge prompt + CI) — the CTA's quality-delta pull depends on it.
- **Tracked GLOBAL-003 gaps (this slice):**
  - **Per-key spend-cap UI + per-(DB, key) grain — parked.** `SK-PREMIUM-006` is enforced server-side (`cap.ts`: warn 80%, hard fall-through 100%, `evaluateCap`), but v1 tracks overage spend at the (customer, period) grain with the default `$10` cap constant; the per-(DB, key) stored/adjustable cap and its dashboard (API-keys + DB-settings pages) are deferred. `users.overflow_policy` ships (default `"meter"`); its dashboard toggle (SK-PREMIUM-011) is deferred with the cap UI.
  - **CLI / MCP hosted-premium door — "coming soon".** The `model` preset (`SK-PREMIUM-014`) rides every surface, but the subscribe door is web-only this slice; CLI and MCP keep "coming soon". Restated in `cli/FEATURE.md` and `mcp-server/FEATURE.md`.
  - **Hosted-premium dispatch principal set — `sk_live_` / `sk_mcp_` landed (`SK-PREMIUM-018`); `pk_live_` excluded by design.** The `/v1/ask` premium lane now gates on `isPremiumEligiblePrincipalKind(principal.kind)` — `user` + `sk_live_` + `sk_mcp_` route to hosted premium on a paid account, keyed by the `sk_*` `tenant_id` (== account user id). `pk_live_` stays out (browser-exposed publishable key) and `anon` has no account. Cost is bounded by the per-key spend cap (`SK-PREMIUM-006`); the per-(DB, key) *adjustable* cap + its dashboard remain parked above, but the default `$10` cap already ceilings the newly-admitted `sk_*` callers. BYOLLM keys still ride every principal kind.
  - **Usage/billing surface is web-only — SDK/CLI/MCP parity parked.** The `/app/billing` page + `GET /v1/billing/usage` (plan + current-period `{ included, consumed, overage }`) ship on the web surface only, same GLOBAL-003 exception as the SK-STRIPE-008/009 checkout/portal/status reads. Programmatic surfaces already receive per-request allowance state in the `/v1/ask` response `premium` trace (SK-PREMIUM-009), so an SDK/CLI/MCP `getUsage()` is redundant wiring, not shipped this slice; add it when a persona test asks a programmatic caller to render a live allowance meter.
  - **Per-key `default_model` — programmatic set surfaces parked (`SK-PREMIUM-019`).** The dashboard sets the per-key default via `POST /v1/keys/:id/default-model`, but the SDK (`client.setKeyDefaultModel()` + a `KeyRecord.defaultModel` field), CLI (`nlq keys default-model <id> <auto|fast|best>`), and MCP set-default verbs are not built this slice. Reading the value already rides `GET /v1/keys` on the wire (the web reads it via runtime passthrough; the SDK `KeyRecord` type doesn't yet declare it). The `/v1/ask` *application* of the stored default is fully cross-surface (any `sk_*` caller inherits it), so only the *management* verb is web-only. Track in `sdk/FEATURE.md`, `cli/FEATURE.md`, `mcp-server/FEATURE.md`.
  - **Hard-ceiling *pre-dispatch* refusal — deferred.** `guardrails.checkHardCeiling` (413 + the one-sentence GLOBAL-012 message) and `sizedBucket` are implemented and unit-tested, and the soft-cap slot multiplier is wired end-to-end (`settlePremiumQuery` charges `ceil(tokens/50k)` slots on measured usage, bounding cost proportionally). Calling `checkHardCeiling` *before* dispatch needs a schema-aware token pre-count the handler doesn't assemble today; the lane went live 2026-08-14, so this is now due.
- **Parked to Enterprise:** reseller / agency consolidated billing — v1 is per-account only.
