# SK-LLM-053 — Qwen3.6-27B (`qwen/qwen3.6-27b`, Groq) leads the strict-$0 planner tier

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). **Replaces the
GLM-4.7 planner head from [`SK-LLM-048`](./SK-LLM-048-glm-4.7-planner-head.md)**
(forced: the model was pulled from Cerebras) and keeps the gpt-oss-120b fallback
from [`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md).

- **Trigger (a live bug, not a preference):** As of **2026-08-22** the SK-LLM-048
  planner head `zai-glm-4.7` returns **HTTP 404** on Cerebras — verified with our
  own `CEREBRAS_API_KEY` against both `/v1/models` (catalog is now only
  `gpt-oss-120b` + `gemma-4-31b`) and a `/v1/chat/completions` probe (`model:
  zai-glm-4.7` → 404). Cerebras pruned GLM-4.7 from its public catalog. The chain
  did not fail loud: every `plan` / `schema_infer` call burned one 404 round-trip
  on `cerebras-glm`, then failed over — so production was silently running on the
  gpt-oss-120b / Gemini fallback (the pre-SK-LLM-048 quality), plus the wasted
  head round-trip and breaker churn on every planner call.
- **Decision:** **Qwen3.6-27B** (model id `qwen/qwen3.6-27b`) becomes the head of
  the planner tier (`plan` + `schema_infer`), served on the **same card-free Groq
  key** already used for gpt-oss (`GROQ_API_KEY`). It rides a distinct chain name
  **`groq-qwen`** (`createGroqQwenProvider`) so gpt-oss-120b stays in the chain as
  a fallback. New planner order:
  `[groq-qwen, gemini, cerebras, groq, workers-ai, openrouter, mistral]` — Gemini
  sits second (independent pool) so a Groq-Qwen `429` fails over to fresh capacity
  rather than the same Groq key; gpt-oss-120b (`cerebras`, an independent Cerebras
  pool) is retained third. `groq` (gpt-oss-120b) is a **distinct Groq model** with
  its own per-model daily quota, so the fourth leg does not cannibalise the head's.
  The dead `cerebras-glm` leg is dropped from the prod + eval provider arrays; the
  `createCerebrasGlmProvider` factory + reasoning-param plumbing are **retained**
  as reusable Cerebras-reasoning-model infra (harmless, tested — no chain names it).
  The eval free lane (`tools/eval/src/lanes.ts`) carries the identical chain so
  "the eval measures what production ships" holds.
- **Core value:** Free, Bullet-proof
- **Why Qwen3.6-27B:** A 27B dense coder/reasoner at **77.2% SWE-bench Verified**
  (Qwen's own scaffold; within ~3.7 pp of Claude Opus 4.6) — **above** the pulled
  GLM-4.7 (73.8%) and far above gpt-oss-120b (~30% community-reported). Since the
  planner model is the dominant term in free-chain NL→SQL accuracy
  ([`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md) established this), a
  strong working head is the single highest-leverage engine-quality lever under
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md). Crucially it needs
  **no new credential and no new billing surface**: `qwen/qwen3.6-27b` is live on
  our existing Groq key (verified against `/v1/models`, 2026-08-22), on the same
  renewable **no-card** Groq free tier (≈30 RPM / 6k TPM / 1,000 RPD per model)
  that already satisfies
  [`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md) — unlike
  NVIDIA NIM / Cohere (finite credit pools, rejected in
  [`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md) /
  [`SK-LLM-048`](./SK-LLM-048-glm-4.7-planner-head.md)) or SambaNova (20 RPD, no
  key).
- **Live verification (2026-08-22, our key):** On a small planner prompt Qwen3.6-27B
  returns **correct JSON-only `content`** (`{"sql": "SELECT name FROM employees
  ORDER BY salary DESC LIMIT 3"}`) in **~1.2 s** total. It IS a reasoning model
  (emits a short, self-bounded reasoning trace — ~300 completion-token reasoning
  in the probe) but, unlike GLM-4.7 on Cerebras, it emits clean `content` in its
  **default** decoding mode with **no `reasoning_effort`**. The opposite is true
  here: forcing `reasoning_effort:"low"` returns **empty `content`** (verified
  2026-08-22) — a silent `parse` outage — so this head is deliberately dispatched
  **plain**. That ~1.2 s median sits inside the inherited
  [`SK-LLM-014`](./SK-LLM-014-hedged-request-race.md) 2000 ms hedge head-start, so
  the hedge still fires only on the slow tail. Under load the free tier returns a
  429 (RPM/TPM) fast → clean failover to Gemini.
- **Consequence in code:** `createGroqQwenProvider` reuses `createGroqProvider`
  with `name:"groq-qwen"` and Qwen on the two planner ops; `createGroqProvider`
  gains an optional `name?: ProviderName` override (mirrors the Cerebras pattern).
  `ProviderName` gains `"groq-qwen"` — one new bounded OTel `gen_ai` /
  failover-metric label value ([`SK-LLM-006`](./SK-LLM-006-otel-semconv.md)), same
  posture as the Cerebras/Mistral additions. The slug `qwen/qwen3.6-27b` lives
  once, in `providers/groq.ts`. An absent key is harmless (`?? ""` → auth-fails →
  failover), same as every other free provider. No new secret: `GROQ_API_KEY` is
  already in the api-Worker subset (`scripts/mirror-secrets-workers.sh`).
- **Measurement gate — discharged 2026-08-24 by founder waiver on record**
  (path b; merged as #1041): the incumbent head `zai-glm-4.7` was already
  404-dead so prod was already on the gpt-oss-120b/Gemini fallback — a working
  77%-SWE-bench head cannot regress below today's floor, and revert is one line.
  A confirming BIRD-dev + Spider dispatch may still be run post-merge; the gate
  no longer blocks. See [`history/founder-actions-log.md`](../../../history/founder-actions-log.md).
- **Measurement gate (the rule that was waived):** This changes the planner head — the
  single most engine-quality-sensitive component — so, per the
  `quality-score-source-of-truth.md` §5 guardrail ("measured, not assumed") and
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md)'s "degrades 0" rule,
  **promotion is gated on a BIRD-dev + Spider quality-eval dispatch** showing
  non-regression, before this merges to production. PR CI keeps LLM keys mocked
  ([`SK-QUAL-002`](../../quality-eval/decisions/SK-QUAL-002-weekly-cron.md)),
  so that measurement is the separate `quality-eval-bird-mini.yml` /
  `quality-eval-spider2-lite.yml` **manual `workflow_dispatch`** (the scheduled
  crons were retired per SK-QUAL-002 — no run fires on its own; an operator must
  dispatch it), not PR CI. If the dispatch shows a regression, revert is one line
  (flip the `plan` / `schema_infer` head back to `cerebras`), the same posture
  that reverted `SK-LLM-044` / `SK-LLM-048`'s gate. The benchmark deltas above are
  vendor-reported ranking signal, not our own harness's EX — the dispatch is the
  source of truth. **Context that lowers the risk:** the current
  production head (`zai-glm-4.7`) is already 404-dead, so prod is *already* on the
  gpt-oss-120b/Gemini fallback; a working 77%-SWE-bench head is very unlikely to
  regress that state, but the gate still decides.
- **Alternatives rejected:**
  - **Revert to gpt-oss-120b head (drop `cerebras-glm`, add nothing)** — smallest
    diff and restores a working (non-404) head, but throws away the SK-LLM-048
    intent ("the strongest strict-$0 model heads the planner") and ships a ~30%-
    SWE-bench head when a 77% one is live on an existing key. Kept gpt-oss-120b as
    the retained fallback instead.
  - **Cerebras `gemma-4-31b`** — now on our Cerebras key (strict-$0), but Gemma 4
    31B is a weaker coder/reasoner than both gpt-oss-120b and Qwen3.6-27B for
    text-to-SQL. No gain over the retained gpt-oss fallback.
  - **NVIDIA NIM (`NVIDIA_API_KEY`) — GLM-5.2 / DeepSeek-V4** — newer, stronger
    models, and the key is already provisioned (in GHA), but the free tier is a
    **finite signup credit pool**, not renewable — the same `GLOBAL-013`
    sustainability failure already rejected in `SK-LLM-023` / `SK-LLM-048`. Left as
    an `e2e-coverage`-only lane.
  - **Cohere trial (`COHERE_TRIAL_API_KEY`) / HF Inference (`HF_ACCESS_TOKEN`)** —
    keys provisioned, but Command / HF-served models are weaker on coding/SQL and
    the trial tiers carry monthly caps; not a planner-head upgrade.
  - **Qwen3-Coder-480B (`qwen/qwen3-coder:free`, OpenRouter)** — stronger still,
    but OpenRouter's free tier is ~50 requests/day — too small for a production
    planner (unchanged from `SK-LLM-048`). Parked as a candidate second opinion.
