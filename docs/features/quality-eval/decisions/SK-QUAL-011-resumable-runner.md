# SK-QUAL-011 — Resumable runner: checkpoint + budget-stop so a run survives a free-tier daily token cap

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Enables the
capped 4h smoke cadence in
[`SK-QUAL-002`](./SK-QUAL-002-weekly-cron.md) and consumes the W2
rate-limit signal from
[`SK-LLM-030`](../../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md).
Dependency is one-way: `tools/eval` imports `@nlqdb/llm`, never the
reverse.

- **Decision:** The runner is resumable. It maintains a checkpoint —
  `tools/eval/src/checkpoint.ts`, one JSONL line per scored
  `(question_id, lane)` pair, written to `<dataset>.<variant>.partial.jsonl`
  (variant `smoke` for sampled runs, `full` otherwise, so the two
  cadences never share a partial). `runEval` loads it, **skips**
  already-scored pairs, **appends** each new result as it lands, and
  **completes** (deletes) it on a clean finish. Question order is
  deterministic — `--sample-seed` picks a fixed slice from the full set
  via a seeded shuffle, sorted by id — so "skip done" is a set lookup and
  a resumed run produces the same scoring as a single-shot run. When the
  whole provider chain is rate-limited (`AllProvidersFailedError` with
  `attempts.every(a => a.reason === "rate_limited")`, the
  [`SK-LLM-030`](../../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)
  contract), the runner treats it as a **budget stop**: it keeps the
  checkpoint, marks the report `resumable: true`, **does not emit**, and
  exits 0. The workflow leaves `last_eval_sha` unadvanced; the next
  scheduled window loads the checkpoint and finishes the remaining pairs.
- **Core value:** Free, Bullet-proof
- **Why:** The free-tier daily token cap (Cerebras 1M/day, shared with
  production) is a hard ceiling a full or repeated run can hit mid-pass.
  Without resume, a 429-saturated run is wasted work + a misleading wall
  of `no_sql` rows (a rate-limit is *not* a model failure). Checkpointing
  per `(question_id, lane)` turns a daily-cap hit into a pause: stop where
  the quota ran out, resume when it recovers — exactly what the
  [`SK-QUAL-002`](./SK-QUAL-002-weekly-cron.md) capped cadence needs to
  measure the latest engine state at a bounded rate. Detecting the stop
  off W2's `rate_limited` reason (rather than a token counter) keeps it
  honest and dependency-free: we stop at the first fully-rate-limited
  question, before any breaker flips a later attempt to `circuit_open`,
  so the literal `.every(rate_limited)` check is sufficient; mixed
  reasons (a real 5xx) stay a genuine `no_sql`, not a budget stop.
- **Consequence in code:** `tools/eval/src/checkpoint.ts` (load / append /
  complete / `checkpointKey` / `checkpointPath`); `runner.ts` gains
  `--sample-seed` + deterministic `sampleQuestions`, checkpoint
  skip/append/complete, the `BudgetStopError` + `isChainRateLimited`
  detector, a `resumable?: boolean` on `EvalReport`, and a `runAt`
  test-injection seam (so a resumed run and a single-shot run compare
  identically modulo wall-clock). Both quality-eval workflows persist
  `last_eval_sha` + the smoke checkpoint via `actions/cache` (rolling
  key); a budget-stopped smoke run keeps the checkpoint and does not
  advance `last_eval_sha`. Storage choice: **CI cache, not a committed
  results branch** — keeps the eval out of git history and avoids a
  branch-maintenance burden; the trade-off (a cache eviction restarts a
  pending run from scratch) is acceptable because a fresh run is correct,
  just slower.
- **Alternatives rejected:**
  - **Restart from scratch on a token cap** — wastes the completed work
    and, worse, records the un-run tail as `no_sql`, corrupting the EX.
  - **A token counter / pre-emptive budget ceiling in the runner** — we
    don't know each free tier's true per-minute limit; the breaker
    already rotates and surfaces `rate_limited`, so reusing that signal
    is simpler and self-calibrating (P5). A hard counter is parked under
    the feature's Open questions.
  - **Commit the checkpoint to a `results` branch** — pollutes git
    history with churn and needs a cleanup story; a CI cache is ephemeral
    and self-evicting.
  - **Sleep `Retry-After` in-process to wait out the cap** — a daily cap
    is on the scale of hours; holding a GitHub Actions runner idle for
    hours is wasteful and hits the job timeout. Checkpoint-and-redispatch
    is the right grain.
