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
**Status:** implemented for the free chain (`SK-LLM-001..015` + `SK-LLM-018` + `SK-LLM-023..030` + `SK-LLM-032..041`). BYOLLM (`SK-LLM-016`) is partial — provider factory (`SK-LLM-019`) + lane selector (`SK-LLM-020`) ship, the per-request `x-nlq-byollm-key` header lane is wired on HTTP `/v1/ask` (`SK-LLM-021`), and the account-stored lane resolves on `/v1/ask` via `api_keys` `scope = "byollm"` ([`SK-PREMIUM-012`](../premium-tier/decisions/SK-PREMIUM-012-account-stored-byollm-storage.md)); `GLOBAL-003` surface parity (MCP/SDK/CLI/elements/`/app/keys`) pending (tracked in `premium-tier/FEATURE.md`). `SK-LLM-017` (hosted-premium chain) lands in Phase 2 alongside `quality-eval`; its meter stays dark until [`phase-plan.md §6`](../../phase-plan.md) trips.

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
`plan` chain `[gemini_flash_free, groq_llama70b_free, openrouter_free]` (+`workers_ai` non-US backup); `route` on `groq_llama8b_free`. Every entry is no-card free (`GLOBAL-013`), env-var configured (`LLM_CHAIN_*`). **Current planner tier:** Cerebras (gpt-oss-120b) head per [`SK-LLM-023`](#sk-llm-023), Mistral tail per [`SK-LLM-028`](#sk-llm-028).

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
`LLMRouterOptions.hedge` opts an op into a two-way hedged race after `afterMs` head-start; loser aborted with `HEDGE_LOST` so the breaker doesn't trip on the cancel. Free-tier chains only; prod wires `schema_infer` + `plan` at `afterMs: 800`. Rationale + trace in the sharded body.

### SK-LLM-016 — BYOLLM dispatch lane: per-request override → account-stored → hosted-premium → free

**Body:** [`decisions/SK-LLM-016-byollm-dispatch.md`](./decisions/SK-LLM-016-byollm-dispatch.md).
Four-step dispatch precedence per `GLOBAL-026`: per-request `x-nlq-byollm-key` header → account-stored key → hosted-premium → free. Routes through AI Gateway; fails loud per `GLOBAL-012`. Key-handling in [`SK-PREMIUM-008`](../premium-tier/decisions/SK-PREMIUM-008-byollm.md); provider half in [`SK-LLM-019`](#sk-llm-019).

### SK-LLM-019 — BYOLLM provider factory: AI Gateway unified endpoint + `cf-aig-cache-key` tenant namespace

**Body:** [`decisions/SK-LLM-019-byollm-provider-factory.md`](./decisions/SK-LLM-019-byollm-provider-factory.md).
`createByollmProvider` builds a `Provider` from the user's own key + model through AI Gateway's `compat/chat/completions` endpoint: key pass-through (0% markup), `<upstream>/<model>` qualifier, per-tenant `cf-aig-cache-key = BYOLLM_<userId>_<sha256(request)>` namespace.

### SK-LLM-020 — BYOLLM lane selector + single-provider lane router

**Body:** [`decisions/SK-LLM-020-byollm-lane-selector.md`](./decisions/SK-LLM-020-byollm-lane-selector.md).
`byollm-dispatch.ts` adds three pure primitives — `selectDispatchLane` (the source of truth for `SK-LLM-016`'s header→account→premium→free precedence), `buildByollmRouter` (single-provider, fail-loud per `GLOBAL-012`), `dispatchLaneAttributes` (bounded, key-redacted span attributes). The package stays free of header/DB/KEK access.

### SK-LLM-021 — BYOLLM header wiring on `/v1/ask`: signed-in-only `x-nlq-byollm-key`, fail-loud, free-router fallthrough

**Body:** [`decisions/SK-LLM-021-byollm-header-wiring.md`](./decisions/SK-LLM-021-byollm-header-wiring.md).
`apps/api/src/ask/byollm.ts` wires `SK-LLM-016` step 1 into `/v1/ask`: `parseByollmHeader` (`<provider>:<model>:<key>`) + `resolveAskRouter`, signed-in only (anon / API-key principals get a one-sentence 400). Account-stored keys + `GLOBAL-003` parity deferred (`premium-tier/FEATURE.md`).

### SK-LLM-017 — Hosted-premium chain: separate provider list, §6-gated meter, never available on free

**Body:** [`decisions/SK-LLM-017-hosted-premium-chain.md`](./decisions/SK-LLM-017-hosted-premium-chain.md).
Third chain alongside `free` and `paid`: **`premium`** = Sonnet 4.6 + GPT-5 + Gemini 2.5 Pro. Fires only when `principal.tier !== "free"` AND (`model === "best"` or auto-classified hard-plan) AND `PREMIUM_METER_LIVE` (§6-gated; pre-§6 dark). Commercial form in [`SK-PREMIUM-009`](../premium-tier/decisions/SK-PREMIUM-009-hosted-premium-meter.md).

### SK-LLM-015 — OpenRouter code-gen ops default to `qwen/qwen3-coder:free`

**Body:** [`decisions/SK-LLM-015-openrouter-codegen-default.md`](./decisions/SK-LLM-015-openrouter-codegen-default.md).
OpenRouter pins `plan` + `schema_infer` to `qwen/qwen3-coder:free`; cheap-tier ops stay on Llama `:free`. Qwen-Coder ≈96% text-to-SQL vs ≈88% Llama 3.3 70B; chain order unchanged (OpenRouter remains universal fallback per `SK-LLM-003`).

### SK-LLM-018 — Schema-fidelity planner prompt + diagnostic retry framing

**Body:** [`decisions/SK-LLM-018-schema-fidelity-prompt.md`](./decisions/SK-LLM-018-schema-fidelity-prompt.md).
`PLAN_SYSTEM` gains schema-literal + verbatim-casing + dialect-strict + `Evidence:`-authoritative directives; `buildPlanUser`'s retry block reframes "different shape" as **diagnose-first, surgical-fix** ([`SK-QUAL-005`](../quality-eval/FEATURE.md#sk-qual-005)).

### SK-LLM-013 — `PlanResponse` carries `model` + `confidence` for SK-TRUST-002

**Body:** [`decisions/SK-LLM-013-plan-response-shape.md`](./decisions/SK-LLM-013-plan-response-shape.md). `PlanResponse` widens to `{ sql, model, confidence }`; `confidence` is a `1.0` placeholder until `quality-eval` calibrates per-tier floors (`SK-TRUST-003`). The plan cache stores both so hits return the miss's values.

### SK-LLM-022 — Hard-plan confidence threshold = 0.75 (env-tunable)

**Body:** [`decisions/SK-LLM-022-hard-plan-confidence-threshold.md`](./decisions/SK-LLM-022-hard-plan-confidence-threshold.md). `confidence < 0.75 ⇒ hard_plan = true`, env-tunable (`HARD_PLAN_CONFIDENCE_THRESHOLD`). Pins the `SK-LLM-001` "hard" tier; drives the `SK-PREMIUM-004` upsell.

### SK-LLM-023 — Cerebras (gpt-oss-120b) leads the strict-$0 planner-tier chain

**Body:** [`decisions/SK-LLM-023-cerebras-planner-tier.md`](./decisions/SK-LLM-023-cerebras-planner-tier.md).
Adds Cerebras (`gpt-oss-120b`, OpenAI-compatible, card-free) at the head of the `plan` / `schema_infer` chain: `[cerebras, gemini, groq, workers-ai, openrouter]`. Extends [`SK-LLM-003`](#sk-llm-003); the eval free lane carries the identical chain.

### SK-LLM-024 — Deterministic greedy decoding (temperature 0) across the whole free planner chain

**Body:** [`decisions/SK-LLM-024-greedy-decoding-parity.md`](./decisions/SK-LLM-024-greedy-decoding-parity.md). Every free `plan` / `schema_infer` leg decodes greedily at `temperature: 0` (reproducible baseline for the [`SK-QUAL-006`](../quality-eval/FEATURE.md#sk-qual-006) McNemar test).

### SK-LLM-025 — Recover the JSON object from reasoning-model preamble leaks before failing the parse

**Body:** [`decisions/SK-LLM-025-json-recovery-fallback.md`](./decisions/SK-LLM-025-json-recovery-fallback.md). `parseJsonResponse` gains a balanced-`{…}` recovery fallback after strict `JSON.parse` throws — recovers reasoning-head ([`SK-LLM-023`](#sk-llm-023)) preamble leaks; additive.

### SK-LLM-026 — Static few-shot exemplars in the planner prompt (DAIL-SQL)

**Body:** [`decisions/SK-LLM-026-static-few-shot-plan-exemplars.md`](./decisions/SK-LLM-026-static-few-shot-plan-exemplars.md). `PLAN_SYSTEM` splits into `PLAN_DIRECTIVES` (`SK-LLM-018`) + a `PLAN_FEW_SHOT` block of three static Question→JSON exemplars (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363)).

### SK-LLM-027 — Result-shape directives in the planner prompt (exact projection + REAL-cast ratios)

**Body:** [`decisions/SK-LLM-027-result-shape-directives.md`](./decisions/SK-LLM-027-result-shape-directives.md). Two `PLAN_DIRECTIVES` bullets — exact projection and REAL-cast ratios.

### SK-LLM-028 — Mistral is the strict-$0 planner-tier capacity backstop at the chain tail

**Body:** [`decisions/SK-LLM-028-mistral-capacity-backstop.md`](./decisions/SK-LLM-028-mistral-capacity-backstop.md). Appends **Mistral** (`mistral-large-latest`, card-free) behind OpenRouter on `plan` / `schema_infer` — an independent free-tier RPM pool; tail-only ⇒ additive.

### SK-LLM-030 — Rate-limit-aware failover + cooldown (a 429 honors the server's Retry-After window)

**Body:** [`decisions/SK-LLM-030-rate-limit-aware-failover.md`](./decisions/SK-LLM-030-rate-limit-aware-failover.md). New `FailoverReason "rate_limited"` + `retryAfterMs` mapped once in `httpError` (`_shared.ts`); the router opens the breaker for `min(max(retryAfterMs, cooldownMs), maxRateLimitCooldownMs)` (5-min cap). Refines [`SK-LLM-005`](#sk-llm-005).

### SK-LLM-029 — NULL-safe extremum ordering directive in the planner prompt

**Body:** [`decisions/SK-LLM-029-null-safe-extremum.md`](./decisions/SK-LLM-029-null-safe-extremum.md). One `PLAN_DIRECTIVES` bullet: filter the ranked column (`WHERE <col> IS NOT NULL`) on single-extreme-row selection (SQLite sorts NULL first).

### SK-LLM-032 — Count-grain directive in the planner prompt (COUNT(DISTINCT) vs COUNT(\*), and SELECT DISTINCT)

**Body:** [`decisions/SK-LLM-032-count-grain-directive.md`](./decisions/SK-LLM-032-count-grain-directive.md). One `PLAN_DIRECTIVES` bullet for **Wrong COUNT Object** (`COUNT(*)` vs `COUNT(DISTINCT key)`) and **Missing DISTINCT** ([arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)); a guard bounds regression under `SK-QUAL-010`.

### SK-LLM-034 — Group-by-grain directive in the planner prompt (per-group GROUP BY alignment)

**Body:** [`decisions/SK-LLM-034-group-by-grain-directive.md`](./decisions/SK-LLM-034-group-by-grain-directive.md). One `PLAN_DIRECTIVES` bullet for **Unaligned Aggregation Structure** (E5, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)): a "per/each/by `<category>`" goal needs a `GROUP BY` on that column; a guard bounds the inverse regression.

### SK-LLM-035 — Numeric-text-cast directive in the planner prompt (cast TEXT-declared columns used numerically)

**Body:** [`decisions/SK-LLM-035-numeric-text-cast-directive.md`](./decisions/SK-LLM-035-numeric-text-cast-directive.md).
One `PLAN_DIRECTIVES` bullet: when the schema declares a column `TEXT` but
the goal uses it numerically, `CAST(<col> AS REAL)` — SQLite compares TEXT
lexicographically (`'100' < '9'`). Targets *Implicit Type Conversion* (C1,
[arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)); prompt-only, ≈55 tokens.

### SK-LLM-036 — Workers AI: accept the object-shaped `result.response` a JSON-emitting model returns

**Body:** [`decisions/SK-LLM-036-workers-ai-structured-response.md`](./decisions/SK-LLM-036-workers-ai-structured-response.md).
The Workers AI REST endpoint returns valid-JSON output pre-parsed as an
object; accept string *or* object and re-serialize objects so
`parseJsonResponse` stays the single JSON entry point.

### SK-LLM-037 — Goal-relevant schema pruning in the planner prompt (recall-first, table-granular)

**Body:** [`decisions/SK-LLM-037-goal-relevant-schema-pruning.md`](./decisions/SK-LLM-037-goal-relevant-schema-pruning.md).
`buildPlanUser` prunes the embedded schema via the pure
`pruneSchemaForGoal`: keep token-matched tables + their `REFERENCES`
closure, full schema on any doubt. BIRD-dev 500: 99.8% gold-table recall,
−7.1% schema chars.

### SK-LLM-038 — Retry the chain-tail provider once on a transient failure

**Body:** [`decisions/SK-LLM-038-tail-transient-retry.md`](./decisions/SK-LLM-038-tail-transient-retry.md).
When the **last** provider in a chain fails `network`/`http_5xx`, the
router retries it once (150 ms backoff, abort-aware) before throwing —
closes the [`SK-LLM-028`](#sk-llm-028) tail gap; tail-only ⇒ zero
added latency on any succeeding call.

### SK-LLM-039 — Classify 401/403 as `auth_denied` and park the provider for a long cooldown

**Body:** [`decisions/SK-LLM-039-auth-denied-reason.md`](./decisions/SK-LLM-039-auth-denied-reason.md). `httpError` maps 401/403 to a distinct `auth_denied` reason (not an opaque `http_4xx`); the first denial opens the breaker for `AUTH_DENIED_COOLDOWN_MS` (30 min — the denial is human-gated) so a dead key isn't re-hit and its hedge slot rotates to a live provider.

### SK-LLM-040 — Aggregate-filter directive in the planner prompt (filter groups by an aggregate in HAVING, not WHERE)

**Body:** [`decisions/SK-LLM-040-aggregate-filter-having-directive.md`](./decisions/SK-LLM-040-aggregate-filter-having-directive.md). One `PLAN_DIRECTIVES` bullet: a threshold on a group's aggregate goes in HAVING after GROUP BY, not WHERE (plain per-row predicates stay in WHERE) — the *HAVING* half of *Unaligned Aggregation Structure* (E5, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)) that [`SK-LLM-034`](#sk-llm-034) left; prompt-only, ≈55 tokens.

### SK-LLM-041 — Similarity-retrieved few-shot exemplar selection (DAIL-SQL retrieval half — deterministic core)

**Body:** [`decisions/SK-LLM-041-similarity-retrieved-few-shot.md`](./decisions/SK-LLM-041-similarity-retrieved-few-shot.md). The *retrieval* half of DAIL-SQL ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)) that [`SK-LLM-026`](#sk-llm-026) left — the top reasoning lever ([source-of-truth §4 #1](../../progress/quality-score-source-of-truth.md)) after the directives saturated. New pure `few-shot-select.ts`: question **masking** (literal values → one `val` placeholder, so similarity scores the question skeleton and an exemplar can cross domains) + masked-token Jaccard + stable top-k `selectExemplars`. Deterministic core + schema-aware `selectExemplarsForSchema` + (2026-06-21) the **curated pool rows** `plan-exemplar-pool.ts` (14 hand-authored `{question, schema, SQL}` exemplars — one per `SK-QUAL-014` structural bucket, grown 10 → 14 on 2026-06-22 to add anti-join, group-order-limit, null-filter + order-by-limit; offline retrieval **precision@1 = 14/14**, similarity lift **+0.576** over an uninformed pick; persona-bench ICP retrieval **18/20**) + (2026-06-21) **half (b) — the per-lever T9 ablation** `buildPlanSystem(goal, schema, k)`: default off ⇒ static `PLAN_SYSTEM` byte-for-byte (prod unchanged); `k > 0` (eval `--retrieve-exemplars` only) swaps the static prefix for the retrieved exemplars, so the next dispatch A/Bs greedy-static vs greedy-retrieved (token-negative vs the static prefix). Only the hot-path embedding index remains; EX delta next dispatch ([`SK-QUAL-002`](../quality-eval/decisions/SK-QUAL-002-pr-ci-never-fires-real-keys.md)).

### SK-LLM-033 — Schema-inference prompt requires insertable sample rows

**Body:** [`decisions/SK-LLM-033-schema-infer-insertable-sample-rows.md`](./decisions/SK-LLM-033-schema-infer-insertable-sample-rows.md). `SCHEMA_INFER_SYSTEM` gains a `sample_rows`-validity contract (parent rows first, FK values present, NOT-NULL complete); deterministic no-500 floor is [`SK-HDC-018`](../hosted-db-create/decisions/SK-HDC-018-sample-insert-graceful-degradation.md).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (index in [`docs/decisions.md`](../../decisions.md)); feature-local commentary nested under each rule.

- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
- **GLOBAL-016** — Reach for small mature packages before DIY; hard-pass on RC on the critical path.
- **GLOBAL-022** — Recoverable failures retry to success — never surface a fixable error.
  - *In this feature:* provider 5xx / network / timeout / 429 are failover signals (`SK-LLM-005`, `SK-LLM-030`) that advance to the next provider, never retry the same one.
- **GLOBAL-025** — North-star: engine quality, onboarding, UX — each with explicit KPIs.
  - *In this feature:* the router IS the engine north-star's NL→SQL mechanism; the free-vs-frontier delta KPI runs `quality-eval` against this router's free vs hosted-premium chain.
- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid.
  - *In this feature:* owns dispatch precedence (`SK-LLM-016`) + hosted-premium chain wiring (`SK-LLM-017`); commercial shape in `premium-tier/FEATURE.md`.

## Open questions / known unknowns

- **Failover when every provider in a chain fails** — Decided shape (per `GLOBAL-033` → `GLOBAL-012`): throw a structured `provider_chain_exhausted` envelope (one-sentence, actionable); **no** head-retry with backoff (a fresh `/v1/ask` re-enters the chain). **Parked until** the surfaces render it — the typed envelope isn't emitted in `packages/llm` yet.
- **Parked until `quality-eval` Phase 2:** `nlqdb.plan.quality_score` histogram shape + LLM-as-judge prompt + "provider silently degrading" alert threshold — depends on the judge harness.
- **Parked until Lago wiring (Phase 2):** per-user credit accounting (`architecture.md §6`); provider-level cost already covered.
- **Parked until a leak-rate regression forces it ([`SK-LLM-025`](#sk-llm-025)):** a per-call JSON-recovery-rate counter (`nlqdb.llm.json_recovered.total{op}` at the `router.ts` boundary); the eval run already surfaces the aggregate `no_sql` → `match` shift.
- **Parked until burst abuse shows up:** free-tier RPM queue ("queued — 2s" UX, `architecture.md §7.1`); today bursts over a provider's RPM fail-and-fall-through. Owned with `rate-limit` / `observability`.
