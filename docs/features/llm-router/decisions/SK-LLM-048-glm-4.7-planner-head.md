# SK-LLM-048 — GLM-4.7 (`zai-glm-4.7`, Cerebras) leads the strict-$0 planner tier

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends the
Cerebras planner head from [`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md)
(gpt-oss-120b is retained as a fallback, not removed) and re-tunes the
[`SK-LLM-014`](./SK-LLM-014-hedged-request-race.md) hedge head-start for the new
head's latency profile.

- **Decision:** **GLM-4.7** (model id `zai-glm-4.7`) becomes the head of the
  planner tier (`plan` + `schema_infer`), served on the **same card-free
  Cerebras key** already used for gpt-oss-120b (`CEREBRAS_API_KEY`). It rides a
  distinct chain name **`cerebras-glm`** (`createCerebrasGlmProvider`) so
  gpt-oss-120b stays in the chain as a fallback. New planner order:
  `[cerebras-glm, gemini, cerebras, groq, workers-ai, openrouter, mistral]` —
  Gemini sits second (independent pool) so a GLM `429` fails over to fresh
  capacity rather than the same exhausted Cerebras key; gpt-oss-120b
  (`cerebras`) is retained third. The `SK-LLM-014` hedge head-start rises
  `800 ms → 2000 ms` on both planner ops. The eval free lane
  (`tools/eval/src/lanes.ts`) carries the identical chain so "the eval measures
  what production ships" holds.
- **Core value:** Free, Bullet-proof
- **Why:** GLM-4.7 is a materially stronger reasoner/coder than gpt-oss-120b —
  **SWE-bench Verified 73.8%** and **LiveCodeBench v6 84.9%** (top open-weight,
  cited on par with/ahead of Claude Sonnet 4.x), versus gpt-oss-120b's
  community-reported **~30% SWE-bench Verified**. Since the planner model is the
  dominant term in free-chain NL→SQL accuracy
  ([`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md) established this), a
  stronger head is the single highest-leverage engine-quality lever
  under [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md). Crucially it
  needs **no new credential and no new billing surface**: `zai-glm-4.7` is
  live on our existing Cerebras key (verified against `/v1/models`, 2026-08-15),
  on the same renewable **1M tokens/day, no-card** free tier that already
  satisfies [`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md)
  — unlike NVIDIA NIM / Cohere (finite credit pools, rejected in
  [`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md)/[`SK-LLM-028`](./SK-LLM-028-mistral-capacity-backstop.md)) or
  Z.ai's own tier (Chinese-phone gated).
- **Live verification (2026-08-15, our key):** GLM-4.7 is a **reasoning
  model** — dispatched naively it spends the entire completion budget on
  `reasoning_tokens` and returns **empty `content`**, which
  `openai-compatible.ts` rejects as a `parse` error (a silent planner outage).
  With **`reasoning_effort:"low"`** it caps reasoning to ~1.1k tokens and emits
  clean JSON-only `content`: correct SQL in **~1.6 s median / 2.6 s** on a
  ~5.2k-token schema prompt — inside the `plan` (5000 ms) and `schema_infer`
  (8000 ms) router budgets. A completion-token ceiling (3000, sent as
  `max_completion_tokens` — the only ceiling param Cerebras documents)
  guarantees room for reasoning + output on `schema_infer`'s larger responses. Under load the free
  tier returns a `queue_exceeded` **429** fast (~0.5 s) → clean failover to
  Gemini. That ~1.6 s median (vs Gemini-Flash's ~0.8 s, the old head-start
  basis) is why the hedge head-start rises to 2000 ms: at 800 ms the hedge
  would fire Gemini on *every* planner call, doubling its load.
- **Consequence in code:** `createCerebrasGlmProvider` reuses
  `createCerebrasProvider` with `name:"cerebras-glm"`, GLM on the two planner
  ops, and `reasoning_effort`/`max_completion_tokens` forwarded through
  `openAICompatibleChat` (two new optional `ChatRequest` fields; every other
  caller leaves them unset, so their bodies are byte-identical). `ProviderName`
  gains `"cerebras-glm"` — one new bounded OTel `gen_ai` / failover-metric label
  value (`SK-LLM-006`), same posture as the Cerebras/Mistral additions. Routed
  **direct** (no AI Gateway base), same rationale as gpt-oss-120b: the
  provider-agnostic plan cache (`SK-LLM-010`) is the real cache layer. An absent
  key is harmless (`?? ""` → auth-fails → failover), same as every other free
  provider.
- **Measurement gate (do not merge blind):** This changes the planner head, the
  single most engine-quality-sensitive component, so — per the
  `quality-score-source-of-truth.md` §5 guardrail ("measured, not assumed") and
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md)'s "degrades 0"
  rule — **promotion is gated on a BIRD-dev +
  Spider quality-eval dispatch** showing non-regression versus the current
  gpt-oss-120b head, before this merges to production. PR CI keeps LLM keys
  mocked (`SK-QUAL-002`), so that measurement is the separate
  `quality-eval-bird-mini.yml` / `quality-eval-spider2-lite.yml` cron, not PR
  CI. If the cron shows a regression, revert is one line (flip the `plan` /
  `schema_infer` head back to `cerebras`), the same posture that reverted
  `SK-LLM-044`. The benchmark deltas above are vendor-reported ranking signal,
  not our own harness's EX numbers — the cron is the source of truth.
- **Alternatives rejected:**
  - **Replace gpt-oss-120b outright (no `cerebras-glm`, just swap the model)** —
    smaller diff, but loses gpt-oss-120b as a known-good planner fallback and
    forces the GLM-429 failover onto Gemini alone. Keeping both off the one key
    costs only a bounded label value and preserves today's chain as a strict
    suffix, tightening the "degrades 0" story.
  - **Qwen3-Coder-480B (`qwen/qwen3-coder:free`, OpenRouter)** — a text-to-SQL
    specialist (~69.6% SWE-bench), but OpenRouter's free tier is **~50
    requests/day** (1000/day only after a one-time $10 top-up) — too small for a
    production planner and not strictly $0. Parked as a candidate second opinion.
  - **NVIDIA NIM direct (GLM-5.2 / DeepSeek-V3.2 via our `NVIDIA_API_KEY`)** —
    newer models, but the free tier is a **finite ~1000-credit signup pool**,
    not renewable — the same `GLOBAL-013` sustainability failure already
    rejected in `SK-LLM-023`/`SK-LLM-028`. Left as an `e2e-coverage`-only lane.
  - **SambaNova `DeepSeek-V3.2`** — genuinely renewable + no-card, but **20
    requests/day** caps it to a last-resort backstop, and we hold no key. If a
    DeepSeek path is ever wanted, NVIDIA NIM serves it at higher RPM (still
    finite-credit). Parked.
  - **Leaving the hedge head-start at 800 ms** — with a ~1.6 s head it fires the
    hedge on every call, doubling Gemini load and risking its tightened free
    RPD; 2000 ms restores the "hedge only the slow tail" intent.
