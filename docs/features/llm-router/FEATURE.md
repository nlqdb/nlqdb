---
name: llm-router
description: Model selection, fallback chain, prompt strategy, per-user credit accounting.
when-to-load:
  globs:
    - packages/llm/**
  topics: [llm, router, model-selection, fallback, prompts, credits]
---

# Feature: Llm Router

**One-liner:** Model selection, fallback chain, prompt strategy, per-user credit accounting; three permanent dispatch lanes per [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md) — free chain forever, BYOLLM every tier (0% markup), hosted-premium on paid (§6-gated Shape B meter).
**Status:** implemented for the free chain (`SK-LLM-001..015`). `SK-LLM-016` (BYOLLM) and `SK-LLM-017` (hosted-premium chain) land in Phase 2 alongside `quality-eval`; the premium-chain meter stays dark until [`phase-plan.md §6`](../../phase-plan.md) trips.

**Contribution to north-star:** Engine quality — the router is the NL→SQL accuracy lever per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md). Free-chain scaffolding compounds when BYOLLM or hosted-premium swaps in a frontier model; `quality-eval`'s free-vs-frontier delta measures the compounding.

**Owners (code):** `packages/llm/**`
**Cross-refs:** docs/architecture.md §7 (AI model selection), §7.1 (Strict-$0) · docs/performance.md §4 Slice 4, §2.2 (cache-miss latency), §3 (span/metric catalog) · `docs/features/hosted-db-create/FEATURE.md` (SK-HDC-001/002 route through this router)

## Touchpoints — read this feature before editing

- `packages/llm/**`

## Decisions

### SK-LLM-001 — Tiered routing — never send all traffic to a frontier model

- **Decision:** LLM traffic is split across tiers by job: hot-path routing (Tier 1, cheap nano), schema embedding (Tier 1), NL→plan workhorse (Tier 2, ~80% of cost), hard-plan / multi-engine reasoning (Tier 3, ≤5%), result summarization (Tier 1). Each tier names a specific model for paid and a free fallback. Frontier models never receive all traffic.
- **Core value:** Free, Fast, Bullet-proof
- **Why:** A flat "use the best model for everything" policy turns every route-or-summarize step into a Sonnet-priced call. Tiering captures the reality that 80%+ of LLM calls are cheap intents (route the request, summarize 5 rows) where a nano model is indistinguishable in quality from a frontier model. The plan tier is where quality matters, and that's where we spend the money.
- **Consequence in code:** The router exposes operations `{route, plan, summarize, schema_infer, engine_classify}` today, with `hard` and `embed` planned. Callers pass the operation they need; the router chooses the model. New operations require a `SK-LLM-NNN` decision (e.g. `SK-LLM-012` for `schema_infer`) and a row in the catalog at `docs/performance.md §3.1` + `docs/architecture.md §7`. Sending all traffic to one model is a CI-asserted regression (cost-test).
- **Alternatives rejected:** Always-frontier — predictable bills that scale linearly with traffic. Always-cheapest — `nl→plan` accuracy collapses below the 70% bar; per-call manual model pick leaks model decisions into 50 call sites.

### SK-LLM-002 — Single adapter: `(tier, prompt, options) → response` over a cost-ordered provider chain

- **Decision:** Every LLM call routes through one `packages/llm/` adapter (`createLLMRouter()`). The adapter takes a `tier` and a cost-ordered provider chain; the chain is "swappable via env var" (per `docs/architecture.md §7.1`). No application code calls a provider SDK directly.
- **Core value:** Simple, Bullet-proof, Free
- **Why:** Direct provider SDK calls in handler code lock the provider into the call site — every retry, fallback, span, prompt-cache decision must be re-implemented per call site. One adapter means one place to add a provider, one place to wire `gen_ai.*` semconv attributes, one place to enforce circuit-breaker behaviour. It is also the precondition for the `chains: { free, paid }` selector below (`SK-LLM-007`).
- **Consequence in code:** Handlers call `router.invoke({tier, prompt, ...})`. Provider implementations live in `packages/llm/src/providers/*.ts` and are added by name to the chain config. Direct imports of `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` outside `packages/llm/` fail review.
- **Alternatives rejected:** Per-handler provider pick — every handler owns its own retry/fallback. Provider-router-per-tier (multiple routers) — three places to add a new provider.

### SK-LLM-003 — Day-1 strict-$0 chain: Gemini Flash → Groq → Workers-AI → OpenRouter free

- **Decision:** Until startup credits land, the `plan` tier chain is `[gemini_flash_free, groq_llama70b_free, openrouter_free]` (with `workers_ai` as a non-US backup). The `route` tier uses `groq_llama8b_free` with `workers_ai` as the geo backup. Embeddings use Workers AI bge-base-en-v1.5. The chain is configured via env var, not code.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Every provider in the chain has a no-card free tier (per `docs/architecture.md §7.1`): Gemini 500 RPD plan / 250k TPM, Groq 14,400 RPD on 8B / 1,000 RPD on 70B, Workers AI 10k Neurons/day, OpenRouter 50 RPD anon / 1,000 RPD after a one-time $10 deposit. Stacked, this gives ~500 plan generations + ~14,400 routings per day — comfortably above Phase 1's exit criteria after the plan cache (60–80% hit rate). Card-free is the activation guarantee in `GLOBAL-013`.
- **Consequence in code:** Day-1 deploy reads `LLM_CHAIN_PLAN`, `LLM_CHAIN_ROUTE`, `LLM_CHAIN_SUMMARIZE` env vars; defaults are the strict-$0 chain. All four free providers are implemented in `packages/llm/src/providers/`; rotating the chain is a redeploy, not a code change.
- **Alternatives rejected:** Single free provider — one outage kills the product. Wait for credits — punts launch by weeks; `docs/architecture.md §0` says we ship without spending money.

### SK-LLM-004 — Cloudflare AI Gateway sits in front of every paid provider

- **Decision:** Every paid-provider call routes through Cloudflare AI Gateway URLs (`gateway.ai.cloudflare.com/v1/{acc}/{gw}/{provider}/...`). The gateway provides identical-prompt caching (sub-100 ms hits), per-provider quotas, and a single observability surface across providers.
- **Core value:** Free, Fast, Honest latency
- **Why:** AI Gateway's prompt cache lands sub-100 ms responses on identical prompts (huge win for the same-question-twice pattern). It also gives us one log surface across Anthropic / OpenAI / Gemini, which is the only realistic way to compare provider quality at runtime (see `nlqdb.plan.quality_score` in `docs/features/llm-router/FEATURE.md`). The gateway costs nothing on the Free plan.
- **Consequence in code:** Provider implementations accept a `baseUrl` / `endpoint` override; production config sets it to the gateway URL. `AI_GATEWAY_ACCOUNT_ID` + `AI_GATEWAY_ID` are env-driven. Free providers (Groq, Gemini Flash on its free key, Workers AI) hit their direct endpoints; paid providers go through the gateway.
- **Alternatives rejected:** Direct provider SDKs — loses the prompt cache and the unified log surface. Self-built proxy — re-implements what the gateway does for $0.

### SK-LLM-005 — Circuit breaker: skip flapping provider after 3 consecutive failures, 60 s cooldown

- **Decision:** The router maintains per-provider failure state. After 3 consecutive failures the provider is skipped for the next 60 s (cooldown). After cooldown, the provider is retried on the next eligible call; success resets the counter.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** Without a circuit breaker, a provider that's down still costs us a connect-timeout per call before we fall through. With it, the second call after a known failure skips straight to the next provider — sub-100 ms switch (per `docs/architecture.md §7.1`). The 3-failure / 60-s threshold is calibrated against transient provider rate-limit blips that resolve quickly without taking the whole tier offline.
- **Consequence in code:** `createLLMRouter({circuitBreaker: {failureThreshold: 3, cooldownMs: 60_000}})`. Failure-counter state lives in the Worker instance (eventual cross-instance through KV is on the table but not required). A "skip" emits `nlqdb.llm.failover.total{from_provider, to_provider, reason: "circuit_open"}`.
- **Alternatives rejected:** No circuit breaker — every call to a downed provider pays the timeout. Aggressive (1-failure trip) — single transient failure flaps every provider at peak. Permanent open until manual reset — operators have to babysit.

### SK-LLM-006 — `gen_ai.*` OTel semconv on every LLM span; spans use canonical names from the catalog

- **Decision:** Every LLM call emits an OTel span using the canonical names from `docs/performance.md §3.1` (`llm.route`, `llm.plan`, `llm.summarize`, `llm.schema_infer`, `llm.engine_classify`) with `gen_ai.system`, `gen_ai.request.model`, `gen_ai.response.model` attributes (OTel semconv 1.37). Provider, model, operation, and outcome are first-class labels; cardinality budgets are in `docs/performance.md §3.3`.
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** The runtime decision of "which provider answered this call" is invisible without spans — and that is the most expensive question to answer the wrong way (a provider quality drop costs accuracy across every cache miss). `gen_ai.*` semconv is the cross-vendor standard that lets dashboards in Grafana / Honeycomb / Axiom share one schema. The explicit cardinality budget keeps Grafana free-tier costs flat.
- **Consequence in code:** `packages/llm/src/router.ts` wraps every provider call in the canonical span with `gen_ai.*` attributes and increments `nlqdb.llm.calls.total{provider, operation, status}` plus `nlqdb.llm.duration_ms{provider, operation}`. Failovers emit `nlqdb.llm.failover.total{from_provider, to_provider, reason}`. New providers must wire these emissions before merge (CI assertion).
- **Alternatives rejected:** Custom attribute names — fragments dashboards within a quarter (`GLOBAL-014`). Skip spans on the free providers — same cost-saving fantasy as sample-only-slow-requests; loses the baseline distribution.

### SK-LLM-007 — Tier-aware chain selector: `priority` + user plan picks `free` vs `paid` chain

- **Decision:** Once paid keys land, the router gains a chain selector with `chains: {free: ProviderName[]; paid: ProviderName[]}`. Per request, the router picks `paid` when (`request.priority === 'high'`) or (user's plan = paid); otherwise `free`. Paid users default to `high`; `/v1/health` and similar low-stakes paths default to `low`.
- **Core value:** Free, Honest latency, Goal-first
- **Why:** Paid users buy quality — they should never silently route through a free 70%-accurate model on plan generation. Free users get the strict-$0 chain, which their plan caches absorb most of the latency cost of. The `priority` hint lets the surfaces signal intent (chat = high; CI probe = low) so a noisy CI doesn't burn paid credits.
- **Consequence in code:** `LLMRouterOptions.chains` is a `{free, paid}` object. `chooseChain(request)` is a pure function tested in isolation. `LLM_CHAIN_PLAN_FREE` and `LLM_CHAIN_PLAN_PAID` env vars override the defaults. The CLI's `nlq ask` carries the priority hint via the request body (`nlq run` skips the router entirely — it's the raw-SQL escape hatch).
- **Alternatives rejected:** One chain everyone shares — paid users subsidise free users with their dollars buying free-model accuracy. Per-user explicit chain config — operator footgun; users don't know what to pick.

### SK-LLM-008 — Pro customers route only through paid / retention-off providers (data-privacy promise)

- **Decision:** Free-tier providers may train on inputs (per their terms); we disclose this in our privacy policy. **Pro customers** route exclusively through paid providers configured for retention-off (Anthropic / OpenAI on their retention-off plans, Bedrock with default retention-off). This is the one meaningful free→paid capability upgrade.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** "Your data trains models" is fine for the demo path (and disclosed honestly), but a non-starter for any business asking us to query real data. Hard-routing Pro through retention-off providers turns the privacy story from a footnote into a contract. It's also the cleanest justification for the upsell — you're paying for the data-privacy boundary, not just for higher accuracy.
- **Consequence in code:** `chooseChain(req)` for `plan === 'pro'` filters out any provider whose `retainsInputs === true`. Provider config carries the boolean explicitly; PRs that flip it without changing the privacy policy fail review. Tests assert no Pro request reaches a free-tier provider.
- **Alternatives rejected:** Same chain for everyone with a privacy-policy disclaimer — the policy is true for the free tier; it's not the product story we want to sell. Per-user opt-out — adds a privacy lever the user has to operate; we'd rather just hold the line.

### SK-LLM-009 — Prompt caching on every provider that supports it (~80% input reduction)

- **Decision:** Every paid-provider call uses the provider's prompt-caching feature (Anthropic prompt caching, OpenAI cached tokens, Gemini context caching, AI Gateway response cache). System prompts and few-shot examples are written once per chain so the cache hits.
- **Core value:** Free, Fast, Honest latency
- **Why:** System-prompt + schema-context tokens dominate input cost on the plan tier. Provider prompt caching (paired with AI Gateway response caching) cuts ~80% of input cost on repeated patterns (per `docs/architecture.md §7` cost-control rule 3). Without it, we burn credit on the same system prompt thousands of times a day.
- **Consequence in code:** Every `tier=plan` call passes `cache_control: ephemeral` markers (Anthropic) or equivalent (`extra_headers: { "x-cache-namespace": ... }`) into the request. The system-prompt is constructed from a single immutable template (per `SK-LLM-010`); changes to the template invalidate the cache, which is the intended behaviour.
- **Alternatives rejected:** Skip prompt caching — pays full input price on every call; budget runs out in days. Custom in-Worker caching of prompts only — re-implements provider features at the wrong layer.

### SK-LLM-010 — Plan cache first, LLM second (cost-control rule #1)

- **Decision:** Every `/v1/ask` request consults the plan cache before any LLM call. The expected steady-state cache hit rate is 60–80% (`docs/architecture.md §7`); cache-warming is a deliberate step on first-deploy. The LLM router never bypasses the plan cache.
- **Core value:** Free, Fast, Honest latency
- **Why:** A frontier-model plan call is the most expensive operation on the hot path. The plan cache turns that cost into a one-time-per-`(schema_hash, query_hash)` event. Skipping the cache to "save a hop" is penny-wise; LLM cost dominates at every traffic level. This is also the single highest-leverage cost lever we have.
- **Consequence in code:** The ask-pipeline order in `SK-ASK-002` puts plan-cache lookup before any `llm.*` span. Tests assert that a second identical request hits the cache (no `llm.plan` span emitted). The router's API exposes no "skip-cache" flag; force-replan is a `query_hash` salt at the ask layer (`SK-PLAN-005`).
- **Alternatives rejected:** Cache only on second hit — wastes the first call; same cost as no-cache for a one-shot query. Cache off for "expensive" queries — every cached-but-expensive plan would be the one we discarded.

### SK-LLM-011 — Self-host the cheap-tier router once we hit ~50 k queries/day

- **Decision:** When traffic crosses ~50 k queries/day, we self-host the cheap-tier `route` (and `engine_classify`) calls on a single A10G on Modal (quantized 8B Llama). Cost: ~$200/mo flat. Plan and hard tiers stay on hosted providers indefinitely.
- **Core value:** Free, Bullet-proof, Open source
- **Why:** At ~50 k queries/day, cheap-tier hosted cost crosses the flat-Modal threshold. Self-hosting turns a per-call cost into a fixed cost and removes an external dependency from the hottest path. Plan-tier compute is too uneven to self-host economically — we stay on hosted providers there.
- **Consequence in code:** Provider implementation `modal_llama8b` already lands behind a feature flag; flipping the flag rolls `route` traffic over. Failover chain stays Groq → Modal → Workers-AI so a Modal outage doesn't degrade routing accuracy. The 50k/day threshold is dashboard-monitored.
- **Alternatives rejected:** Self-host plan tier — bursty plan workloads cost more on flat A10G than on per-call paid. Stay on hosted forever — once we hit 200k/day cheap-tier cost crosses $1k/mo.

### SK-LLM-012 — `schema_infer` is a distinct router operation, not an alias of `plan`

- **Decision:** Hosted db.create's schema-inference call is its own router operation (`router.schemaInfer(...)` → span `llm.schema_infer`), not a re-use of `plan`. The two share the planner-tier provider chain and model defaults, but they ship distinct system prompts (`packages/llm/src/prompts/schema-inference.ts` vs the SQL-shaped `PLAN_SYSTEM`), distinct request shapes (`{goal}` vs `{goal, schema, dialect}`), and distinct response shapes (`{plan: Record<string, unknown>}` vs `{sql: string}`).
- **Core value:** Honest latency, Bullet-proof, Simple
- **Why:** `plan` is the hot-path NL→SQL operation on every cache-miss `/v1/ask`; `schema_infer` runs once per database, ever. Folding them under one op forces shared prompt + span + dashboards onto two ops with different cost profiles, latency budgets (`schema_infer` 8000 ms vs `plan` 5000 ms), and quality requirements (typed-plan emit vs SQL emit). The distinct span name `llm.schema_infer` is what hosted-db-create's GLOBAL-014 commentary calls out.
- **Consequence in code:** `packages/llm/src/types.ts` carries `SchemaInferRequest`/`SchemaInferResponse`; `LLMOperation` includes `"schema_infer"`; every chat provider has a `schema_infer` row (planner-tier). Responses parsed via `parseJsonResponse` and wrapped as `{plan: parsed}` so the shape is uniform.
- **Alternatives rejected:** Reuse `plan` and stuff schema-inference into the goal field (couples SQL-shaped `PLAN_SYSTEM` to non-SQL response; misleading `llm.plan` span). Route to `hard` (reserved for hard-plan / multi-engine, SK-LLM-001). Call providers directly (violates SK-LLM-002 — re-implements failover/circuit-breaker/spans per call site).

### SK-LLM-014 — Hedged-request race on free-tier chains for planner-tier ops

**Body:** [`decisions/SK-LLM-014-hedged-request-race.md`](./decisions/SK-LLM-014-hedged-request-race.md).
`LLMRouterOptions.hedge` opts an op into a two-way hedged race after `afterMs` head-start; loser aborted with `HEDGE_LOST` so the breaker doesn't trip on the cancel. Free-tier chains only. Production wires `schema_infer` + `plan` at `afterMs: 800`. Empirical (trace `285b805cee6e2688768d9ffcd75a86fe`): ~5 s saved on the bad case, unchanged on the happy case. Cites Dean & Barroso "Tail at Scale" (CACM 2013) — trade ~1.05× provider RPS for the timeout-tail. Alternatives rejected: always-hedge (1.5× waste), lower per-attempt timeout (same tail), hedge on paid chains (doubles per-token bill), race-all (combinatorial waste).

### SK-LLM-016 — BYOLLM dispatch lane: per-request override → account-stored → hosted-premium → free

**Body:** [`decisions/SK-LLM-016-byollm-dispatch.md`](./decisions/SK-LLM-016-byollm-dispatch.md).
Four-step dispatch precedence per `GLOBAL-026`: per-request `x-nlq-byollm-key` header → account-stored key → hosted-premium → free. Routes through AI Gateway namespace `BYOLLM_<user_id>`; failures fail loud per `GLOBAL-012`. Key-handling in [`SK-PREMIUM-008`](../premium-tier/decisions/SK-PREMIUM-008-byollm.md).

### SK-LLM-017 — Hosted-premium chain: separate provider list, §6-gated meter, never available on free

**Body:** [`decisions/SK-LLM-017-hosted-premium-chain.md`](./decisions/SK-LLM-017-hosted-premium-chain.md).
Third chain alongside `free` and `paid`: **`premium`** = Sonnet 4.6 + GPT-5 + Gemini 2.5 Pro. Fires only when `principal.tier !== "free"` AND (`model === "best"` or auto-classified hard-plan) AND `PREMIUM_METER_LIVE` (§6-gated). Pre-§6 dark; trace surfaces `pending_premium_launch: true`. Shape B commercial form in [`SK-PREMIUM-009`](../premium-tier/decisions/SK-PREMIUM-009-hosted-premium-meter.md).

### SK-LLM-015 — OpenRouter code-gen ops default to `qwen/qwen3-coder:free`

- **Decision:** OpenRouter pins `plan` and `schema_infer` to `qwen/qwen3-coder:free` (480B MoE, 1M context); `route` / `summarize` / `engine_classify` stay on Llama `:free`.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Qwen-Coder lineage hits ~96% on text-to-SQL vs ~88% for Llama 3.3 70B, and 1M context fits goal+schema without truncation — strictly better on the two code-gen ops where OpenRouter actually fires.
- **Consequence in code:** `packages/llm/src/providers/openrouter.ts` `DEFAULT_MODELS` change only; chain order in `apps/api/src/llm-router.ts` unchanged (OpenRouter stays universal fallback per SK-LLM-003).
- **Alternatives rejected:** Promote OpenRouter to chain head (unmeasured latency through provider routing — defer to `quality-eval`); Qwen3-Coder for all five ops (overkill latency on cheap-tier ops); stay on Llama 3.3 70B (leaves ~8 accuracy points on the table on the operation we cache hardest).

### SK-LLM-013 — `PlanResponse` carries `model` + `confidence` for SK-TRUST-002

**Body:** [`decisions/SK-LLM-013-plan-response-shape.md`](./decisions/SK-LLM-013-plan-response-shape.md) (relocated unchanged). `PlanResponse` widens to `{ sql, model, confidence }`; `confidence` ships as a `1.0` placeholder until `quality-eval` calibrates per-tier floors per `SK-TRUST-003`. `nlqdb.cache.plan.write` stores both fields so cache-hits return the original miss's values.

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
- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid (flat sub + included monthly request allowance + soft-meter overage, 0% markup).
  - *In this feature:* owns dispatch precedence (`SK-LLM-016`) and the hosted-premium chain wiring (`SK-LLM-017`); commercial shape in `premium-tier/FEATURE.md`.

## Open questions / known unknowns

- **`nlqdb.plan.quality_score` shape and threshold.** `docs/features/llm-router/FEATURE.md` proposes a `(1 = clean, 0.5 = needed correction loop, 0 = rejected)` histogram. The exact bucket boundaries, the LLM-as-judge prompt, and the alert threshold for "this provider is silently degrading" are not yet specified.
- **Prompt-template version pinning.** `SK-LLM-009` says system-prompt changes invalidate the prompt cache (intended). We don't yet have a place to record which template version produced which plan — a future debugging need. Open.
- **Per-user credit accounting.** The feature description mentions "per-user credit accounting" but `docs/architecture.md §7` and `docs/features/llm-router/FEATURE.md` cover provider-level cost, not per-user usage metering. Lago is in `docs/architecture.md §6`'s stack as the metering backbone; the wiring from LLM router → Lago is not yet specified.
- **Failover behaviour when every provider in a chain fails.** Today the chain falls through providers; what happens when the last one fails? Bubble up an error envelope (per `GLOBAL-012`)? Retry the head with backoff? The router currently throws; the user-facing error semantics are open.
- **Free-tier RPM ceiling visibility.** `docs/architecture.md §7.1` says "bursts queue briefly; 'queued — 2s' surfaced in UI." The queue mechanism is not yet implemented in the router; today bursts that exceed the provider's RPM fail-and-fall-through. Track in the rate-limit / observability features.
