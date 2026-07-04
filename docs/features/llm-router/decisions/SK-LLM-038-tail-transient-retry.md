# SK-LLM-038 — Retry the chain-tail provider once on a transient failure

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Closes the
gap [`SK-LLM-028`](./SK-LLM-028-mistral-capacity-backstop.md) left open:
the Mistral capacity backstop sits at the tail, so a transient blip on
it has nowhere to fail over to.

- **Decision:** When the **last** provider in a chain fails with a
  **transient** reason (`network` — the `fetch` itself threw — or
  `http_5xx` — upstream temporarily unavailable), the router retries
  **that same provider once** after a short fixed backoff
  (`TAIL_RETRY_BACKOFF_MS = 150 ms`) before throwing
  `AllProvidersFailedError`. The retry is abort-aware (a cancelled
  caller never sits out the backoff). It fires **only** at the chain
  tail (where there is no next provider to fail over to) and **only** on
  the two transient reasons; `rate_limited` / `circuit_open` are
  capacity (failover/budget-stop, not retry), `http_4xx` / `parse` are
  request-shaped (a retry reproduces them), and `timeout` already burned
  the full per-attempt budget so a retry would likely time out again.
  Lives in the shared `createLLMRouter`, so prod (`apps/api`) and the
  eval free lane (`tools/eval`) inherit it identically — "the eval
  measures what production ships."
- **Core value:** Free, Bullet-proof
- **Why:** The committed BIRD baseline (`baseline-2026-06-15.json`) has
  **3/500 `no_sql` losses, every one carrying `mistral:network` at the
  tail** with every head provider `rate_limited`/`circuit_open`. The
  Mistral API is healthy (live `/v1/chat/completions` probe: HTTP 200,
  ~0.6 s, 2026-06-14) — these are transient single-attempt fetch blips,
  not an outage or a reasoning loss. A chain exhausted *purely* by rate
  limits budget-stops and resumes (`SK-QUAL-013`); the lone transient
  tail failure is exactly what flips a recoverable pause into a scored
  `no_sql`. The backstop's entire job (`SK-LLM-028`) is converting
  full-chain-exhaustion losses — letting it die on a momentary blip
  defeats that. Retrying transient errors on the *same* provider (vs.
  failover, which has nowhere to go at the tail) is the textbook fix:
  *retries handle transient glitches; fallbacks handle persistent
  failures* (Portkey / Bifrost production guides, 2026).
- **Consequence in code:** `router.ts` gains `TAIL_RETRY_REASONS`
  (`{network, http_5xx, provider_error}` — `provider_error` added by
  [`SK-LLM-042`](./SK-LLM-042-openrouter-200-error-classify.md) for the same
  reason: a gateway's 200-body upstream failure is transient and fast-failing),
  `TAIL_RETRY_BACKOFF_MS`, and an abort-aware
  `sleep`. The retry reuses the existing `attempt()` path, so it emits
  its own `llm.<op>` span — a tail retry is visible in traces as a
  second span for the tail provider, no new metric/label
  (cardinality unchanged). **Strictly additive**: it can only convert a
  would-be `AllProvidersFailedError` into a success and never touches a
  request the chain already answers, so it cannot regress a passing row.
  Zero added latency for any currently-succeeding request — it runs only
  on the already-exhausted tail.
- **Alternatives rejected:**
  - **Retry every provider on transient errors before failover** — the
    fuller retry-then-fallback pattern, but it adds a backoff + extra
    attempt on the unhappy path of *every* provider, risking the Worker
    wall-clock budget (`plan` is 5 s × 6 providers + hedge). Failover
    already covers head-provider transients (the next provider is the
    retry); only the tail has no fallback, so tail-only is the minimal
    change that closes the actual gap.
  - **Exponential backoff / multiple retries** — for a single transient
    blip on a healthy free-tier provider, one retry recovers it; more
    retries burn budget on the rare case where the provider is genuinely
    down (which the breaker already handles across requests).
  - **Treat a transient tail failure as capacity exhaustion
    (budget-stop) in the eval** — games the metric instead of fixing the
    engine; production would still lose the request. The retry fixes the
    behaviour, and the eval inherits it for free.
