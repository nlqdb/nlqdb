# SK-QUAL-002 — Eval cadence: weekly canonical baseline + capped 4h smoke; never a PR gate (thresholds drive *decisions*, not *merges*)

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).
Companion: [`SK-QUAL-006`](./SK-QUAL-006-mcnemar-paired-test.md) (parallel
regression trigger via paired-binary McNemar test) and
[`SK-QUAL-011`](../FEATURE.md#sk-qual-011) (the resumable runner the
capped cadence relies on).

- **Decision:** The eval harness runs on **two scheduled cadences plus
  on demand — never on a PR**:
  (1) **Weekly full canonical baseline** (BIRD Mon 04:00 UTC, Spider Tue
  04:00 UTC): the full 500 / 135 pass, diffed against
  `baseline-2026-06-15.json`, emitting `feature.eval.weekly` +
  `feature.eval.regression`. This is the **only** run that is canonical
  and the only one that emits events.
  (2) **Capped "smoke" cadence** (every 4h, ≤ 6/day) to measure the
  latest engine state soon after it lands instead of up to 7 days later.
  A smoke window runs a **fixed sampled slice** (`--limit` + a fixed
  `--sample-seed`, ≈150 BIRD / 40 Spider) **only if** engine files
  (`packages/llm/**`, `tools/eval/**`) changed since the last measured
  SHA (`last_eval_sha`) or a checkpoint is pending. Smoke **never emits**
  `feature.eval.weekly` and **never overwrites** the canonical baseline —
  it produces a "smoke EX" artifact + a run-summary table only.
  The output still drives the same three product decisions:
  (a) **confidence-floor calibration** for
  [`SK-TRUST-003`](../../trust-ux/FEATURE.md);
  (b) **promotion trigger** for
  [`docs/future/semantic-layer.md`](../../../future/semantic-layer.md) —
  promote when accuracy on the unscaffolded path drops persistently
  (starting threshold: 75% for two consecutive weekly runs);
  (c) **alerting** on regression — fires when **either** the EA delta
  is ≤ -5 pp **or** McNemar's paired-binary test
  ([`SK-QUAL-006`](./SK-QUAL-006-mcnemar-paired-test.md)) returns
  p < 0.05; both signals report separately (weekly only).
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Gating *merges* on accuracy creates pressure to game the
  benchmark; gating *decisions* keeps the harness a measurement tool.
  But waiting a week to see whether a merged engine lever moved the
  number is too slow. **Decouple eval cadence from merge cadence rather
  than running per-merge:** at 10–20 engine merges/day, a per-merge
  ~250K-token smoke run (×N) would blow several times past Cerebras's
  shared **1M tokens/day** free-tier cap — starving live `/v1/ask` of
  planner budget, then 429-saturating the eval itself (and W2's resume
  logic would dutifully queue the overflow — a feedback loop the wrong
  way). Per-PR attribution is an illusion anyway on a ~150-question slice
  (binomial SE ≈ 4 pp). So: **coalesce** (one run at a time, queued
  windows collapse onto latest HEAD), **cap the cadence** (4h schedule
  fires only on engine change since `last_eval_sha` ⇒ ≤6 runs/day
  regardless of merge volume), and lean on **W2's rate-limit signal** as
  the budget guard (a 429-saturated chain budget-stops the run, which
  [`SK-QUAL-011`](../FEATURE.md#sk-qual-011) resumes next window). A
  coalesced run covers a SHA *range*; if the smoke EX moves you bisect
  the 1–3 engine PRs in the window — the **weekly full run stays the
  canonical confirm**. Workers Cron is the wrong runtime for the work
  (30 s CPU + 15 min wall-clock can't host a 500-question pass); GitHub
  Actions is the cron home, then the runner POSTs into `apps/api` for the
  typed-event fanout.
- **Consequence in code:**
  `.github/workflows/quality-eval-{bird-mini,spider2-lite}.yml` each
  carry **two crons** — the weekly full pass (`0 4 * * 1` / `0 4 * * 2`)
  and the 4h smoke (`0 */4 * * *` / `30 */4 * * *`) — plus
  `concurrency: { group, cancel-in-progress: false }` (coalesce) and
  `workflow_dispatch`. The `run` job is gated to the weekly/manual path;
  a separate `smoke` job gates on `git diff <last_eval_sha> HEAD --
  packages/llm tools/eval`, runs the sampled slice with no `--emit`/no
  `--baseline`, and persists `last_eval_sha` + the
  `*.smoke.partial.jsonl` checkpoint via `actions/cache` (rolling key).
  The weekly path is unchanged: diff against
  `baseline-2026-06-15.json`, then POST to `POST /v1/events/eval`
  (`Authorization: Bearer ${EVAL_INGEST_TOKEN}`), which
  `recordEvalReport` fans out as `feature.eval.weekly` +
  `feature.eval.regression` through Cloudflare Queues → events-worker →
  LogSnag. PR CI runs unit tests only — no real LLM calls.
- **Alternatives rejected:**
  - **Per-merge (push-triggered) smoke** — at active-sprint merge volume
    it blows the shared 1M/day free-tier cap several times over, starves
    live traffic, and feeds the resume loop the wrong way; per-PR
    attribution is illusory on a noisy ~150q slice. Decoupled 4h cadence
    + bisect-within-window is the call.
  - PR-gated full eval — too slow, too expensive, encourages gaming.
  - Manual on-demand only — drift goes undetected for weeks.
  - **Smoke emits `feature.eval.weekly`** — would contaminate the weekly
    dashboard with a noisier, differently-sampled cadence; smoke stays an
    artifact + step-summary only (a dedicated `feature.eval.smoke` event
    is deferred — see the feature's Open questions).
  - Eval as a product surface — premature; per-customer schemas don't
    match BIRD/Spider, so the number would mislead users.
  - **Cloudflare Workers Cron runtime** — 30 s CPU + 15 min wall-clock
    incompatible with a 500-question pass; wrong even on Paid.
  - **Direct LogSnag POST from the workflow** — skirts the typed event
    pipeline ([`GLOBAL-024`](../../../decisions/GLOBAL-024-demand-signal-telemetry.md)),
    loses the discriminated-union schema, forks the secrets surface.
