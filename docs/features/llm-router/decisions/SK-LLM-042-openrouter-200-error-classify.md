# SK-LLM-042 — Classify a gateway's 200-body error envelope as infra, not `parse`

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Sibling of
[`SK-LLM-030`](./SK-LLM-030-rate-limit-aware-failover.md) (429 → `rate_limited`)
and [`SK-LLM-039`](./SK-LLM-039-auth-denied-reason.md) (401/403 →
`auth_denied`): the third place a provider failure was hiding inside a
generic reason.

- **Decision:** In `openAICompatibleChat`, when a **200** response body
  carries a top-level `error` object, throw a classified `ProviderError`
  from `classifyBodyError` **before** the missing-`content` check —
  `rate_limited` when the envelope is 429-shaped (`code === 429`, or
  `message`/`type`/`metadata.error_type` mentions "rate"/"429"),
  `provider_error` otherwise. To let the frontier lane's single tail
  provider actually recover a transient one, `provider_error` joins
  `TAIL_RETRY_REASONS` ([`SK-LLM-038`](./SK-LLM-038-tail-transient-retry.md)).
- **Core value:** Free, Bullet-proof
- **Why:** OpenRouter (and any OpenAI-compat gateway) commits the HTTP 200 +
  headers, then can have the upstream provider fail mid-request — the status
  can no longer change, so the failure returns as a top-level `error`
  envelope in a 200 body ([OpenRouter, "Errors and
  debugging"](https://openrouter.ai/docs/api/reference/errors-and-debugging),
  which also prescribes *retry* for the no-content case). Left unhandled it
  fell through to the generic `parse` branch. `parse` is an **engine
  answer-signal** in the eval ([`SK-QUAL-020`](../../quality-eval/FEATURE.md)) —
  a scored `no_sql` that reads as "the model produced junk". It is not: it is
  an infra failure. The 2026-07-03 agentic-frontier smoke carried **7
  `openrouter:parse` no_sql** on the frontier lanes, capping their ceiling
  below the Phase 2 ≥ 0.80 gate. Reclassifying moves the rate-limit ones to a
  capacity pause (checkpoint + resume, never scored) and makes the rest a
  retryable failover/tail-retry signal instead of a permanent engine loss.
- **Consequence in code:** `openai-compatible.ts` gains the `BodyError` type
  + `classifyBodyError`; `parsed` widens with `error?: BodyError`; the check
  is shared by every OpenAI-compat provider (Groq, OpenRouter, BYOLLM) so all
  inherit it — a 200-body error is standard across the wire format, so this is
  correct everywhere, not OpenRouter-only. Strictly additive: a well-formed
  200 with no `error` field is untouched, so no passing row can regress.
- **Alternatives rejected:**
  - **Keep it as `parse` and just widen the eval's non-engine reason set** —
    games the metric without fixing production, which would still surface the
    infra failure as an unrecoverable error to a real user.
  - **OpenRouter-specific handling in `openrouter.ts`** — the 200-body error
    envelope is standard OpenAI-compat, not an OpenRouter quirk; putting it in
    the shared caller covers Groq/BYOLLM for free with no duplication.
