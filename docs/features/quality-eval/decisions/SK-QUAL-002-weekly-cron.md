# SK-QUAL-002 — Eval cadence: a CI regression alarm on a fixed sample; full runs manual on demand; never a merge gate, never a KPI

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).
Companion: [`SK-QUAL-006`](./SK-QUAL-006-mcnemar-paired-test.md) (paired
McNemar trigger) and [`SK-QUAL-011`](../FEATURE.md#sk-qual-011) (the
resumable runner a long run relies on to survive a free-tier daily cap).

- **Decision:** BIRD/Spider accuracy is a **regression alarm, not a KPI**
  ([`GLOBAL-041`](../../../decisions/GLOBAL-041-autonomous-dba.md)). Two run
  shapes exist:
  1. **Alarm** — the fixed sampled slice (`mode: smoke`, deterministic
     `--sample-seed`, ≈ 150 BIRD / 40 Spider) runs in CI **after a merge to
     `main` that touches `packages/llm/**` or `apps/api/src/ask/**`** and
     **fails when the free-chain EA drops more than 5 pp below the last green
     run on the same sample**. Red = a regression to fix like any red CI.
     It never blocks a merge (it runs post-merge), never runs on a schedule,
     and never rewrites the full baseline.
  2. **Full** — 500 BIRD / 135 Spider, `workflow_dispatch` only, for
     diagnosis after an engine change or to re-pin the baseline; diffs the
     pinned baseline and emits `feature.eval.weekly` / `feature.eval.regression`
     (EA delta ≤ −5 pp **or** McNemar p < 0.05, `SK-QUAL-006`) through
     `POST /v1/events/eval` → Queues → events-worker → LogSnag.
  There is no weekly re-measure, no accuracy floor, no phase gate and no
  scorecard target on either shape. The full run's output still drives two
  product decisions: confidence-floor calibration for
  [`SK-TRUST-003`](../../trust-ux/FEATURE.md) and the promotion trigger for
  [`docs/future/semantic-layer.md`](../../../future/semantic-layer.md)
  (unscaffolded-path accuracy persistently below 75 % across two runs).
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** The product bet is the DBA (`GLOBAL-041`); NL→SQL accuracy is the
  interface it must not lose. A floor would gate a phase on a number the
  bet does not move; a weekly re-measure burned agent runs and the shared
  1M-token/day free-tier cap (the retired 4h smoke *schedule* could
  429-saturate the chain and starve live `/v1/ask`) for a number nobody
  acted on. A fixed-sample alarm after engine-path merges is the cheapest
  shape that still catches a regression the run it lands. Gating *merges*
  would create pressure to game the benchmark; a post-merge alarm keeps the
  harness a measurement tool. GitHub Actions hosts the run (Workers Cron's
  30 s CPU / 15 min wall-clock cannot host a 500-question pass); the runner
  POSTs into `apps/api` for the typed-event fanout.
- **Consequence in code:**
  `.github/workflows/quality-eval-{bird-mini,spider2-lite}.yml`: the alarm
  job runs on `push` to `main` filtered to the engine paths, in `mode: smoke`
  with the fixed `--sample-seed`, compares against the last green sample
  result (persisted via `actions/cache`, rolling key) and exits non-zero on
  a > 5 pp drop; the `run` job stays `workflow_dispatch` (inputs: `mode`,
  `limit`, `include_frontier`, `include_agentic_frontier`, `skip_emit`)
  with `concurrency: { group, cancel-in-progress: false }`. The full run
  diffs `tools/eval/baseline-*.json` and POSTs to `POST /v1/events/eval`
  (`Authorization: Bearer ${EVAL_INGEST_TOKEN}`). PR CI runs unit tests
  only — no real LLM calls. Persona-bench and memory-quality have no
  workflow; they run only via the manual runner (`--dataset`).
- **Alternatives rejected:**
  - **Manual on-demand only** (the prior stance) — drift went unmeasured
    until an operator remembered; a regression could ship for weeks.
  - **Scheduled weekly + auto-firing 4h smoke** — self-fires on every
    engine change, risks the shared free-tier cap, and feeds the resume
    loop the wrong way; per-PR attribution is illusory on a ~150q slice.
  - **PR-gated full eval** — too slow, too expensive, encourages gaming.
  - **Accuracy floor as a phase gate** — retired by `GLOBAL-041`; the
    interface number does not decide the product bet.
  - **Direct LogSnag POST from the workflow** — skirts the typed event
    pipeline ([`GLOBAL-024`](../../../decisions/GLOBAL-024-demand-signal-telemetry.md)).
