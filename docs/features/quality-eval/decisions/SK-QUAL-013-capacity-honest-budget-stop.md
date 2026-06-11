# SK-QUAL-013 — Capacity-honest budget stop: a rate-limit breaker wall pauses the run, it never scores `no_sql`

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-011`](./SK-QUAL-011-resumable-runner.md) (the budget-stop this
widens), [`SK-QUAL-012`](./SK-QUAL-012-throttle-paced-measurement.md) (the
pacing this backstops),
[`SK-LLM-030`](../../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)
(the breaker semantics that produce the `circuit_open` reason).

- **Decision:** The budget-stop predicate is **capacity exhaustion** —
  `AllProvidersFailedError` where every attempt is `rate_limited` **or**
  `circuit_open` — not the literal all-`rate_limited` shape `SK-QUAL-011`
  shipped. Before stopping, the runner waits once for
  `--capacity-wait-ms` (`RunOptions.capacityWaitMs`, default **0** ⇒
  immediate stop, PR CI unchanged; workflows pass **65 000 ms** to outlast
  the 60 s breaker cooldown) and retries the question; a second
  consecutive exhaustion budget-stops. The full-mode workflows cache the
  checkpoint keyed by **commit SHA** so a re-dispatch of the same commit
  resumes instead of re-burning quota (smoke already did; two code
  versions must never share a canonical run's partial scores).

- **Core value:** Bullet-proof

- **Why:**
  - **The all-`rate_limited` predicate misses the wall it was built for.**
    A 429 opens the breaker for the server's `Retry-After` window
    (`SK-LLM-030`; the eval honors it uncapped), so only the *first*
    exhausted question shows `rate_limited` — every later one is rejected
    breaker-side as `circuit_open` with **no LLM call at all**. Verified on
    the 2026-06-11 500-q GHA run (27315143428): **246 of 283 `no_sql` rows
    were all-`circuit_open`** (p50 199 ms — fast-fail), and the budget stop
    never fired because the first exhausted row was mixed
    `rate_limited`+`circuit_open`. Raw EX 0.214 measured the harness's own
    breaker wall, not the engine.
  - **One bounded wait separates a per-minute window from a daily cap.**
    A TPM/RPM window recovers within the 60 s default cooldown — the run
    should keep measuring; a daily cap doesn't — the run should pause for
    the next dispatch. One 65 s wait + retry distinguishes them without
    estimating any provider's true limit.
  - **Liveness across dispatches holds even for an ambiguous wall.** An
    all-`circuit_open` wall caused by 3-strike timeouts (not 429s) also
    budget-stops, but the resumed dispatch starts with closed breakers, so
    the paused question gets real attempts and records a real outcome —
    every dispatch makes strict progress.

- **Consequence in code:** `tools/eval/src/runner.ts` —
  `isChainCapacityExhausted` replaces `isChainRateLimited`; the
  `runOneQuestion` plan-throw path waits once (`capacityWaitMs`) then
  budget-stops; `--capacity-wait-ms` CLI flag. Both `quality-eval-*.yml`
  full jobs gain a `actions/cache` restore/save pair on
  `tools/eval/results/*.partial.jsonl` keyed
  `eval-full-{bird,spider}-<sha>-<run_id>` (restore-keys on the sha
  prefix), pass `--capacity-wait-ms 65000`, and surface `resumable` in the
  run summary.

- **Alternatives rejected:**
  - **Cap the eval's rate-limit cooldown (finite `maxRateLimitCooldownMs`).**
    Hides the server's real back-off signal the checkpoint decision needs,
    and re-offers load a 429 explicitly refused — quota burn for `no_sql`.
  - **Treat all-`circuit_open` as scored `no_sql` (status quo).** Scores a
    harness artifact as an engine failure; the gate metric then measures
    breaker state, not SQL quality.
  - **Wait in a loop until some breaker closes.** Unbounded wall-clock
    inside a 90-min job for a window the server said is hours long; the
    checkpoint + re-dispatch already covers it without burning runner time.
  - **Require ≥ 1 `rate_limited` in the exhausted set.** Leaves the pure
    all-`circuit_open` wall scoring `no_sql` whenever the stop's first
    chance was missed (e.g. resumed mid-wall) — the exact bug again.
