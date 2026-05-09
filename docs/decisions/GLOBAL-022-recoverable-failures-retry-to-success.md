# GLOBAL-022 — Recoverable failures retry to success — never surface a fixable error

- **Decision:** When a request fails for a reason the system can recover
  from in-process — re-plan, re-classify, retry an upstream call, fail
  over to a sibling provider — the request retries up to **3 attempts**
  before surfacing a failure to the caller. This applies at two layers,
  each with its own 3-attempt budget:
  1. **Server-side, per stage.** Each pipeline stage that owns its own
     recoverable error class (classifier, planner, SQL validator, SQL
     executor, LLM provider) retries internally up to 3 times before
     propagating the error up the stack.
  2. **SDK-side, around the wire call.** `@nlqdb/sdk` wraps every method
     in up to 3 retries on transport failures and transient 5xx
     responses, threading the same `Idempotency-Key` (`GLOBAL-005`,
     `SK-SDK-006`) across attempts.

  **Recoverable** classes (retry):
  - SQL planning / validation failures — the parser error feeds the
    next plan attempt.
  - Classifier producing the wrong intent — feedback re-classifies.
  - Upstream transient 5xx (LLM provider, Neon, KV, R2).
  - Network / transport errors (`fetch` throws, connection reset).
  - Provider rate-limit (429) — fails over to the next provider in the
    chain, doesn't retry the rate-limited one.

  **Non-recoverable** classes (surface immediately, no retry):
  - 4xx caller errors — bad input, missing fields, malformed request.
  - 401 — handled by the silent-refresh path (`GLOBAL-009`,
    `SK-SDK-005`); not in scope here.
  - 403 / quota / billing-cap exhaustion — retry doesn't fix it.
  - The caller's own per-user rate-limit ceiling.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** A user-visible failure on a request the system *could have*
  completed is the worst kind of error — it teaches users not to trust
  the surface. Most "errors" in the pipeline are recoverable: the LLM
  produced invalid SQL, the classifier mis-routed, Neon hiccuped, the
  provider rate-limited. Three attempts absorbs any single transient
  failure mode without spending forever; the SDK layer adds a second
  3-attempt budget so end-to-end transient resilience is high.
  Layering matters because recovery has to live where the context
  lives — the SDK can't re-plan with a parser error it never sees.
- **Consequence in code:**
  - Each pipeline stage (`apps/api/src/ask/classifier.ts`,
    `apps/api/src/ask/plan.ts`, `apps/api/src/ask/sql-validate.ts`,
    `apps/api/src/ask/exec.ts`) retries its own recoverable errors up
    to 3 times before propagating.
  - The LLM router (`packages/llm`) treats provider 5xx + provider
    rate-limit as failover signals; the chain retries up to 3 hops
    (one attempt per provider in the configured chain).
  - `packages/sdk/src/fetch.ts` wraps every method in up to 3 retries
    on transport failures and transient 5xx, reusing the
    `Idempotency-Key` from the first attempt (`SK-SDK-006`). The 401
    path stays single-retry per `SK-SDK-005`.
  - Every retry emits an OTel attribute (`nlqdb.retry.attempt`) on the
    parent span and increments `nlqdb.retry.total{stage, reason}`
    (`GLOBAL-014`). Dashboards alert when the retry rate climbs —
    sustained recovery means something is genuinely broken, not just
    flaky.
  - **Latency trade-off vs `docs/performance.md §1`:** the SLO budgets
    describe the *first-attempt* path. A request that recovers may
    exceed the p99 budget for that single request — that is the
    explicit trade-off (success > SLO compliance for an individual
    request). Sustained SLO breach is still a release-blocking
    regression, because it means recovery is firing often enough to
    move the rolling window — which is exactly the signal we want.
- **Alternatives rejected:**
  - Single retry per stage — leaves users seeing failures on the
    second of two consecutive transients (rare but real); 3 absorbs
    three independent transients.
  - Unbounded retries — turns transient upstream failures into
    request hangs; bounds prevent the stuck-request failure mode.
  - SDK-only retries — server-side stage failures (re-plan with
    parser feedback, fail over to a sibling LLM provider) can't
    recover from the SDK layer because the SDK doesn't see the
    inner error; recovery has to live where the context lives.
  - Server-only retries — non-SDK callers (future Python, Go, Rust
    SDKs, raw `curl`) lose parity (`GLOBAL-002`) unless retry is
    also at the wire layer.
  - Honor the SLO over success — surfacing a fixable error to keep
    the p99 budget intact teaches users not to trust the surface,
    which is the failure mode `Bullet-proof by design` exists to
    prevent.
