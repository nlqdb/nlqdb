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
**Status:** all three `GLOBAL-026` lanes are live — free chain, BYOLLM (`SK-LLM-016`; account-stored lane per [`SK-PREMIUM-012`](../premium-tier/decisions/SK-PREMIUM-012-account-stored-byollm-storage.md), `GLOBAL-003` parity in `premium-tier/FEATURE.md`), hosted-premium (`SK-LLM-017`, 2026-08-14). Per-decision state lives in each decision.

**Owners (code):** `packages/llm/**`
**Cross-refs:** docs/architecture.md §7, §7.1 · docs/performance.md §4 Slice 4, §2.2, §3 · `docs/features/hosted-db-create/FEATURE.md` (SK-HDC-001/002 route through this router)

## Touchpoints — read this feature before editing

- `packages/llm/**`

## Decisions

### SK-LLM-001 — Tiered routing — never send all traffic to a frontier model

**Body:** [`decisions/SK-LLM-001-tiered-routing.md`](./decisions/SK-LLM-001-tiered-routing.md). Tiers by job (cheap-nano route/summarize, planner-tier `plan`/`schema_infer`, hard-plan Tier 3), each naming a paid model + free fallback; one-model-for-all is a CI-asserted cost regression.

### SK-LLM-002 — Single adapter: `(tier, prompt, options) → response` over a cost-ordered provider chain

**Body:** [`decisions/SK-LLM-002-single-adapter.md`](./decisions/SK-LLM-002-single-adapter.md). A direct `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` import outside `packages/llm/` fails review. Precondition for the `{free, paid}` selector (`SK-LLM-007`).

### SK-LLM-003 — Day-1 strict-$0 chain: Gemini Flash → Groq → Workers-AI → OpenRouter free

**Body:** [`decisions/SK-LLM-003-strict-zero-chain.md`](./decisions/SK-LLM-003-strict-zero-chain.md). **Current planner tier:** Qwen3.8-27B head per [`SK-LLM-054`](#sk-llm-054) (gpt-oss-120b fallback, [`SK-LLM-023`](#sk-llm-023)), Mistral tail per [`SK-LLM-028`](#sk-llm-028).

### SK-LLM-004 — Cloudflare AI Gateway sits in front of every paid provider

**Body:** [`decisions/SK-LLM-004-ai-gateway-paid.md`](./decisions/SK-LLM-004-ai-gateway-paid.md). Providers accept a `baseUrl` override (`AI_GATEWAY_ACCOUNT_ID`/`AI_GATEWAY_ID`); the gateway is $0 on the Free plan and buys identical-prompt caching, per-provider quotas, and one observability surface.

### SK-LLM-005 — Circuit breaker: skip flapping provider after 3 consecutive failures, 60 s cooldown

**Body:** [`decisions/SK-LLM-005-circuit-breaker.md`](./decisions/SK-LLM-005-circuit-breaker.md). Per-provider failure state: 3 consecutive failures → skip for 60 s, then retry on the next eligible call (success resets). A skip emits `nlqdb.llm.failover.total{…, reason: "circuit_open"}`. State is per-Worker-instance.

### SK-LLM-006 — `gen_ai.*` OTel semconv on every LLM span; spans use canonical names from the catalog

**Body:** [`decisions/SK-LLM-006-otel-semconv.md`](./decisions/SK-LLM-006-otel-semconv.md). Every LLM call emits a canonical-named span (`llm.route`/`plan`/`summarize`/`schema_infer`/`engine_classify`) with `gen_ai.*` semconv 1.37 attributes; `router.ts` increments `nlqdb.llm.calls.total` / `duration_ms` / `failover.total`. Cardinality budgets in `docs/performance.md §3.3` (CI-asserted, `GLOBAL-014`).

### SK-LLM-007 — Tier-aware chain selector: `priority` + user plan picks `free` vs `paid` chain

**Body:** [`decisions/SK-LLM-007-tier-aware-selector.md`](./decisions/SK-LLM-007-tier-aware-selector.md). `chains: {free, paid}` selector: pick `paid` when `priority === 'high'` or plan is paid, else `free`. `chooseChain(request)` is a pure, isolated function; `LLM_CHAIN_PLAN_FREE`/`_PAID` override defaults. Paid users never silently route through a free 70%-accurate model.

### SK-LLM-008 — Pro customers route only through paid / retention-off providers (data-privacy promise)

**Body:** [`decisions/SK-LLM-008-pro-retention-off.md`](./decisions/SK-LLM-008-pro-retention-off.md). Pro customers route exclusively through retention-off paid providers; `chooseChain(req)` filters out any provider with `retainsInputs === true`, and tests assert no Pro request reaches a free-tier provider. Turns the data-privacy story from a footnote into the one meaningful free→paid upgrade.

### SK-LLM-009 — Prompt caching on every provider that supports it (~80% input reduction)

**Body:** [`decisions/SK-LLM-009-prompt-caching.md`](./decisions/SK-LLM-009-prompt-caching.md). Every paid-provider call uses the provider's prompt-caching feature (Anthropic `cache_control`, OpenAI cached tokens, Gemini context caching, AI Gateway response cache) — system prompts written once per chain so the cache hits, cutting ~80% of plan-tier input cost.

### SK-LLM-010 — Plan cache first, LLM second (cost-control rule #1)

**Body:** [`decisions/SK-LLM-010-plan-cache-first.md`](./decisions/SK-LLM-010-plan-cache-first.md). Every `/v1/ask` consults the plan cache before any LLM call (60–80% steady-state hit rate); the router never bypasses it and exposes no skip-cache flag. The single highest-leverage cost lever — a frontier plan call becomes a one-time-per-`(schema_hash, query_hash)` event.

### SK-LLM-011 — Self-host the cheap-tier router once we hit ~50 k queries/day

**Body:** [`decisions/SK-LLM-011-self-host-cheap-tier.md`](./decisions/SK-LLM-011-self-host-cheap-tier.md). At ~50 k queries/day, self-host cheap-tier `route` / `engine_classify` on a single Modal A10G (quantized 8B Llama, ~$200/mo flat); plan + hard tiers stay hosted. `modal_llama8b` lands behind a flag; failover stays Groq → Modal → Workers-AI. Threshold is dashboard-monitored.

### SK-LLM-012 — `schema_infer` is a distinct router operation, not an alias of `plan`

**Body:** [`decisions/SK-LLM-012-schema-infer-op.md`](./decisions/SK-LLM-012-schema-infer-op.md). `schema_infer` is its own router op (`router.schemaInfer` → span `llm.schema_infer`), not a `plan` alias — shares the planner chain but ships distinct prompt / request / response shapes and an 8000 ms budget (vs `plan`'s 5000 ms). Runs once per DB, ever.

### SK-LLM-014 — Hedged-request race on free-tier chains for planner-tier ops

**Body:** [`decisions/SK-LLM-014-hedged-request-race.md`](./decisions/SK-LLM-014-hedged-request-race.md). `LLMRouterOptions.hedge` opts an op into a two-way hedged race after `afterMs` head-start; loser aborted (`HEDGE_LOST`) without tripping the breaker. Free-tier only; prod wires `schema_infer` + `plan` at `afterMs: 2000` ([`SK-LLM-048`](#sk-llm-048) re-tune, retained by [`SK-LLM-053`](#sk-llm-053)/[`SK-LLM-054`](#sk-llm-054)).

### SK-LLM-016 — BYOLLM dispatch lane: per-request override → account-stored → hosted-premium → free

**Body:** [`decisions/SK-LLM-016-byollm-dispatch.md`](./decisions/SK-LLM-016-byollm-dispatch.md). Four-step dispatch precedence per `GLOBAL-026`: per-request `x-nlq-byollm-key` header → account-stored key → hosted-premium → free. Routes through AI Gateway; fails loud per `GLOBAL-012`. Key-handling in [`SK-PREMIUM-008`](../premium-tier/decisions/SK-PREMIUM-008-byollm.md); provider half in [`SK-LLM-019`](#sk-llm-019).

### SK-LLM-019 — BYOLLM provider factory: AI Gateway unified endpoint + `cf-aig-cache-key` tenant namespace

**Body:** [`decisions/SK-LLM-019-byollm-provider-factory.md`](./decisions/SK-LLM-019-byollm-provider-factory.md). `createByollmProvider` builds a `Provider` from the user's own key + model through AI Gateway's unified endpoint (0% markup), with a per-tenant cache-key namespace; `openrouter` is special-cased to its dedicated path.

### SK-LLM-020 — BYOLLM lane selector + single-provider lane router

**Body:** [`decisions/SK-LLM-020-byollm-lane-selector.md`](./decisions/SK-LLM-020-byollm-lane-selector.md). `byollm-dispatch.ts` adds three pure primitives — `selectDispatchLane` (`SK-LLM-016`'s header→account→premium→free precedence), `buildByollmRouter` (single-provider, fail-loud per `GLOBAL-012`), `dispatchLaneAttributes` (bounded, key-redacted span attributes).

### SK-LLM-021 — BYOLLM header wiring on `/v1/ask`: signed-in-only `x-nlq-byollm-key`, fail-loud, free-router fallthrough

**Body:** [`decisions/SK-LLM-021-byollm-header-wiring.md`](./decisions/SK-LLM-021-byollm-header-wiring.md). `apps/api/src/ask/byollm.ts` wires `SK-LLM-016` step 1 into `/v1/ask`: `parseByollmHeader` (`<provider>:<model>:<key>`) + `resolveAskRouter`, signed-in only (anon / API-key principals get a one-sentence 400). Account-stored keys + `GLOBAL-003` parity deferred (`premium-tier/FEATURE.md`).

### SK-LLM-017 — Hosted-premium chain: separate provider list, §6-gated meter, never available on free

**Body:** [`decisions/SK-LLM-017-hosted-premium-chain.md`](./decisions/SK-LLM-017-hosted-premium-chain.md). Now ships as `buildPremiumRouter` (`packages/llm/src/premium-dispatch.ts`): a single-provider **Anthropic** lane (v1 `claude-sonnet-4-6`) with a usage sink feeding the meter. Fires only on paid tiers, on a `best`/hard plan, behind `PREMIUM_METER_LIVE` (live 2026-08-14). Commercial form in [`SK-PREMIUM-009`](../premium-tier/decisions/SK-PREMIUM-009-hosted-premium-meter.md).

### SK-LLM-015 — OpenRouter code-gen default — SUPERSEDED by SK-LLM-045

**Body:** [`decisions/SK-LLM-015-openrouter-codegen-default.md`](./decisions/SK-LLM-015-openrouter-codegen-default.md). Superseded — [`SK-LLM-045`](#sk-llm-045) has the current ids.

### SK-LLM-018 — Schema-fidelity planner prompt + diagnostic retry framing

**Body:** [`decisions/SK-LLM-018-schema-fidelity-prompt.md`](./decisions/SK-LLM-018-schema-fidelity-prompt.md). `PLAN_SYSTEM` gains schema-literal + verbatim-casing + dialect-strict + `Evidence:`-authoritative directives; retry reframed as **diagnose-first, surgical-fix** ([`SK-QUAL-005`](../quality-eval/FEATURE.md#sk-qual-005)).

### SK-LLM-013 — `PlanResponse` carries `model` + `confidence` for SK-TRUST-002

**Body:** [`decisions/SK-LLM-013-plan-response-shape.md`](./decisions/SK-LLM-013-plan-response-shape.md). `PlanResponse` widens to `{ sql, model, confidence }`; `confidence` is a `1.0` placeholder until `quality-eval` calibrates per-tier floors (`SK-TRUST-003`). The plan cache stores both.

### SK-LLM-022 — Hard-plan confidence threshold = 0.75 (env-tunable)

**Body:** [`decisions/SK-LLM-022-hard-plan-confidence-threshold.md`](./decisions/SK-LLM-022-hard-plan-confidence-threshold.md). `confidence < 0.75 ⇒ hard_plan = true`, env-tunable (`HARD_PLAN_CONFIDENCE_THRESHOLD`). Pins the `SK-LLM-001` "hard" tier; drives the `SK-PREMIUM-004` upsell.

### SK-LLM-023 — Cerebras (gpt-oss-120b) leads the strict-$0 planner-tier chain

**Body:** [`decisions/SK-LLM-023-cerebras-planner-tier.md`](./decisions/SK-LLM-023-cerebras-planner-tier.md). Cerebras `gpt-oss-120b` (card-free) heads `plan` / `schema_infer` (later re-headed by [`SK-LLM-048`](#sk-llm-048)); extends [`SK-LLM-003`](#sk-llm-003); eval free lane carries the identical chain.

### SK-LLM-024 — Deterministic greedy decoding (temperature 0) across the whole free planner chain

**Body:** [`decisions/SK-LLM-024-greedy-decoding-parity.md`](./decisions/SK-LLM-024-greedy-decoding-parity.md). Every free `plan` / `schema_infer` leg decodes greedily at `temperature: 0` (reproducible baseline for the [`SK-QUAL-006`](../quality-eval/FEATURE.md#sk-qual-006) McNemar test).

### SK-LLM-025 — Recover the JSON object from reasoning-model preamble leaks before failing the parse

**Body:** [`decisions/SK-LLM-025-json-recovery-fallback.md`](./decisions/SK-LLM-025-json-recovery-fallback.md). `parseJsonResponse` gains a balanced-`{…}` recovery after strict `JSON.parse` throws — recovers reasoning-head preamble leaks; additive.

### SK-LLM-026 — Static few-shot exemplars in the planner prompt (DAIL-SQL)

**Body:** [`decisions/SK-LLM-026-static-few-shot-plan-exemplars.md`](./decisions/SK-LLM-026-static-few-shot-plan-exemplars.md). `PLAN_SYSTEM` splits into `PLAN_DIRECTIVES` (`SK-LLM-018`) + a `PLAN_FEW_SHOT` block of three static Question→JSON exemplars (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363)).

### SK-LLM-027 — Result-shape directives in the planner prompt (exact projection + REAL-cast ratios)

**Body:** [`decisions/SK-LLM-027-result-shape-directives.md`](./decisions/SK-LLM-027-result-shape-directives.md). Two `PLAN_DIRECTIVES` bullets — exact projection and REAL-cast ratios.

### SK-LLM-028 — Mistral is the strict-$0 planner-tier capacity backstop at the chain tail

**Body:** [`decisions/SK-LLM-028-mistral-capacity-backstop.md`](./decisions/SK-LLM-028-mistral-capacity-backstop.md). Appends **Mistral** (`mistral-large-latest`, card-free) behind OpenRouter on `plan` / `schema_infer` — an independent free-tier RPM pool; tail-only ⇒ additive.

### SK-LLM-030 — Rate-limit-aware failover + cooldown (a 429 honors the server's Retry-After window)

**Body:** [`decisions/SK-LLM-030-rate-limit-aware-failover.md`](./decisions/SK-LLM-030-rate-limit-aware-failover.md). New `FailoverReason "rate_limited"` + `retryAfterMs` mapped in `httpError`; the breaker opens for the server's Retry-After window (5-min cap). Refines [`SK-LLM-005`](#sk-llm-005).

### SK-LLM-029 — NULL-safe extremum ordering directive in the planner prompt

**Body:** [`decisions/SK-LLM-029-null-safe-extremum.md`](./decisions/SK-LLM-029-null-safe-extremum.md). One `PLAN_DIRECTIVES` bullet: `WHERE <col> IS NOT NULL` on single-extreme-row selection (SQLite sorts NULL first).

### SK-LLM-032 — Count-grain directive in the planner prompt (COUNT(DISTINCT) vs COUNT(\*), and SELECT DISTINCT)

**Body:** [`decisions/SK-LLM-032-count-grain-directive.md`](./decisions/SK-LLM-032-count-grain-directive.md). One `PLAN_DIRECTIVES` bullet for **Wrong COUNT Object** (`COUNT(*)` vs `COUNT(DISTINCT key)`) + **Missing DISTINCT** ([arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)); `SK-QUAL-010` guard bounds regression.

### SK-LLM-034 — Group-by-grain directive in the planner prompt (per-group GROUP BY alignment)

**Body:** [`decisions/SK-LLM-034-group-by-grain-directive.md`](./decisions/SK-LLM-034-group-by-grain-directive.md). One `PLAN_DIRECTIVES` bullet for **Unaligned Aggregation Structure** (E5, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)): "per/each/by `<category>`" needs a `GROUP BY` on that column.

### SK-LLM-035 — Numeric-text-cast directive in the planner prompt (cast TEXT-declared columns used numerically)

**Body:** [`decisions/SK-LLM-035-numeric-text-cast-directive.md`](./decisions/SK-LLM-035-numeric-text-cast-directive.md). One `PLAN_DIRECTIVES` bullet: `CAST(<col> AS REAL)` when a `TEXT`-declared column is used numerically (C1, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)); prompt-only.

### SK-LLM-036 — Workers AI: accept the object-shaped `result.response` a JSON-emitting model returns

**Body:** [`decisions/SK-LLM-036-workers-ai-structured-response.md`](./decisions/SK-LLM-036-workers-ai-structured-response.md). Accept the string *or* pre-parsed-object `result.response` Workers AI returns; objects re-serialize so `parseJsonResponse` stays the single JSON entry point.

### SK-LLM-037 — Goal-relevant schema pruning in the planner prompt (recall-first, table-granular)

**Body:** [`decisions/SK-LLM-037-goal-relevant-schema-pruning.md`](./decisions/SK-LLM-037-goal-relevant-schema-pruning.md). `buildPlanUser` prunes the schema via the pure `pruneSchemaForGoal`: token-matched tables + their `REFERENCES` closure, full schema on any doubt.

### SK-LLM-038 — Retry the chain-tail provider once on a transient failure

**Body:** [`decisions/SK-LLM-038-tail-transient-retry.md`](./decisions/SK-LLM-038-tail-transient-retry.md). The chain-tail provider retries once on `network`/`http_5xx` (150 ms backoff, abort-aware) before the router throws; tail-only ⇒ zero happy-path latency.

### SK-LLM-039 — Classify 401/403 as `auth_denied` and park the provider for a long cooldown

**Body:** [`decisions/SK-LLM-039-auth-denied-reason.md`](./decisions/SK-LLM-039-auth-denied-reason.md). `httpError` maps 401/403 to `auth_denied`; the first denial opens the breaker 30 min (human-gated) so a dead key isn't re-hit and its hedge slot rotates.

### SK-LLM-040 — Aggregate-filter directive in the planner prompt (filter groups by an aggregate in HAVING, not WHERE)

**Body:** [`decisions/SK-LLM-040-aggregate-filter-having-directive.md`](./decisions/SK-LLM-040-aggregate-filter-having-directive.md). One `PLAN_DIRECTIVES` bullet: aggregate thresholds go in HAVING after GROUP BY, not WHERE — the *HAVING* half of E5 that [`SK-LLM-034`](#sk-llm-034) left; prompt-only.

### SK-LLM-041 — Similarity-retrieved few-shot exemplar selection (DAIL-SQL retrieval half — deterministic core)

**Body:** [`decisions/SK-LLM-041-similarity-retrieved-few-shot.md`](./decisions/SK-LLM-041-similarity-retrieved-few-shot.md). The DAIL-SQL retrieval half [`SK-LLM-026`](#sk-llm-026) left — masked-token Jaccard top-k exemplar selection; ablation default off ⇒ static `PLAN_SYSTEM`.

### SK-LLM-042 — Classify a gateway's 200-body error envelope as infra, not `parse`

**Body:** [`decisions/SK-LLM-042-openrouter-200-error-classify.md`](./decisions/SK-LLM-042-openrouter-200-error-classify.md). `classifyBodyError` maps a 200 body with a top-level `error` to `rate_limited` / `provider_error` (retryable) instead of `parse` (which scored spurious `no_sql`).

### SK-LLM-043 — Single-column projection directive in the planner prompt (don't concatenate requested columns into one value)

**Body:** [`decisions/SK-LLM-043-single-column-projection-directive.md`](./decisions/SK-LLM-043-single-column-projection-directive.md). One `PLAN_DIRECTIVES` bullet, projection sibling of [`SK-LLM-027`](#sk-llm-027): each requested attribute is its own column, never `||`-fused unless asked; prompt-only.

### SK-LLM-044 — Entity-identification projection directive — REVERTED (regressed BIRD)

**Body:** [`decisions/SK-LLM-044-entity-identification-projection-directive.md`](./decisions/SK-LLM-044-entity-identification-projection-directive.md). Reverted 2026-07-18; don't re-add without a paired BIRD+Spider net-gain A/B.

### SK-LLM-045 — OpenRouter free-model roster refresh (supersedes SK-LLM-015)

**Body:** [`decisions/SK-LLM-045-openrouter-free-roster-refresh.md`](./decisions/SK-LLM-045-openrouter-free-roster-refresh.md). OpenRouter converted the SK-LLM-015 ids to paid-only (404ing the tail); the current replacement free ids are in the body.

### SK-LLM-046 — AI Gateway auth token (`cf-aig-authorization`) on every gateway-routed lane

**Body:** [`decisions/SK-LLM-046-ai-gateway-auth-token.md`](./decisions/SK-LLM-046-ai-gateway-auth-token.md). Every gateway-routed lane sends `cf-aig-authorization: Bearer <AI_GATEWAY_TOKEN>` when the secret is set; unset ⇒ header omitted.

### SK-LLM-047 — Cheap-tier chains carry a direct (non-gateway) tail (Cerebras + Mistral)

**Body:** [`decisions/SK-LLM-047-direct-tail-cheap-tier.md`](./decisions/SK-LLM-047-direct-tail-cheap-tier.md). `route`/`summarize`/`engine_classify` append Cerebras + Mistral direct behind the gateway-routed heads (2026-08-14 outage); they fire only when every gateway leg is down.

### SK-LLM-048 — GLM-4.7 (`zai-glm-4.7`, Cerebras) leads the strict-$0 planner tier — SUPERSEDED by SK-LLM-053

**Body:** [`decisions/SK-LLM-048-glm-4.7-planner-head.md`](./decisions/SK-LLM-048-glm-4.7-planner-head.md). Superseded 2026-08-22 by [`SK-LLM-053`](#sk-llm-053) (Cerebras 404'd `zai-glm-4.7`).

### SK-LLM-049 — Schema-metadata goals directive in the planner prompt

**Body:** [`decisions/SK-LLM-049-schema-metadata-goals-directive.md`](./decisions/SK-LLM-049-schema-metadata-goals-directive.md). `PLAN_DIRECTIVES` bullet: structure goals ("show all tables") answer from the Schema block as a constant SELECT; system catalogs banned. Prompt-only; eval gate per `SK-QUAL-002`.

### SK-LLM-050 — No-invented-identity directive in the planner prompt (write-scoped)

**Body:** [`decisions/SK-LLM-050-no-invented-identity-directive.md`](./decisions/SK-LLM-050-no-invented-identity-directive.md). Write-scoped `PLAN_DIRECTIVES` bullet: never fill an FK/owner/identity column with a value the goal did not supply (no arbitrary-row `LIMIT 1`, no placeholder ids). Write-scoped ⇒ read-only BIRD/Spider cannot regress (`SK-LLM-044` lesson). Pairs with `SK-TRUST-006` / `SK-ASK-028/029`.

### SK-LLM-051 — A planning failure carries its bounded cause: reason, lane, provider, model

**Body:** [`decisions/SK-LLM-051-failure-cause-propagation.md`](./decisions/SK-LLM-051-failure-cause-propagation.md). `llm_failed` carries `{reason, lane, provider?, model?}` (bounded enums + slugs only), so a rejected BYOLLM key reads as "your openrouter key was rejected", not "try rephrasing" (2026-08-17); raw provider text stays on the `llm.plan` span.

### SK-LLM-052 — A paid lane's `auth_denied` fails loud; it never silently serves the free chain

**Body:** [`decisions/SK-LLM-052-auth-denied-never-falls-back.md`](./decisions/SK-LLM-052-auth-denied-never-falls-back.md). Narrows `SK-PREMIUM-020`: the lane fallback covers a gateway *fault*, not rejected credentials — those hide a dead paid lane behind a working-looking free answer, on every request after it too.

### SK-LLM-053 — Qwen3.6-27B (`qwen/qwen3.6-27b`, Groq) leads the strict-$0 planner tier — SUPERSEDED by SK-LLM-054

**Body:** [`decisions/SK-LLM-053-qwen3.6-27b-planner-head.md`](./decisions/SK-LLM-053-qwen3.6-27b-planner-head.md). Superseded 2026-08-29 by [`SK-LLM-054`](#sk-llm-054) (within-family upgrade 3.6 → 3.8 on the same Groq key). Original: supersedes [`SK-LLM-048`](#sk-llm-048) (Cerebras 404'd `zai-glm-4.7`, 2026-08-22); Qwen3.6-27B (`groq-qwen`) heads `plan` / `schema_infer` on the card-free Groq key, dispatched **plain**; gpt-oss-120b retained fallback ([`SK-LLM-023`](#sk-llm-023)).

### SK-LLM-054 — Qwen3.8-27B (`qwen/qwen3.8-27b`, Groq) leads the strict-$0 planner tier

**Body:** [`decisions/SK-LLM-054-qwen3.8-27b-planner-head.md`](./decisions/SK-LLM-054-qwen3.8-27b-planner-head.md). Supersedes [`SK-LLM-053`](#sk-llm-053) (within-family upgrade): the newer Qwen3.8-27B (released 2026-08-14, now live on our Groq key) replaces 3.6 as the `groq-qwen` planner head — benchlm.ai overall 72.5 vs 53.8, SWE-bench Pro 61.7, LiveCodeBench v6 90.3. Same key, same renewable no-card free tier, dispatched **plain**, gpt-oss-120b retained fallback. Live-verified 2026-08-29 (clean JSON on simple + JOIN/GROUP-BY/HAVING prompts, ~0.6–0.7 s); measurement-gated — BIRD/Spider dispatch confirms non-regression; one-line revert to 3.6.

### SK-LLM-033 — Schema-inference prompt requires insertable sample rows

**Body:** [`decisions/SK-LLM-033-schema-infer-insertable-sample-rows.md`](./decisions/SK-LLM-033-schema-infer-insertable-sample-rows.md). `SCHEMA_INFER_SYSTEM` gains a `sample_rows`-validity contract (parent rows first, FK values present, NOT-NULL complete); no-500 floor [`SK-HDC-018`](../hosted-db-create/decisions/SK-HDC-018-sample-insert-graceful-degradation.md).

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

- **Failover when every provider in a chain fails** — Decided shape (per `GLOBAL-033` → `GLOBAL-012`): throw a structured `provider_chain_exhausted` envelope; **no** head-retry (a fresh `/v1/ask` re-enters the chain). **Parked until** the surfaces render it — not emitted in `packages/llm` yet.
- **Parked until `quality-eval` Phase 2:** `nlqdb.plan.quality_score` histogram shape + LLM-as-judge prompt + "provider silently degrading" alert threshold — depends on the judge harness.
- **Per-user credit accounting — RESOLVED:** hosted-premium allowance/overage is D1 `premium_allowance_period` + Stripe Billing Meters (`SK-PREMIUM-009`/`017`; no Lago).
- **Parked until a leak-rate regression forces it ([`SK-LLM-025`](#sk-llm-025)):** a per-call JSON-recovery-rate counter at the `router.ts` boundary.
- **Parked until burst abuse shows up:** free-tier RPM queue ("queued — 2s" UX, `architecture.md §7.1`); today bursts over a provider's RPM fail-and-fall-through. Owned with `rate-limit` / `observability`.
