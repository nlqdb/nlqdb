# SK-QUAL-002 — Eval cadence: manual on-demand only; never a PR gate (thresholds drive *decisions*, not *merges*)

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).
Companion: [`SK-QUAL-006`](./SK-QUAL-006-mcnemar-paired-test.md) (parallel
regression trigger via paired-binary McNemar test) and
[`SK-QUAL-011`](../FEATURE.md#sk-qual-011) (the resumable runner a long
run relies on to survive a free-tier daily cap).

- **Decision:** The eval harness runs **manually on demand only**
  (`workflow_dispatch`) — never on a PR, never on a schedule. A run does
  the full pass (500 BIRD / 135 Spider), diffs against
  `baseline-2026-06-15.json`, and (unless `skip_emit`) emits
  `feature.eval.weekly` + `feature.eval.regression`. The output drives
  three product decisions:
  (a) **confidence-floor calibration** for
  [`SK-TRUST-003`](../../trust-ux/FEATURE.md);
  (b) **promotion trigger** for
  [`docs/future/semantic-layer.md`](../../../future/semantic-layer.md) —
  promote when accuracy on the unscaffolded path drops persistently
  (starting threshold: 75% across two consecutive runs);
  (c) **alerting** on regression — fires when **either** the EA delta is
  ≤ -5 pp **or** McNemar's paired-binary test
  ([`SK-QUAL-006`](./SK-QUAL-006-mcnemar-paired-test.md)) returns
  p < 0.05; both signals report separately.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Gating *merges* on accuracy creates pressure to game the
  benchmark; gating *decisions* keeps the harness a measurement tool — so
  it never runs per-PR/per-merge. It also runs **on demand rather than on
  a schedule**: an operator triggers it when they want a fresh number
  (after an engine lever lands, before a baseline refresh). This keeps the
  shared **1M-token/day** free-tier cap fully available to live
  `/v1/ask` — a self-firing cadence (the retired 4h smoke job) could
  429-saturate the chain and starve production planner budget, then feed
  W2's resume logic the overflow (a feedback loop the wrong way). The
  accepted trade-off: drift goes unmeasured until someone runs it — fine
  while the engine is changing fast and an operator is watching; re-add a
  schedule if that stops being true. The resumable runner
  ([`SK-QUAL-011`](../FEATURE.md#sk-qual-011)) still lets a manual run
  survive a daily-cap hit (budget-stop, re-dispatch to finish). Workers
  Cron is the wrong runtime anyway (30 s CPU + 15 min wall-clock can't
  host a 500-question pass); GitHub Actions hosts the run, then the runner
  POSTs into `apps/api` for the typed-event fanout.
- **Consequence in code:**
  `.github/workflows/quality-eval-{bird-mini,spider2-lite}.yml` each carry
  only `workflow_dispatch` (inputs: `limit`, `include_frontier`,
  `include_agentic_frontier`, `skip_emit`) plus
  `concurrency: { group, cancel-in-progress: false }` (a second dispatch
  queues behind the first). A run diffs against `baseline-2026-06-15.json`,
  then POSTs to `POST /v1/events/eval`
  (`Authorization: Bearer ${EVAL_INGEST_TOKEN}`), which `recordEvalReport`
  fans out as `feature.eval.weekly` + `feature.eval.regression` through
  Cloudflare Queues → events-worker → LogSnag. PR CI runs unit tests only
  — no real LLM calls.
- **Alternatives rejected:**
  - **Scheduled weekly + capped 4h "smoke" cadence** (the prior design,
    retired with the smoke job) — a cadence that self-fires on every
    engine change risks blowing the shared 1M/day free-tier cap and
    starving live traffic, and feeds the resume loop the wrong way;
    per-PR attribution is illusory on a noisy ~150q slice anyway. An
    operator-triggered run costs nothing when idle and the resumable
    runner still measures the latest engine state on demand.
  - PR-gated full eval — too slow, too expensive, encourages gaming.
  - Eval as a product surface — premature; per-customer schemas don't
    match BIRD/Spider, so the number would mislead users.
  - **Cloudflare Workers Cron runtime** — 30 s CPU + 15 min wall-clock
    incompatible with a 500-question pass; wrong even on Paid.
  - **Direct LogSnag POST from the workflow** — skirts the typed event
    pipeline ([`GLOBAL-024`](../../../decisions/GLOBAL-024-demand-signal-telemetry.md)),
    loses the discriminated-union schema, forks the secrets surface.
