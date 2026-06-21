# SK-LLM-024 — Deterministic greedy decoding (temperature 0) across the whole free planner chain

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md).

- **Decision:** Every provider on the free `plan` / `schema_infer`
  chain decodes **greedily at `temperature: 0`**. Cerebras, Groq and
  OpenRouter (OpenAI-compatible `temperature`) and Gemini
  (`generationConfig.temperature`) already pin it; this brings the
  **Workers AI** leg into the same contract — its native `/ai/run`
  body had been `{ messages }` only, inheriting Cloudflare's stochastic
  **0.6** default (verified against the Workers AI text-generation
  parameter docs, 2026-06). `packages/llm/src/providers/workers-ai.ts`
  now sends `{ messages, temperature: 0 }`.
- **Core value:** Bullet-proof, Free
- **Why:** Three reasons, none of which cost a token:
  (a) **Accuracy** — single-pass execution-accuracy in the canonical
  text-to-SQL literature is measured under greedy decoding (temperature
  0 = argmax at each step); sampling at 0.6 trades EX for diversity we
  don't use on a single-pass planner.
  (b) **Reproducibility** — the eval's McNemar paired-binary test
  ([`SK-QUAL-006`](../../quality-eval/FEATURE.md#sk-qual-006)) pairs
  per-question outcomes between the baseline and the current run; a
  stochastic leg flips outcomes run-to-run, inflating the discordant
  cells (b / c) and turning a clean regression signal into noise.
  (c) **Parity** — the eval free lane must mirror production
  ([`quality-eval/FEATURE.md` §5 guardrail](../../quality-eval/FEATURE.md));
  a non-deterministic leg means the cron measures a system that varies
  between runs, so a delta can't be attributed to a code change.
  Workers AI is the 4th hop behind Cerebras → Gemini → Groq, so the
  EX magnitude on this leg is small and unmeasured; the certain win is
  baseline determinism, which makes every *other* lever's measurement
  trustworthy.
- **Consequence in code:** one line in
  `packages/llm/src/providers/workers-ai.ts`
  (`{ messages }` → `{ messages, temperature: 0 }`);
  `packages/llm/test/providers/workers-ai.test.ts` pins it by asserting
  the request body carries `temperature: 0`. No new config surface, no
  API-shape change, no extra call.
- **Alternatives rejected:**
  - **Leave Workers AI at the 0.6 default** — stochastic; breaks
    reproducibility and forfeits the greedy-EX best practice for no gain.
  - **Make temperature a per-provider env knob** — premature config
    surface (`CLAUDE.md` §P5); no caller wants a non-zero plan
    temperature today. Revisit only if self-consistency-N
    ([`quality-score-source-of-truth.md` §4 #3](../../../progress/quality-score-source-of-truth.md))
    lands, which deliberately samples at temperature > 0 on a *separate*
    code path — it would not reuse the planner default. **(Landed
    2026-06-21, [`SK-QUAL-017`](../../quality-eval/decisions/SK-QUAL-017-self-consistency-majority-vote.md):
    an optional per-*request* `PlanRequest.temperature` — not the rejected
    per-provider env knob — threads through every `callChat`, defaulting to
    `0` when unset. The greedy production chain never sets it, so this
    invariant is unchanged; only the eval's self-consistency sampler overrides
    it.)**
  - **Also enable Workers AI JSON mode (`response_format`)** — the
    native `/ai/run` endpoint requires a per-op `json_schema` (no
    schemaless `json_object`, verified against the Workers AI JSON-mode
    docs 2026-06); the prompt's "strict JSON, no fences" contract plus
    the [`SK-LLM-025`](./SK-LLM-025-json-recovery-fallback.md) recovery
    fallback already govern output, so schema-mode is a larger, per-op
    change deferred until a measured JSON-parse-failure rate justifies it.
  - **Switch Workers AI to the OpenAI-compat endpoint for `json_object`**
    — changes the auth / URL / error-shape contract of a marginal
    fallback leg for no measured win; out of scope.
