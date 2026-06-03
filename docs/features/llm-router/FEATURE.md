---
name: llm-router
description: Model selection, fallback chain, prompt strategy, per-user credit accounting.
when-to-load:
  globs:
    - packages/llm/**
  topics: [llm, router, model-selection, fallback, prompts, credits]
---

# Feature: Llm Router

**One-liner:** Model selection, fallback chain, prompt strategy, per-user credit accounting; three permanent dispatch lanes per [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md) — free chain, BYOLLM, hosted-premium.
**Status:** implemented for the free chain (`SK-LLM-001..015` + `SK-LLM-018`). BYOLLM (`SK-LLM-016`) is partial — provider factory (`SK-LLM-019`) + lane selector / single-provider lane router (`SK-LLM-020`) ship, the per-request `x-nlq-byollm-key` header lane is wired on HTTP `/v1/ask` (`SK-LLM-021`), and the account-stored lane (step 2) now resolves on `/v1/ask` via `api_keys` `scope = "byollm"` ([`SK-PREMIUM-012`](../premium-tier/decisions/SK-PREMIUM-012-account-stored-byollm-storage.md)); `GLOBAL-003` surface parity (MCP/SDK/CLI/elements/`/app/keys`) remains pending (tracked in `premium-tier/FEATURE.md` Open questions). `SK-LLM-017` (hosted-premium chain) lands in Phase 2 alongside `quality-eval`; the premium-chain meter stays dark until [`phase-plan.md §6`](../../phase-plan.md) trips.

**Contribution to north-star:** Engine quality — the router is the NL→SQL accuracy lever per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md). Free-chain scaffolding compounds when BYOLLM or hosted-premium swaps in a frontier model; `quality-eval`'s free-vs-frontier delta measures the compounding.

**Owners (code):** `packages/llm/**`
**Cross-refs:** docs/architecture.md §7, §7.1 · docs/performance.md §4 Slice 4, §2.2, §3 · `docs/features/hosted-db-create/FEATURE.md` (SK-HDC-001/002 route through this router)

## Touchpoints — read this feature before editing

- `packages/llm/**`

## Decisions

### SK-LLM-001 — Tiered routing — never send all traffic to a frontier model

**Body:** [`decisions/SK-LLM-001-tiered-routing.md`](./decisions/SK-LLM-001-tiered-routing.md).
LLM traffic is split across tiers by job (cheap-nano route/summarize, planner-tier `plan`/`schema_infer`, hard-plan Tier 3); each tier names a paid model + free fallback. Frontier models never receive all traffic; one-model-for-all is a CI-asserted cost regression.

### SK-LLM-002 — Single adapter: `(tier, prompt, options) → response` over a cost-ordered provider chain

**Body:** [`decisions/SK-LLM-002-single-adapter.md`](./decisions/SK-LLM-002-single-adapter.md).
Every LLM call routes through one `createLLMRouter()` adapter over a cost-ordered, env-swappable provider chain; no application code calls a provider SDK directly (direct `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` imports outside `packages/llm/` fail review). Precondition for the `{free, paid}` selector (`SK-LLM-007`).

### SK-LLM-003 — Day-1 strict-$0 chain: Gemini Flash → Groq → Workers-AI → OpenRouter free

**Body:** [`decisions/SK-LLM-003-strict-zero-chain.md`](./decisions/SK-LLM-003-strict-zero-chain.md).
`plan` chain `[gemini_flash_free, groq_llama70b_free, openrouter_free]` (+`workers_ai` non-US backup); `route` on `groq_llama8b_free`. Every entry has a no-card free tier (`GLOBAL-013` card-free guarantee); env-var configured (`LLM_CHAIN_*`), rotating is a redeploy.

### SK-LLM-004 — Cloudflare AI Gateway sits in front of every paid provider

**Body:** [`decisions/SK-LLM-004-ai-gateway-paid.md`](./decisions/SK-LLM-004-ai-gateway-paid.md).
Every paid-provider call routes through Cloudflare AI Gateway (`gateway.ai.cloudflare.com/v1/{acc}/{gw}/{provider}/…`) for sub-100 ms identical-prompt caching, per-provider quotas, and one observability surface. Providers accept a `baseUrl` override (`AI_GATEWAY_ACCOUNT_ID`/`AI_GATEWAY_ID` env-driven); gateway is $0 on the Free plan.

### SK-LLM-005 — Circuit breaker: skip flapping provider after 3 consecutive failures, 60 s cooldown

**Body:** [`decisions/SK-LLM-005-circuit-breaker.md`](./decisions/SK-LLM-005-circuit-breaker.md).
Per-provider failure state: 3 consecutive failures → skip for 60 s, then retry on the next eligible call (success resets). `createLLMRouter({circuitBreaker: {failureThreshold: 3, cooldownMs: 60_000}})`; a skip emits `nlqdb.llm.failover.total{…, reason: "circuit_open"}`. State is per-Worker-instance.

### SK-LLM-006 — `gen_ai.*` OTel semconv on every LLM span; spans use canonical names from the catalog

**Body:** [`decisions/SK-LLM-006-otel-semconv.md`](./decisions/SK-LLM-006-otel-semconv.md).
Every LLM call emits a canonical-named span (`llm.route`/`plan`/`summarize`/`schema_infer`/`engine_classify`) with `gen_ai.*` semconv 1.37 attributes; `router.ts` increments `nlqdb.llm.calls.total` / `duration_ms` / `failover.total`. Cardinality budgets in `docs/performance.md §3.3`; new providers wire emissions before merge (CI-asserted, `GLOBAL-014`).

### SK-LLM-007 — Tier-aware chain selector: `priority` + user plan picks `free` vs `paid` chain

**Body:** [`decisions/SK-LLM-007-tier-aware-selector.md`](./decisions/SK-LLM-007-tier-aware-selector.md).
`chains: {free, paid}` selector: pick `paid` when `priority === 'high'` or plan is paid, else `free`. `chooseChain(request)` is a pure, isolated function; `LLM_CHAIN_PLAN_FREE`/`_PAID` override defaults. Paid users never silently route through a free 70%-accurate model.

### SK-LLM-008 — Pro customers route only through paid / retention-off providers (data-privacy promise)

**Body:** [`decisions/SK-LLM-008-pro-retention-off.md`](./decisions/SK-LLM-008-pro-retention-off.md).
Pro customers route exclusively through retention-off paid providers; `chooseChain(req)` filters out any provider with `retainsInputs === true`, and tests assert no Pro request reaches a free-tier provider. Turns the data-privacy story from a footnote into the one meaningful free→paid upgrade.

### SK-LLM-009 — Prompt caching on every provider that supports it (~80% input reduction)

**Body:** [`decisions/SK-LLM-009-prompt-caching.md`](./decisions/SK-LLM-009-prompt-caching.md).
Every paid-provider call uses the provider's prompt-caching feature (Anthropic `cache_control`, OpenAI cached tokens, Gemini context caching, AI Gateway response cache) — system prompts written once per chain so the cache hits, cutting ~80% of plan-tier input cost.

### SK-LLM-010 — Plan cache first, LLM second (cost-control rule #1)

**Body:** [`decisions/SK-LLM-010-plan-cache-first.md`](./decisions/SK-LLM-010-plan-cache-first.md).
Every `/v1/ask` consults the plan cache before any LLM call (60–80% steady-state hit rate); the router never bypasses it and exposes no skip-cache flag. The single highest-leverage cost lever — a frontier plan call becomes a one-time-per-`(schema_hash, query_hash)` event.

### SK-LLM-011 — Self-host the cheap-tier router once we hit ~50 k queries/day

**Body:** [`decisions/SK-LLM-011-self-host-cheap-tier.md`](./decisions/SK-LLM-011-self-host-cheap-tier.md).
At ~50 k queries/day, self-host cheap-tier `route` / `engine_classify` on a single Modal A10G (quantized 8B Llama, ~$200/mo flat); plan + hard tiers stay hosted. `modal_llama8b` lands behind a flag; failover stays Groq → Modal → Workers-AI. Threshold is dashboard-monitored.

### SK-LLM-012 — `schema_infer` is a distinct router operation, not an alias of `plan`

**Body:** [`decisions/SK-LLM-012-schema-infer-op.md`](./decisions/SK-LLM-012-schema-infer-op.md).
`schema_infer` is its own router op (`router.schemaInfer` → span `llm.schema_infer`), not a `plan` alias — shares the planner chain but ships distinct prompt / request / response shapes and an 8000 ms budget (vs `plan`'s 5000 ms). Runs once per DB, ever.

### SK-LLM-014 — Hedged-request race on free-tier chains for planner-tier ops

**Body:** [`decisions/SK-LLM-014-hedged-request-race.md`](./decisions/SK-LLM-014-hedged-request-race.md).
`LLMRouterOptions.hedge` opts an op into a two-way hedged race after `afterMs` head-start; loser aborted with `HEDGE_LOST` so the breaker doesn't trip on the cancel. Free-tier chains only; production wires `schema_infer` + `plan` at `afterMs: 800` (~5 s saved on the bad case, unchanged on the happy case). Rationale (Dean & Barroso "Tail at Scale", CACM 2013), empirical trace, and alternatives in the sharded body.

### SK-LLM-016 — BYOLLM dispatch lane: per-request override → account-stored → hosted-premium → free

**Body:** [`decisions/SK-LLM-016-byollm-dispatch.md`](./decisions/SK-LLM-016-byollm-dispatch.md).
Four-step dispatch precedence per `GLOBAL-026`: per-request `x-nlq-byollm-key` header → account-stored key → hosted-premium → free. Routes through AI Gateway; failures fail loud per `GLOBAL-012`. Key-handling in [`SK-PREMIUM-008`](../premium-tier/decisions/SK-PREMIUM-008-byollm.md). Provider half implemented in [`SK-LLM-019`](#sk-llm-019).

### SK-LLM-019 — BYOLLM provider factory: AI Gateway unified endpoint + `cf-aig-cache-key` tenant namespace

**Body:** [`decisions/SK-LLM-019-byollm-provider-factory.md`](./decisions/SK-LLM-019-byollm-provider-factory.md).
`createByollmProvider` builds a `Provider` from the user's own key + model, routed through AI Gateway's OpenAI-compatible `compat/chat/completions` endpoint. Pins key pass-through (0% markup), `<upstream>/<model>` qualifier, and the tenant cache namespace — `SK-LLM-016`'s `BYOLLM_<user_id>` resolves to `cf-aig-cache-key = BYOLLM_<userId>_<sha256(request)>` (prefix isolates tenants; hash keeps caching). Provider primitive only; `GLOBAL-003` parity deferred to the dispatch-wiring PR.

### SK-LLM-020 — BYOLLM lane selector + single-provider lane router

**Body:** [`decisions/SK-LLM-020-byollm-lane-selector.md`](./decisions/SK-LLM-020-byollm-lane-selector.md).
`byollm-dispatch.ts` adds three pure primitives: `selectDispatchLane` (the single source of truth for `SK-LLM-016`'s header→account→premium→free precedence), `buildByollmRouter` (single-provider lane router — no free-chain failover, fail-loud per `GLOBAL-012`), and `dispatchLaneAttributes` (bounded `llm.dispatch_lane` / `llm.billed_to` / `llm.byollm_provider` / `llm.byollm_source` span attributes, key redacted). The package stays free of header/DB/KEK access; `GLOBAL-003` surface parity stays deferred to the dispatch-wiring PR.

### SK-LLM-021 — BYOLLM header wiring on `/v1/ask`: signed-in-only `x-nlq-byollm-key`, fail-loud, free-router fallthrough

**Body:** [`decisions/SK-LLM-021-byollm-header-wiring.md`](./decisions/SK-LLM-021-byollm-header-wiring.md).
`apps/api/src/ask/byollm.ts` wires `SK-LLM-016` step 1 into `/v1/ask`: `parseByollmHeader` (the `<provider>:<model>:<key>` wire format) + `resolveAskRouter` (header credential → `buildByollmRouter`, else the cached free router) + redacted lane attributes on the `nlqdb.ask` span. Signed-in only (anon / API-key principals carrying the header get a one-sentence 400). Accepts the AI Gateway compat slugs `openai` / `anthropic` / `google-ai-studio`. Account-stored keys + `GLOBAL-003` surface parity deferred (tracked in `premium-tier/FEATURE.md`).

### SK-LLM-017 — Hosted-premium chain: separate provider list, §6-gated meter, never available on free

**Body:** [`decisions/SK-LLM-017-hosted-premium-chain.md`](./decisions/SK-LLM-017-hosted-premium-chain.md).
Third chain alongside `free` and `paid`: **`premium`** = Sonnet 4.6 + GPT-5 + Gemini 2.5 Pro. Fires only when `principal.tier !== "free"` AND (`model === "best"` or auto-classified hard-plan) AND `PREMIUM_METER_LIVE` (§6-gated). Pre-§6 dark. Shape B commercial form in [`SK-PREMIUM-009`](../premium-tier/decisions/SK-PREMIUM-009-hosted-premium-meter.md).

### SK-LLM-015 — OpenRouter code-gen ops default to `qwen/qwen3-coder:free`

**Body:** [`decisions/SK-LLM-015-openrouter-codegen-default.md`](./decisions/SK-LLM-015-openrouter-codegen-default.md).
OpenRouter pins `plan` + `schema_infer` to `qwen/qwen3-coder:free`; cheap-tier ops stay on Llama `:free`. Qwen-Coder ≈96% text-to-SQL vs ≈88% Llama 3.3 70B; chain order unchanged (OpenRouter remains universal fallback per `SK-LLM-003`).

### SK-LLM-018 — Schema-fidelity planner prompt + diagnostic retry framing

**Body:** [`decisions/SK-LLM-018-schema-fidelity-prompt.md`](./decisions/SK-LLM-018-schema-fidelity-prompt.md).
`PLAN_SYSTEM` gains schema-literal + verbatim-casing + dialect-strict + `Evidence:`-authoritative directives; `buildPlanUser`'s retry block reframes "different shape" as **diagnose-first, surgical-fix**. Targets the BIRD free-chain gap (0.318 → 0.65 per [`SK-QUAL-005`](../quality-eval/FEATURE.md#sk-qual-005)); evidence base in the sharded body.

### SK-LLM-013 — `PlanResponse` carries `model` + `confidence` for SK-TRUST-002

**Body:** [`decisions/SK-LLM-013-plan-response-shape.md`](./decisions/SK-LLM-013-plan-response-shape.md). `PlanResponse` widens to `{ sql, model, confidence }`; `confidence` ships as a `1.0` placeholder until `quality-eval` calibrates per-tier floors per `SK-TRUST-003`. The plan cache stores both fields so hits return the miss's values.

### SK-LLM-022 — Hard-plan confidence threshold = 0.75 (env-tunable)

**Body:** [`decisions/SK-LLM-022-hard-plan-confidence-threshold.md`](./decisions/SK-LLM-022-hard-plan-confidence-threshold.md). `confidence < 0.75 ⇒ hard_plan = true`; the threshold is env-tunable (`HARD_PLAN_CONFIDENCE_THRESHOLD`). Pins the `SK-LLM-001` "hard" tier and drives the `SK-PREMIUM-004` upsell CTA.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
- **GLOBAL-016** — Reach for small mature packages before DIY; hard-pass on RC on the critical path.
- **GLOBAL-022** — Recoverable failures retry to success — never surface a fixable error.
  - *In this feature:* provider 5xx and provider rate-limit (429) are
    failover signals — fail to the next provider in the chain
    rather than retry the same one. The chain retries up to 3
    hops (one attempt per provider) before propagating the error.
- **GLOBAL-025** — North-star: engine quality, onboarding, UX — each with explicit KPIs.
  - *In this feature:* the router IS the engine north-star's mechanism on the NL→SQL layer; the free-vs-frontier delta KPI runs `quality-eval` against this router's free chain vs its hosted-premium chain.
- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid.
  - *In this feature:* owns dispatch precedence (`SK-LLM-016`) and the hosted-premium chain wiring (`SK-LLM-017`); commercial shape in `premium-tier/FEATURE.md`.

## Open questions / known unknowns

- **Failover when every provider in a chain fails** — Resolved per `GLOBAL-033` (error semantics → `GLOBAL-012`): on chain exhaustion the router throws a structured `provider_chain_exhausted` error envelope (one-sentence, actionable) — it does **not** retry the head with backoff (the head already failed this request; a fresh `/v1/ask` re-enters the chain). Wire the envelope shape when the surfaces render it.
- **Parked until `quality-eval` Phase 2:** `nlqdb.plan.quality_score` histogram shape + LLM-as-judge prompt + "provider silently degrading" alert threshold — depends on the judge harness landing.
- **Parked until Lago wiring (Phase 2):** per-user credit accounting (`architecture.md §6`); provider-level cost is already covered.
- **Parked until a debugging need forces it:** prompt-template version pinning — decided shape is to stamp the template version hash on `PlanResponse` + the plan-cache entry; cheap to add when a plan-provenance question actually arises.
- **Parked until burst abuse shows up:** free-tier RPM queue ("queued — 2s" UX, `architecture.md §7.1`); today bursts over a provider's RPM fail-and-fall-through. Owned jointly with `rate-limit` / `observability`.
