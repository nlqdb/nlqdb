# SK-LLM-028 — Mistral is the strict-$0 planner-tier capacity backstop at the chain tail

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Additive to
[`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md) (Cerebras still
leads); this appends a sixth provider behind OpenRouter on the planner
tier. It updates one empirical premise SK-LLM-023 used to reject a
backstop — see *Why*.

- **Decision:** A sixth card-free provider, **Mistral**, joins the
  strict-$0 chain at the **tail** of the planner tier (`plan` +
  `schema_infer`). The new order is
  `[cerebras, gemini, groq, workers-ai, openrouter, mistral]`; cheap-tier
  (`route` / `engine_classify`) and `summarize` are unchanged. Model
  **`mistral-large-latest`** (Mistral Large 3, the strongest reasoner the
  free Experiment tier exposes; verified live against `/v1/models` for our
  key, 2026-06). Provider `packages/llm/src/providers/mistral.ts`
  (OpenAI-compatible, base `https://api.mistral.ai/v1`, greedy
  `temperature: 0` per `SK-LLM-024`); key `MISTRAL_API_KEY`. The eval free
  lane (`tools/eval/src/lanes.ts`) carries the identical chain so "the eval
  measures what production ships" holds.
- **Core value:** Free, Bullet-proof
- **Why:** The BIRD-dev baseline (`baseline-2026-06-15.json`) has **51/500
  (10.2%) `no_sql` losses, all carrying `all providers in chain failed`** —
  pure free-tier capacity exhaustion (every head provider 429'd or its
  circuit opened, `SK-LLM-005`), **not** a reasoning loss. A stronger head
  model (`SK-LLM-023`) cannot recover these — they need an *independent*
  free-tier RPM pool that the head chain's exhausted quota doesn't share.
  This directly contradicts `SK-LLM-023`'s premise that "the free chain
  rarely fully fails," which it used to reject a capacity backstop; the
  baseline refutes that, so the backstop is now warranted. A tail entry
  fires **only** when the entire head chain is exhausted, so it can convert
  `no_sql → match` without changing any question the head chain already
  answers — **strictly additive: lifts BIRD, never regresses a passing
  row**, and being dataset-agnostic it helps Spider on the same failure
  mode. Mistral's **Experiment** tier is card-free (phone-verified, no
  card) with a renewable 1B-tokens/month · 500K-tokens/minute quota
  (verified 2026-06), satisfying `GLOBAL-013` — unlike a finite trial
  credit pool. The size of the lift is **measured, not assumed**: the next
  BIRD/Spider cron produces the `no_sql`-recovery delta against the
  baseline.
- **Consequence in code:** `createMistralProvider` reuses
  `openAICompatibleChat`; `ProviderName` gains `"mistral"` (the OTel
  `gen_ai` span + failover-metric label come for free through the router
  per `SK-LLM-006`, one new bounded label value). Routed **direct** (no AI
  Gateway base), same rationale as Cerebras — the provider-agnostic plan
  cache (`SK-LLM-010`) is the real cache layer. Both quality-eval
  workflows wire `MISTRAL_API_KEY`; `scripts/verify-secrets.sh` adds the
  live `/v1/models` probe. An absent key is harmless either way: the eval
  lane omits the unregistered provider (`not_configured`); production
  registers it with an empty key (`?? ""`), which auth-fails (`http_4xx`,
  excluded from the breaker) and — being the tail — changes nothing.
- **Alternatives rejected:**
  - **NVIDIA NIM (`build.nvidia.com`) instead of / alongside Mistral** —
    card-free and OpenAI-compatible too, but its free tier is a finite
    ~5,000-credit pool (verified 2026-06), not a renewable quota — same
    `GLOBAL-013` *sustainability* failure as the rejected
    `COHERE_TRIAL_API_KEY`. Parked until NVIDIA exposes a renewable
    free tier.
  - **Mistral as the head instead of Cerebras** — `SK-LLM-023` already
    measured Cerebras (`gpt-oss-120b`, ~o4-mini parity, ~3,000 tok/s) as
    the strongest card-free head; demoting it to add Mistral would trade
    reasoning ceiling for capacity we get for free at the tail.
  - **`codestral-latest` at the tail instead of `mistral-large-latest`** —
    Codestral is code-specialised, but the tail recovers *hard*
    chain-exhaustion questions where general reasoning matters more than
    SQL-dialect fluency; Mistral Large 3 is the stronger reasoner. Revisit
    if the cron shows the tail's recovered rows are dialect-bound.
  - **A `provider_chain_exhausted` head-retry with backoff** — re-hitting
    the same exhausted providers burns wall-clock for no new capacity; an
    independent provider is the fix, and a fresh `/v1/ask` already
    re-enters the chain (`llm-router` Open questions).
