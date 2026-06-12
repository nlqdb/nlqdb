# SK-QUAL-011 — Resumable runner: checkpoint + budget-stop so a run survives a free-tier daily token cap

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Lets a long
on-demand run ([`SK-QUAL-002`](./SK-QUAL-002-weekly-cron.md)) survive a
free-tier daily cap, consuming the W2 rate-limit signal from
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
  whole provider chain is capacity-exhausted (`AllProvidersFailedError`
  with every attempt `rate_limited` **or** `circuit_open` — the predicate
  [`SK-QUAL-013`](./SK-QUAL-013-capacity-honest-budget-stop.md) widened
  after the original all-`rate_limited` check missed the post-429 breaker
  wall; breaker semantics per
  [`SK-LLM-030`](../../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)),
  the runner treats it as a **budget stop**: it keeps the
  checkpoint, marks the report `resumable: true`, **does not emit**, and
  exits 0 — so a daily-cap hit reads as a pause, not a wall of `no_sql`
  rows. The operator re-dispatches once the cap resets.
- **Core value:** Free, Bullet-proof
- **Why:** The free-tier daily token cap (Cerebras 1M/day, shared with
  production) is a hard ceiling a full or repeated run can hit mid-pass.
  Without resume, a 429-saturated run is wasted work + a misleading wall
  of `no_sql` rows (a rate-limit is *not* a model failure). Checkpointing
  per `(question_id, lane)` turns a daily-cap hit into a pause: stop where
  the quota ran out, resume when it recovers — exactly what an on-demand
  [`SK-QUAL-002`](./SK-QUAL-002-weekly-cron.md) full pass needs to finish
  even when it brushes the daily cap. Detecting the stop
  off the failover reasons (rather than a token counter) keeps it honest
  and dependency-free; mixed reasons (a real 5xx) stay a genuine
  `no_sql`, not a budget stop. The exact predicate is
  [`SK-QUAL-013`](./SK-QUAL-013-capacity-honest-budget-stop.md)'s —
  a 429 opens the breaker for its `Retry-After` window, so an exhausted
  chain reads `circuit_open`, not `rate_limited`, after the first hit.
- **Consequence in code:** `tools/eval/src/checkpoint.ts` (load / append /
  complete / `checkpointKey` / `checkpointPath`); `runner.ts` gains
  `--sample-seed` + deterministic `sampleQuestions`, checkpoint
  skip/append/complete, the `BudgetStopError` + `isChainCapacityExhausted`
  detector (`SK-QUAL-013`), a `resumable?: boolean` on `EvalReport`, and a `runAt`
  test-injection seam (so a resumed run and a single-shot run compare
  identically modulo wall-clock). Both workflow modes persist their
  checkpoint via `actions/cache` — smoke on a rolling key, full keyed by
  commit SHA
  ([`SK-QUAL-013`](./SK-QUAL-013-capacity-honest-budget-stop.md)) — so a
  budget-stopped run resumes on the next same-mode dispatch.
  Storage choice: **CI cache, not a committed results branch** — keeps the
  eval out of git history; a cache eviction just restarts a pending run,
  which is correct, just slower.
- **Alternatives rejected:**
  - **Restart from scratch on a token cap** — wastes the completed work
    and, worse, records the un-run tail as `no_sql`, corrupting the EX.
  - **A token counter / pre-emptive budget ceiling in the runner** — we
    don't know each free tier's true per-minute limit; the breaker
    already rotates and surfaces `rate_limited`, so reusing that signal
    is simpler and self-calibrating (P5). A hard counter is parked under
    the feature's Open questions.
  - **Sleep `Retry-After` in-process to wait out the cap** — a daily cap
    is on the scale of hours; holding a GitHub Actions runner idle for
    hours is wasteful and hits the job timeout. Checkpoint-and-redispatch
    is the right grain.
