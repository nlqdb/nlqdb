# SK-QUAL-002 — Eval is a weekly cron, not a PR gate; thresholds drive *decisions*, not *merges*

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).
Companion: [`SK-QUAL-006`](./SK-QUAL-006-mcnemar-paired-test.md) (parallel
regression trigger via paired-binary McNemar test).

- **Decision:** The eval harness runs on a weekly cron (and on demand),
  not on every PR. The output drives three product decisions:
  (a) **confidence-floor calibration** for
  [`SK-TRUST-003`](../../trust-ux/FEATURE.md);
  (b) **promotion trigger** for
  [`docs/future/semantic-layer.md`](../../../future/semantic-layer.md) —
  promote when accuracy on the unscaffolded path drops persistently
  (starting threshold: 75% for two consecutive weekly runs; tighten
  once we have baseline data);
  (c) **alerting** on regression — fires when **either** the EA delta
  is ≤ -5 pp **or** McNemar's paired-binary test
  ([`SK-QUAL-006`](./SK-QUAL-006-mcnemar-paired-test.md)) returns
  p < 0.05 on the regression direction; both signals are reported
  separately so the on-call sees which trigger fired.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Running BIRD + Spider on every PR is expensive on LLM
  provider quota and noisy (model providers' own changes affect the
  score). Weekly cron is enough cadence to catch real regressions
  while staying inside the Anthropic / Gemini free-tier daily budgets.
  Gating *merges* on accuracy creates pressure to game the benchmark
  (overfitting to BIRD examples); gating *decisions* keeps the harness
  as a measurement tool, not a goal. Workers Cron is **the wrong
  runtime** for the work (30 s CPU + 15 min wall-clock can't host
  500–2,000 LLM calls); GitHub Actions is the cron home, then the
  runner POSTs into `apps/api` for the typed-event fanout — keeps the
  event pipeline canonical without re-implementing a queue producer
  outside Workers.
- **Consequence in code:**
  `.github/workflows/quality-eval-bird-mini.yml` fires weekly
  (Mon 04:00 UTC) and on `workflow_dispatch`. After the BIRD pass,
  the runner compares against `tools/eval/baseline-2026-06-15.json`,
  then POSTs the full report to `POST /v1/events/eval` with
  `Authorization: Bearer ${EVAL_INGEST_TOKEN}`.
  `apps/api/src/events-feature.ts::recordEvalReport` validates the
  bearer (constant-time compare), then emits one `feature.eval.weekly`
  + one `feature.eval.regression` per (lane, trigger) tuple through
  the Cloudflare Queues → events-worker → LogSnag pipeline. PR CI
  runs unit tests only — no real LLM calls.
- **Alternatives rejected:**
  - PR-gated full eval — too slow, too expensive, encourages benchmark gaming.
  - Manual on-demand only — drift goes undetected for weeks.
  - Daily cron — burns budget for marginal signal; weekly is the right
    cadence for a metric that moves on the scale of model releases.
  - Eval as a product surface (let users see accuracy) — premature;
    per-customer schemas don't match BIRD/Spider, so the number would
    mislead users.
  - **Cloudflare Workers Cron runtime for the eval** — 30 s CPU + 15
    min wall-clock incompatible with a 500-question pass; the runtime
    is wrong even on Paid.
  - **Direct LogSnag POST from the workflow** — skirts the typed event
    pipeline ([`GLOBAL-024`](../../../decisions/GLOBAL-024-demand-signal-telemetry.md)),
    loses the discriminated-union schema, and forks the cron's
    secrets surface.
