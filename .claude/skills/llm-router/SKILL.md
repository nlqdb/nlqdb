---
name: llm-router
description: Model selection, fallback chain, prompt strategy, per-user credit accounting.
when-to-load:
  globs:
    - packages/llm/**
  topics: [llm, router, model-selection, fallback, prompts, credits]
---

# Feature: Llm Router

**One-liner:** Model selection, fallback chain, prompt strategy, per-user credit accounting.
**Status:** implemented
**Owners (code):** `packages/llm/**`
**Cross-refs:** docs/design.md §8 (AI model selection), §8.1 (Strict-$0 inference path) · docs/llm-credits-plan.md (full file) · docs/implementation.md Slice 4 (LLM router) · docs/performance.md §2.2 (cache-miss latency), §3 (span/metric catalog)

## Touchpoints — read this skill before editing

- `packages/llm/**`

## Decisions

> **Source-range correction.** The DISPATCH index pointed at `docs/design.md §5` for LLM content; §5 in design.md is actually email/marketing. The LLM section is `docs/design.md §8 (AI model selection)`, with the strict-$0 sub-table at §8.1. This skill cites §8 / §8.1 throughout.

### SK-LLM-001 — Tiered routing — never send all traffic to a frontier model

- **Decision:** LLM traffic is split across tiers by job: hot-path classification (Tier 1, cheap nano), schema embedding (Tier 1), NL→plan workhorse (Tier 2, ~80% of cost), hard-plan / multi-engine reasoning (Tier 3, ≤5%), result summarization (Tier 1). Each tier names a specific model for paid and a free fallback. Frontier models never receive all traffic.
- **Core value:** Free, Fast, Bullet-proof
- **Why:** A flat "use the best model for everything" policy turns every classify-or-summarize step into a Sonnet-priced call. Tiering captures the reality that 80%+ of LLM calls are cheap intents (route the request, summarize 5 rows) where a nano model is indistinguishable in quality from a frontier model. The plan tier is where quality matters, and that's where we spend the money.
- **Consequence in code:** The router exposes `tier ∈ {classify, plan, summarize, hard, embed}`; callers pass the tier they need, the router chooses the model. New tiers require a `SK-LLM-NNN` decision and a row in the table at `docs/design.md §8`. Sending all traffic to one model is a CI-asserted regression (cost-test).
- **Alternatives rejected:** Always-frontier — predictable bills that scale linearly with traffic. Always-cheapest — `nl→plan` accuracy collapses below the 70% bar `docs/llm-credits-plan.md` flags. Per-call manual model pick — leaks model decisions into 50 call sites.
- **Source:** docs/design.md §8

### SK-LLM-002 — Single adapter: `(tier, prompt, options) → response` over a cost-ordered provider chain

- **Decision:** Every LLM call routes through one `packages/llm/` adapter (`createLLMRouter()`). The adapter takes a `tier` and a cost-ordered provider chain; the chain is "swappable via env var" (per `docs/design.md §8.1`). No application code calls a provider SDK directly.
- **Core value:** Simple, Bullet-proof, Free
- **Why:** Direct provider SDK calls in handler code lock the provider into the call site — every retry, fallback, span, prompt-cache decision must be re-implemented per call site. One adapter means one place to add a provider, one place to wire `gen_ai.*` semconv attributes, one place to enforce circuit-breaker behaviour. It is also the precondition for the `chains: { free, paid }` selector below (`SK-LLM-007`).
- **Consequence in code:** Handlers call `router.invoke({tier, prompt, ...})`. Provider implementations live in `packages/llm/src/providers/*.ts` and are added by name to the chain config. Direct imports of `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` outside `packages/llm/` fail review.
- **Alternatives rejected:** Per-handler provider pick — every handler owns its own retry/fallback. Provider-router-per-tier (multiple routers) — three places to add a new provider.
- **Source:** docs/design.md §8.1 · docs/llm-credits-plan.md ("How credits flow into the product without breaking UX")

### SK-LLM-003 — Day-1 strict-$0 chain: Gemini Flash → Groq → Workers-AI → OpenRouter free

- **Decision:** Until startup credits land, the `plan` tier chain is `[gemini_flash_free, groq_llama70b_free, openrouter_free]` (with `workers_ai` as a non-US backup). The `classify` tier uses `groq_llama8b_free` with `workers_ai` as the geo backup. Embeddings use Workers AI bge-base-en-v1.5. The chain is configured via env var, not code.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Every provider in the chain has a no-card free tier (per `docs/design.md §8.1`): Gemini 500 RPD plan / 250k TPM, Groq 14,400 RPD on 8B / 1,000 RPD on 70B, Workers AI 10k Neurons/day, OpenRouter ~200 RPD. Stacked, this gives ~500 plan generations + ~14,400 classifications per day — comfortably above Phase 1's exit criteria after the plan cache (60–80% hit rate). Card-free is the activation guarantee in `GLOBAL-013`.
- **Consequence in code:** Day-1 deploy reads `LLM_CHAIN_PLAN`, `LLM_CHAIN_CLASSIFY`, `LLM_CHAIN_SUMMARIZE` env vars; defaults are the strict-$0 chain. All four free providers are implemented in `packages/llm/src/providers/`; rotating the chain is a redeploy, not a code change.
- **Alternatives rejected:** Single free provider — one outage kills the product. Wait for credits — punts launch by weeks; `docs/design.md §0` says we ship without spending money.
- **Source:** docs/design.md §8.1 · docs/llm-credits-plan.md "Realistic timeline"

### SK-LLM-004 — Cloudflare AI Gateway sits in front of every paid provider

- **Decision:** Every paid-provider call routes through Cloudflare AI Gateway URLs (`gateway.ai.cloudflare.com/v1/{acc}/{gw}/{provider}/...`). The gateway provides identical-prompt caching (sub-100 ms hits), per-provider quotas, and a single observability surface across providers.
- **Core value:** Free, Fast, Honest latency
- **Why:** AI Gateway's prompt cache lands sub-100 ms responses on identical prompts (huge win for the same-question-twice pattern). It also gives us one log surface across Anthropic / OpenAI / Gemini, which is the only realistic way to compare provider quality at runtime (see `nlqdb.plan.quality_score` in `docs/llm-credits-plan.md`). The gateway costs nothing on the Free plan.
- **Consequence in code:** Provider implementations accept a `baseUrl` / `endpoint` override; production config sets it to the gateway URL. `AI_GATEWAY_ACCOUNT_ID` + `AI_GATEWAY_ID` are env-driven. Free providers (Groq, Gemini Flash on its free key, Workers AI) hit their direct endpoints; paid providers go through the gateway.
- **Alternatives rejected:** Direct provider SDKs — loses the prompt cache and the unified log surface. Self-built proxy — re-implements what the gateway does for $0.
- **Source:** docs/llm-credits-plan.md "How credits flow into the product without breaking UX" §2

### SK-LLM-005 — Circuit breaker: skip flapping provider after 3 consecutive failures, 60 s cooldown

- **Decision:** The router maintains per-provider failure state. After 3 consecutive failures the provider is skipped for the next 60 s (cooldown). After cooldown, the provider is retried on the next eligible call; success resets the counter.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** Without a circuit breaker, a provider that's down still costs us a connect-timeout per call before we fall through. With it, the second call after a known failure skips straight to the next provider — sub-100 ms switch (per `docs/design.md §8.1`). The 3-failure / 60-s threshold is calibrated against transient provider rate-limit blips that resolve quickly without taking the whole tier offline.
- **Consequence in code:** `createLLMRouter({circuitBreaker: {failureThreshold: 3, cooldownMs: 60_000}})`. Failure-counter state lives in the Worker instance (eventual cross-instance through KV is on the table but not required). A "skip" emits `nlqdb.llm.failover.total{from_provider, to_provider, reason: "circuit_open"}`.
- **Alternatives rejected:** No circuit breaker — every call to a downed provider pays the timeout. Aggressive (1-failure trip) — single transient failure flaps every provider at peak. Permanent open until manual reset — operators have to babysit.
- **Source:** docs/llm-credits-plan.md "Concrete deliverables"

### SK-LLM-006 — `gen_ai.*` OTel semconv on every LLM span; spans use canonical names from the catalog

- **Decision:** Every LLM call emits an OTel span using the canonical names from `docs/performance.md §3.1` (`llm.classify`, `llm.plan`, `llm.summarize`) with `gen_ai.system`, `gen_ai.request.model`, `gen_ai.response.model` attributes (OTel semconv 1.37). Provider, model, operation, and outcome are first-class labels; cardinality budgets are in `docs/performance.md §3.3`.
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** The runtime decision of "which provider answered this call" is invisible without spans — and that is the most expensive question to answer the wrong way (a provider quality drop costs accuracy across every cache miss). `gen_ai.*` semconv is the cross-vendor standard that lets dashboards in Grafana / Honeycomb / Axiom share one schema. The explicit cardinality budget keeps Grafana free-tier costs flat.
- **Consequence in code:** `packages/llm/src/router.ts` wraps every provider call in the canonical span with `gen_ai.*` attributes and increments `nlqdb.llm.calls.total{provider, operation, status}` plus `nlqdb.llm.duration_ms{provider, operation}`. Failovers emit `nlqdb.llm.failover.total{from_provider, to_provider, reason}`. New providers must wire these emissions before merge (CI assertion).
- **Alternatives rejected:** Custom attribute names — fragments dashboards within a quarter (`GLOBAL-014`). Skip spans on the free providers — same cost-saving fantasy as sample-only-slow-requests; loses the baseline distribution.
- **Source:** docs/performance.md §3.1, §3.2, §3.3 · docs/llm-credits-plan.md ("Quality telemetry")

### SK-LLM-007 — Tier-aware chain selector: `priority` + user plan picks `free` vs `paid` chain

- **Decision:** Once paid keys land, the router gains a chain selector with `chains: {free: ProviderName[]; paid: ProviderName[]}`. Per request, the router picks `paid` when (`request.priority === 'high'`) or (user's plan = paid); otherwise `free`. Paid users default to `high`; `/v1/health` and similar low-stakes paths default to `low`.
- **Core value:** Free, Honest latency, Goal-first
- **Why:** Paid users buy quality — they should never silently route through a free 70%-accurate model on plan generation. Free users get the strict-$0 chain, which their plan caches absorb most of the latency cost of. The `priority` hint lets the surfaces signal intent (chat = high; CI probe = low) so a noisy CI doesn't burn paid credits.
- **Consequence in code:** `LLMRouterOptions.chains` is a `{free, paid}` object. `chooseChain(request)` is a pure function tested in isolation. `LLM_CHAIN_PLAN_FREE` and `LLM_CHAIN_PLAN_PAID` env vars override the defaults. The CLI's `nlq run` accepts `--priority` for explicit control.
- **Alternatives rejected:** One chain everyone shares — paid users subsidise free users with their dollars buying free-model accuracy. Per-user explicit chain config — operator footgun; users don't know what to pick.
- **Source:** docs/llm-credits-plan.md "Followups"

### SK-LLM-008 — Pro customers route only through paid / retention-off providers (data-privacy promise)

- **Decision:** Free-tier providers may train on inputs (per their terms); we disclose this in our privacy policy. **Pro customers** route exclusively through paid providers configured for retention-off (Anthropic / OpenAI on their retention-off plans, Bedrock with default retention-off). This is the one meaningful free→paid capability upgrade.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** "Your data trains models" is fine for the demo path (and disclosed honestly), but a non-starter for any business asking us to query real data. Hard-routing Pro through retention-off providers turns the privacy story from a footnote into a contract. It's also the cleanest justification for the upsell — you're paying for the data-privacy boundary, not just for higher accuracy.
- **Consequence in code:** `chooseChain(req)` for `plan === 'pro'` filters out any provider whose `retainsInputs === true`. Provider config carries the boolean explicitly; PRs that flip it without changing the privacy policy fail review. Tests assert no Pro request reaches a free-tier provider.
- **Alternatives rejected:** Same chain for everyone with a privacy-policy disclaimer — the policy is true for the free tier; it's not the product story we want to sell. Per-user opt-out — adds a privacy lever the user has to operate; we'd rather just hold the line.
- **Source:** docs/design.md §8.1 ("Constraints we accept" → "Data privacy") · docs/llm-credits-plan.md "How credits flow into the product without breaking UX" §1

### SK-LLM-009 — Prompt caching on every provider that supports it (~80% input reduction)

- **Decision:** Every paid-provider call uses the provider's prompt-caching feature (Anthropic prompt caching, OpenAI cached tokens, Gemini context caching, AI Gateway response cache). System prompts and few-shot examples are written once per chain so the cache hits.
- **Core value:** Free, Fast, Honest latency
- **Why:** System-prompt + schema-context tokens dominate input cost on the plan tier. Provider prompt caching (paired with AI Gateway response caching) cuts ~80% of input cost on repeated patterns (per `docs/design.md §8` cost-control rule 3). Without it, we burn credit on the same system prompt thousands of times a day.
- **Consequence in code:** Every `tier=plan` call passes `cache_control: ephemeral` markers (Anthropic) or equivalent (`extra_headers: { "x-cache-namespace": ... }`) into the request. The system-prompt is constructed from a single immutable template (per `SK-LLM-010`); changes to the template invalidate the cache, which is the intended behaviour.
- **Alternatives rejected:** Skip prompt caching — pays full input price on every call; budget runs out in days. Custom in-Worker caching of prompts only — re-implements provider features at the wrong layer.
- **Source:** docs/design.md §8 (cost-control rule 3)

### SK-LLM-010 — Plan cache first, LLM second (cost-control rule #1)

- **Decision:** Every `/v1/ask` request consults the plan cache before any LLM call. The expected steady-state cache hit rate is 60–80% (`docs/design.md §8`); cache-warming is a deliberate step on first-deploy. The LLM router never bypasses the plan cache.
- **Core value:** Free, Fast, Honest latency
- **Why:** A frontier-model plan call is the most expensive operation on the hot path. The plan cache turns that cost into a one-time-per-`(schema_hash, query_hash)` event. Skipping the cache to "save a hop" is penny-wise; LLM cost dominates at every traffic level. This is also the single highest-leverage cost lever we have.
- **Consequence in code:** The ask-pipeline order in `SK-ASK-002` puts plan-cache lookup before any `llm.*` span. Tests assert that a second identical request hits the cache (no `llm.plan` span emitted). The router's API exposes no "skip-cache" flag; force-replan is a `query_hash` salt at the ask layer (`SK-PLAN-005`).
- **Alternatives rejected:** Cache only on second hit — wastes the first call; same cost as no-cache for a one-shot query. Cache off for "expensive" queries — every cached-but-expensive plan would be the one we discarded.
- **Source:** docs/design.md §8 (cost-control rule 1) · docs/decisions.md#GLOBAL-006

### SK-LLM-011 — Self-host the classifier once we hit ~50 k queries/day

- **Decision:** When traffic crosses ~50 k queries/day, we self-host the classify tier on a single A10G on Modal (quantized 8B Llama). Cost: ~$200/mo flat. Plan and hard tiers stay on hosted providers indefinitely.
- **Core value:** Free, Bullet-proof, Open source
- **Why:** At ~50 k queries/day, classify-tier hosted cost crosses the flat-Modal threshold. Self-hosting turns a per-call cost into a fixed cost and removes an external dependency from the hottest path. Plan-tier compute is too uneven to self-host economically — we stay on hosted providers there.
- **Consequence in code:** Provider implementation `modal_llama8b` already lands behind a feature flag; flipping the flag rolls classify traffic over. Failover chain stays Groq → Modal → Workers-AI so a Modal outage doesn't degrade classification accuracy. The 50k/day threshold is dashboard-monitored.
- **Alternatives rejected:** Self-host plan tier — bursty plan workloads cost more on flat A10G than on per-call paid. Stay on hosted forever — once we hit 200k/day classify cost crosses $1k/mo.
- **Source:** docs/design.md §8 (cost-control rule 5)

### GLOBAL-014 — OTel span on every external call (DB, LLM, HTTP, queue)

- **Decision:** Every call that crosses a process boundary — DB query, LLM call, outbound HTTP, queue enqueue/dequeue — is wrapped in an OpenTelemetry span with the canonical attributes from `docs/performance.md` §3 (the span / metric / label catalog).
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** Without spans on every external call, we can't answer "why is this request slow," "is the LLM the bottleneck," or "did this retry actually go to the DB twice." The catalog enforces consistent attribute names so dashboards and queries don't fragment.
- **Consequence in code:** `packages/otel` exposes the wrapper helpers; all DB / LLM / HTTP / queue clients in the codebase route through them. New external calls without a span fail review. Span names, attributes, and metrics match the catalog (no ad-hoc names).
- **Alternatives rejected:**
  - Sample only slow requests — loses the baseline distribution.
  - Per-team conventions — fragments the dashboards within a quarter.
- **Source:** docs/decisions.md#GLOBAL-014

### GLOBAL-013 — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed

- **Decision:** The free tier runs on Cloudflare Workers free plan, Neon free plan, and other zero-cost services. The deployed Worker bundle stays under 3 MiB compressed (Cloudflare's hard limit on the free plan is 3 MiB, paid is 10 MiB).
- **Core value:** Free, Bullet-proof
- **Why:** "Free forever" is the activation hook. If our infra cost per free user is non-zero, the runway turns into a wall. The 3 MiB ceiling is a real constraint that shapes dependency choices.
- **Consequence in code:** Every dependency is checked against bundle budget before adoption (`pnpm build && wrangler deploy --dry-run`). Heavy deps (parsers, big crypto libs, full AI SDKs) are forbidden on the Workers path; equivalent functionality goes through HTTP to a cheaper backend or via tree-shakable submodules.
- **Alternatives rejected:**
  - "Free trial" with a card — kills activation.
  - Bigger bundle with paid plan default — locks us out of the Workers free plan, which is the actual product story.
- **Source:** docs/decisions.md#GLOBAL-013

### GLOBAL-016 — Reach for small mature packages before DIY; hard-pass on RC on the critical path

- **Decision:** Before writing a primitive (auth, idempotency store, retry logic, queue, OTel exporter), check for a small, mature, actively-maintained package. If one exists, adopt it. Reject any RC / alpha / pre-1.0 dependency on a critical path unless the alternative is writing it ourselves.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** Small, focused libraries that have been maintained for years are usually more reliable than the version of the same thing we'd write next quarter. RCs on the critical path become tech debt the moment the upstream stalls — and they always stall.
- **Consequence in code:** Dependency reviews check (a) maintenance cadence (releases in the last 6 months), (b) ecosystem (downloads, issues), (c) bundle weight (`GLOBAL-013`), (d) license. Reviews reject pre-1.0 deps unless explicitly justified in the PR.
- **Alternatives rejected:**
  - "Write it ourselves, it'll be better" — measurably untrue across auth, retry, ORM, queue.
  - "Adopt the newest thing" — RC churn poisons the critical path.
- **Source:** docs/decisions.md#GLOBAL-016

## Open questions / known unknowns

- **`nlqdb.plan.quality_score` shape and threshold.** `docs/llm-credits-plan.md` proposes a `(1 = clean, 0.5 = needed correction loop, 0 = rejected)` histogram. The exact bucket boundaries, the LLM-as-judge prompt, and the alert threshold for "this provider is silently degrading" are not yet specified.
- **Prompt-template version pinning.** `SK-LLM-009` says system-prompt changes invalidate the prompt cache (intended). We don't yet have a place to record which template version produced which plan — a future debugging need. Open.
- **Per-user credit accounting.** The skill description mentions "per-user credit accounting" but `docs/design.md §8` and `docs/llm-credits-plan.md` cover provider-level cost, not per-user usage metering. Lago is in `docs/design.md §7`'s stack as the metering backbone; the wiring from LLM router → Lago is not yet specified.
- **Failover behaviour when every provider in a chain fails.** Today the chain falls through providers; what happens when the last one fails? Bubble up an error envelope (per `GLOBAL-012`)? Retry the head with backoff? The router currently throws; the user-facing error semantics are open.
- **Free-tier RPM ceiling visibility.** `docs/design.md §8.1` says "bursts queue briefly; 'queued — 2s' surfaced in UI." The queue mechanism is not yet implemented in the router; today bursts that exceed the provider's RPM fail-and-fall-through. Track in the rate-limit / observability skills.
