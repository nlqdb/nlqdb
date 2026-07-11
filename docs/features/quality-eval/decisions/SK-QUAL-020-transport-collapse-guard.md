# SK-QUAL-020 — Transport-collapse guard: a chain unreachable end-to-end is an outage, not a scored 0%

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-013`](./SK-QUAL-013-capacity-honest-budget-stop.md) (the capacity
budget-stop this is the connectivity sibling of),
[`SK-QUAL-011`](./SK-QUAL-011-resumable-runner.md) (the checkpoint it drops),
`SK-QUAL-005` (the baseline it refuses to overwrite — see the parent
`FEATURE.md`),
[`SK-LLM-039`](../../llm-router/decisions/SK-LLM-039-auth-denied-reason.md)
(the `auth_denied` reason it treats as a config outage).

- **Decision:** After assembling the lane summaries, a run is a **transport
  collapse** when **every lane that ran** produced *zero* engine signal (no
  `match` / `mismatch` / `exec_error`) **and** every one of its `no_sql`
  rows failed for a `NON_ENGINE_REASONS` reason — `network`, `timeout`,
  `not_configured`, `auth_denied`. On that verdict the runner sets
  `report.transport_failed`, writes the report for inspection, **drops the
  checkpoint** (`completeCheckpoint`), and returns **before** the baseline
  diff and event emit; the CLI then exits non-zero. The capacity pair
  (`rate_limited` / `circuit_open`) is excluded — `SK-QUAL-013`'s budget-stop
  owns it and it never reaches a scored `no_sql`. Since 2026-07-11 that
  budget-stop also owns the *transient* transport pair (`network`/`timeout`
  — `isChainTransientWall`), so this run-level guard's live catch is the
  **config outage** (`not_configured`/`auth_denied` — the walls that never
  self-recover and must fail loudly, not resume-loop).

- **Core value:** Bullet-proof

- **Why:**
  - **A 0.00 from an outage is indistinguishable from an engine collapse,
    and the consequences differ completely.** When the whole chain is
    unreachable (DNS / connection-reset / TLS / a revoked key), every
    question scores `no_sql` and the lane reports `EX=0.00%`. Before this
    guard that 0% flowed straight into `compareToBaseline` (a catastrophic
    false regression, possibly re-seeding `tools/eval/baseline-2026-06-15.json`
    with zeros) and into the `feature.eval.regression` emit. Observed
    2026-06-25: a local persona-bench smoke reported `EA=0.00% (match=0/1)`
    with `no_sql reasons: cerebras:network, gemini:network, …` — the agent
    session's egress proxy, not the engine.
  - **It is the connectivity sibling of `SK-QUAL-013`, with the opposite
    checkpoint move.** Capacity rows are never scored (the lane throws
    `BudgetStopError` *before* scoring, so resume re-attempts them);
    transport rows ARE scored `no_sql` and ARE checkpointed, so a naive
    "keep + resume" would replay the all-`no_sql` checkpoint and re-report
    0% forever. The poisoned checkpoint must be **dropped** so the
    re-dispatch starts fresh.
  - **Conservative by construction — it can never hide a real regression.**
    The verdict requires *both* zero answered questions *and* an all-
    non-engine reason set. Any `match`/`mismatch`/`exec_error` row, or any
    answer-signal reason (`parse` = model returned non-SQL, `http_4xx`,
    `http_5xx`, `provider_error`, `unknown`), flips it to `false` and the
    run is scored normally. A genuine "engine produced no usable SQL" run
    (`parse`-dominated) is real signal and is never suppressed.

- **Consequence in code:** `tools/eval/src/runner.ts` —
  `NON_ENGINE_REASONS` set + pure `isTransportCollapse(lanes)` (exported via
  `_testing`); a branch after the `budgetStopped` early-return sets
  `transport_failed`, writes, drops the checkpoint, and returns pre-baseline/
  pre-emit; `main()` prints a one-line diagnosis and `process.exit(1)`.
  `tools/eval/src/types.ts` — `EvalReport.transport_failed?: boolean`.
  Test: `tools/eval/test/transport-collapse.test.ts`.

- **Alternatives rejected:**
  - **Score the outage as `no_sql` / 0% (status quo).** Records a network
    outage as an engine failure — the exact anti-self-deception failure
    `SK-QUAL-012` / `SK-QUAL-013` exist to prevent, one rung lower in the
    stack (the chain wasn't slow or rate-limited, it was *gone*).
  - **Reuse `resumable` + keep the checkpoint.** The checkpoint is all
    `no_sql`; a resume skips every already-"scored" pair and re-reports 0%.
    Connectivity loss needs a fresh run, not a resume.
  - **Include `rate_limited`/`circuit_open` in `NON_ENGINE_REASONS`.**
    Blurs the capacity vs connectivity boundary `SK-QUAL-013` draws; those
    already pause-and-resume and never reach a scored `no_sql`.
  - **Threshold on a *fraction* of non-engine rows (e.g. ≥ 90%).** A
    partial outage that still answered some questions carries real signal
    on the answered subset; suppressing it would hide a regression. The
    all-or-nothing rule keeps the guard a strict outage detector.
