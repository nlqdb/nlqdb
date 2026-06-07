# SK-LLM-030 — Rate-limit-aware failover: a 429 opens the breaker for the server's Retry-After window

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Refines the
breaker semantics of
[`SK-LLM-005`](./SK-LLM-005-circuit-breaker.md): the 3-strike / 60-s path
now covers 5xx / network / timeout blips, while a 429 takes a new
immediate per-incident-cooldown path — see *Consequence*.

- **Decision:** A new `FailoverReason` `"rate_limited"`, and
  `ProviderError` gains an optional `retryAfterMs`. One mapping point —
  `httpError(label, res)` in `providers/_shared.ts` — maps HTTP **429 →
  `rate_limited`** carrying `parseRetryAfter(res.headers)` (RFC 9110
  delta-seconds *or* HTTP-date), and every other non-2xx → the existing
  `httpReason` 5xx/4xx split. All six providers inherit it by routing
  their `!res.ok` branch through `httpError` (the five OpenAI-compat
  providers via `openAICompatibleChat`; Gemini + Workers-AI call it
  directly) — no per-provider rate-limit code. The router treats
  `rate_limited` specially: it opens that provider's breaker
  **immediately** (no 3-strike wait) for
  `min(max(retryAfterMs, cooldownMs), maxRateLimitCooldownMs)`, then
  rotates to the next chain entry as it does today.
  `maxRateLimitCooldownMs` defaults to **5 min** (prod safety); the eval
  free lane (`tools/eval/src/lanes.ts`) sets it to `Infinity` to honor
  the server's full window. Observability reuses
  `nlqdb.llm.failover.total{reason}` (`rate_limited` is one new bounded
  label value) plus one span attribute `nlqdb.llm.retry_after_ms` — no
  new metric, no new log line. Resume contract: the router's
  `AllProvidersFailedError.attempts[]` lets a caller distinguish
  `attempts.every(a => a.reason === "rate_limited")` ("whole chain is
  rate-limited → checkpoint & resume later") from genuine failures.
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** A 429 is an unambiguous "back off now" — qualitatively
  different from a flaky 500. Waiting for `SK-LLM-005`'s three strikes
  burns two more requests against a provider that already named its
  window; honoring `Retry-After` rotates instantly and stops hammering
  an exhausted free-tier quota (the dominant `all providers in chain
  failed` loss mode, `SK-LLM-028`). A single shared mapping point means
  all six providers get identical, correct handling with zero per-provider
  code — a new provider physically can't forget it. Feeding the same
  signal to the eval lets a daily-token-capped run checkpoint-and-resume
  instead of recording a free-tier 429 as a spurious `no_sql`.
- **Consequence in code:** `types.ts` (+`rate_limited`, +`retryAfterMs`,
  `ProviderError`'s 3rd arg becomes `{status?, retryAfterMs?}`);
  `_shared.ts` (+`httpError`, +`parseRetryAfter`); three provider
  `!res.ok` branches collapse to `throw await httpError(...)` (provider
  files net-shrink, no logic added); `router.ts` adds a per-incident
  `cooldownMsOverride` to the existing breaker store, the immediate-open
  branch on `rate_limited`, the `maxRateLimitCooldownMs` option + 5-min
  default, and the `nlqdb.llm.retry_after_ms` span attribute. The eval
  free lane opts into the uncapped window. `hedge_lost` / `parse` /
  401-403 breaker exclusions are unchanged; `rate_limited` is *not* an
  auth-bypass even though 429 is 4xx-class.
- **Alternatives rejected:**
  - **Per-provider retry loops with backoff** — copies the same backoff
    into all six providers (exactly what the shared helper avoids) and
    re-hits the same exhausted provider instead of rotating.
  - **A global token-bucket / pre-emptive throttle on the hot path** —
    premature: we don't know each free tier's true limit, and the breaker
    already rotates on the 429. Parked under `llm-router` Open questions
    ("free-tier RPM queue").
  - **Honoring an uncapped `Retry-After` in prod** — a provider sending
    minutes would wedge a router that exists to rotate for latency; prod
    caps at 5 min, only the eval (which waits anyway) honors the full
    value.
  - **Sleeping `Retry-After` on the prod hot path** — prod rotates to the
    next provider rather than waiting; only the eval's resume loop waits.
