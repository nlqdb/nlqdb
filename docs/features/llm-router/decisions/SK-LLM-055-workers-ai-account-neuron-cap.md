# SK-LLM-055 — Workers AI stops at 7,000 of the account's daily neurons

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Bounds the
Workers AI leg of [`SK-LLM-003`](./SK-LLM-003-strict-zero-chain.md)'s chain.

- **Decision:** both Workers AI call sites (`apps/api/src/llm-router.ts`,
  `tools/eval/src/lanes.ts`) pass `accountNeuronCap: WORKERS_AI_ACCOUNT_NEURON_CAP`
  (7,000). Before a call, the provider reads the account's Workers AI neurons
  today from Cloudflare's GraphQL analytics (`aiInferenceAdaptiveGroups`,
  cached 60 s per instance). At or past the cap it throws `rate_limited` with
  `retryAfterMs` up to 00:00 UTC, so the breaker keeps the leg out until the
  allocation resets. An unreadable spend throws `provider_error`. Either way
  the chain fails over and the model is never called.
- **Core value:** Free, Bullet-proof
- **Why:** the 10,000 free neurons a day belong to the Cloudflare account, not
  to nlqdb, and other Workers on the account draw from them. On 2026-10-26,
  116 llama-3.3-70b REST calls between 15:05 and 15:10 (3,588 neurons) took the
  account to 11,203. From then on, every caller on the account got error 4006,
  including another Worker whose only model is Workers AI. Past the allocation,
  a Workers Paid account bills, and a metered path is not `$0`. A 7,000 ceiling
  leaves 3,000 a day for the rest of the account. nlqdb loses nothing it
  depends on: Workers AI is a mid-chain fallback, and OpenRouter and Mistral
  follow it.
- **Consequence in code:** `CF_AI_TOKEN` needs **Account Analytics: Read**.
  Without it, the leg is skipped (`provider_error`), never called blind.
- **Alternatives rejected:**
  - **Count neurons in-process.** Isolates and eval processes don't share a
    counter, and the other Workers on the account are invisible to it. Only
    Cloudflare's own count sees the whole account.
  - **AI Gateway rate limits.** They limit requests, not neurons, and the eval
    harness calls Workers AI directly, bypassing the gateway.
  - **Drop Workers AI from the chain.** It loses a working free leg on the
    ~10% of asks that reach it, when a ceiling is enough.
