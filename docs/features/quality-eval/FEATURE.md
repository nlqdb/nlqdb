---
name: quality-eval
description: NL-to-SQL accuracy benchmarking — three-dataset canon (BIRD-dev + Spider 2.0-lite + internal `db.create` eval) against the LLM router's free / BYOLLM / hosted-premium lanes; the **free-vs-frontier delta** is the headline KPI for the engine north-star.
when-to-load:
  globs:
    - packages/llm/**
    - apps/api/src/ask/**
    - tools/eval/**
  topics: [eval, benchmark, BIRD, Spider, accuracy, semantic-layer, free-vs-frontier-delta]
---

# Feature: Quality Eval

**One-liner:** NL-to-SQL accuracy benchmarking — three-dataset canon (BIRD-dev + Spider 2.0-lite + internal `db.create` eval per [`SK-QUAL-003`](#sk-qual-003)) against the LLM router's free / BYOLLM / hosted-premium lanes; the **free-vs-frontier delta** (`SK-QUAL-004`) is the headline KPI for [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md)'s engine north-star.
**Status:** **Phase 2** (promoted from Phase 3 by [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) — the engine north-star is unprovable without it). Design-locked; instrumentation lands first, baseline by 2026-06-15 per `SK-QUAL-005`. Promotion of [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) depends on this harness.

**Contribution to north-star:** Engine quality, NL→SQL layer — this feature IS the measurement instrument. The three-dataset canon (`SK-QUAL-003`) feeds the BIRD-dev / Spider 2.0-lite KPIs and the free-vs-frontier delta in the [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) KPI table; the weekly cron in `SK-QUAL-002` is the alert-and-decision input.
**Owners (code):** `tools/eval/**` (to be created), `packages/llm/**`
**Cross-refs:** [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) (the moat this harness measures the need for) · `llm-router/FEATURE.md` (the system under test) · `trust-ux/FEATURE.md` (uses these metrics to calibrate `SK-TRUST-003` confidence floors) · [`docs/research-receipts.md §8`](../../research-receipts.md) (dbt 2026 semantic-layer accuracy research)

## Touchpoints — read this feature before editing

- `tools/eval/` — benchmark runner (planned)
- `packages/llm/src/router.ts` — the system under test
- `apps/api/src/ask/sql-validate.ts` — schema-fit checks the harness exercises
- The Postgres / ClickHouse adapter test fixtures — repurposed as eval fixtures

## Decisions

### SK-QUAL-001 — Benchmark canon: BIRD (real-world) + Spider 2.0 (multi-dialect); accuracy reported by tier

- **Decision:** The eval harness runs two open benchmarks: **BIRD** (Big Bench for Industrial Database; messy real-world schemas, ~12k questions across ~95 DBs — see the BIRD project for current counts) and **Spider 2.0** (cross-domain, multi-dialect, harder). Accuracy is reported separately for each tier of the [`llm-router`](../llm-router/FEATURE.md) — Tier 1 (cheap classify), Tier 2 (Sonnet plan), Tier 3 (Opus hard) — and separately with and without the semantic-layer scaffolding.
- **Core value:** Bullet-proof, Honest latency
- **Why:** A single accuracy number averaged across tiers hides the failure mode (Opus is fine, Tier 1 misroutes). Per-tier reporting tells us *which model* to retrain / swap / cap. BIRD is the standard "messy real-world" benchmark and the closest analogue to the schemas users build with `db.create`. Spider 2.0 covers dialect / cross-domain generalization that BIRD doesn't. Both are public; results stay comparable to published research.
- **Consequence in code:** `tools/eval/runner.ts` (planned) loads BIRD + Spider datasets, calls `packages/llm/src/router.ts::plan()` with the question + schema, executes the generated SQL against a fixture DB (the same Postgres / ClickHouse fixtures the adapter tests use), and compares the result-set to the gold answer. Per-tier accuracy lands in `tools/eval/results/<date>.json` and posts a Grafana annotation. The harness is a tool, not a CI gate (see SK-QUAL-002).
- **Alternatives rejected:**
  - Bespoke internal benchmark — non-comparable to research; no external validity.
  - WikiSQL only — too easy; saturated by 2024.
  - Spider 1.0 only — superseded; 2.0 covers more dialects.
  - Single averaged accuracy number — hides per-tier regression, the actionable signal.

### SK-QUAL-003 — Three-dataset canon: BIRD-dev + Spider 2.0-lite + internal `db.create` eval (the third dataset is the one that matters most)

- **Decision:** The harness reports on **three** datasets, in this order of weight: (1) **Internal `db.create` eval** — questions sampled from real user `db.create` schemas (anonymized via aggressive column-name + value-class swaps; no row data persisted), scored against the gold answer the user actually accepted; this is the dataset that most closely matches production. (2) **BIRD-dev** — public, comparable to published research, our "honest external" yardstick. (3) **Spider 2.0-lite** — enterprise-scale schemas; we *report* on it even though the entire industry is at 5-23% EM, because the gap between datasets is itself the moat signal.
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** Public benchmarks are gameable and stale — BIRD's distribution doesn't match a `db.create` schema, and Spider 2.0's enterprise complexity isn't what a solo-developer persona is asking. The internal eval, built from actually-accepted answers, is the only dataset that measures the thing we ship. Public benchmarks stay in the table for external comparability and so the "free-vs-frontier delta" stays meaningful to readers outside the team. **The three weights are not equal** — when the internal eval and BIRD disagree, internal wins. This prevents BIRD-overfit, the failure mode that broke the published text-to-SQL leaderboard in 2024.
- **Consequence in code:** `tools/eval/datasets/` ships three loaders: `internal.ts` (reads `db.create` accepted-answer rows from a dedicated R2 bucket with `principal.id` stripped at write time per [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md)'s privacy contract), `bird.ts`, and `spider2.ts`. The weekly cron from SK-QUAL-002 runs all three. The Grafana panel shows three lines, plus the free-vs-frontier delta as a separate panel.
- **Alternatives rejected:**
  - Internal-only — no external comparability; can't honestly answer "are you state of the art?"
  - BIRD-only — what we already had; misses the production-shape gap.
  - Equal weighting — when internal and BIRD disagree, the team has to choose; tying it to "internal wins" pre-commits us to the right answer.

### SK-QUAL-004 — Free-vs-frontier delta is the headline KPI, reported on every dataset and every router tier

- **Decision:** The harness reports execution-match accuracy under **two dispatch lanes** ([`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)): the **free chain** (Gemini Flash → Groq → Workers-AI → OpenRouter free) and **frontier** (Claude Sonnet 4.6 / GPT-5 / Gemini 2.5 Pro class). The **delta** (frontier_EM − free_EM) is the single most-watched number. Narrowing delta = scaffolding (planner, validator, plan-cache, schema retrieval, few-shot) is compounding. Widening delta = we're shipping distribution faster than engine work.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** Without this number, the "great-on-free-LLMs ⇒ invincible-on-frontier-LLMs" thesis is unfalsifiable. Reporting only frontier accuracy hides the free-tier user experience; reporting only free accuracy hides whether the engine has headroom. The delta makes both visible in one number, with target trajectory in [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md): ≤ 22 pts (Phase 2 floor) → ≤ 14 pts (Phase 3 floor).
- **Consequence in code:** `tools/eval/lanes.ts` selects the dispatch lane per run; the same questions are evaluated through both lanes back-to-back so the delta is per-question, not per-run-average (cancels noise). BYOLLM lane is also instrumented when an opt-in eval key is configured, but does not gate any floor — BYOLLM accuracy depends on the user's key, not on our work.
- **Alternatives rejected:**
  - One average accuracy number — hides which lane is regressing.
  - Per-tier accuracy without a delta — forces every reader to do the subtraction; team focus dissipates.
  - Delta tracked only on BIRD — too narrow; the internal eval's delta is the production-shape one.

### SK-QUAL-005 — Baseline by 2026-06-15; first floor enforced in Phase 2 exit gate

- **Decision:** The Phase 2 exit gate requires recorded baseline values for every engine-quality KPI in the [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) table by **2026-06-15**. The Phase 2 floor (BIRD-dev EM ≥ 72% free / ≥ 88% frontier; delta ≤ 22 pts) is enforced from the moment baselines exist. If baselines are below the floor on first measurement, the slice does not regress them — it ships engine work until the floor is cleared.
- **Core value:** Bullet-proof
- **Why:** "Phase 2 KPI floors" is meaningless without a baseline date. 2026-06-15 leaves ~one month from harness ship to baseline measurement — enough to debug the runner, not enough to drift. If we miss this date, the Phase 2 rollover is blocked per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) — that is the point.
- **Consequence in code:** `tools/eval/baseline-2026-06-15.json` is the canonical baseline snapshot. The weekly cron diffs against it. PRs that touch `packages/llm/**` add a one-line note to their description naming which KPI they're moving.
- **Alternatives rejected:**
  - No baseline date — "soon" never happens.
  - Baseline floor = whatever first measurement returns — ratchets us into accepting bad numbers as the new normal.

### SK-QUAL-002 — Eval is a weekly cron, not a PR gate; thresholds drive *decisions*, not *merges*

- **Decision:** The eval harness runs on a weekly cron (and on demand), not on every PR. The output drives three product decisions: (a) **confidence-floor calibration** for [`SK-TRUST-003`](../trust-ux/FEATURE.md), (b) **promotion trigger** for [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) — promote when accuracy on the unscaffolded path drops persistently (starting threshold: 75% for two consecutive weekly runs; tighten once we have baseline data), (c) **alerting** on regression — a meaningful week-over-week drop pages the on-call (starting threshold: 5 percentage points; tighten with experience).
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Running BIRD + Spider on every PR is expensive on LLM provider quota and noisy (model providers' own changes affect the score). Weekly cron is enough cadence to catch real regressions while staying inside the Anthropic / Gemini free-tier daily budgets. Gating *merges* on accuracy creates pressure to game the benchmark (overfitting to BIRD examples); gating *decisions* keeps the harness as a measurement tool, not a goal.
- **Consequence in code:** A new Cloudflare Workers Cron (`tools/eval/cron.ts`) fires weekly, writes results to R2, posts a Grafana annotation, and emits one `feature.eval.weekly` event per [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md). If accuracy drops below thresholds, the cron emits `feature.eval.regression` which routes to the on-call Slack. PR CI runs a smoke-test (50 BIRD examples, ~30 seconds) just to catch outright breakage in the router contract, not for accuracy gating.
- **Alternatives rejected:**
  - PR-gated full eval — too slow, too expensive, encourages benchmark gaming.
  - Manual on-demand only — drift goes undetected for weeks.
  - Daily cron — burns budget for marginal signal; weekly is the right cadence for a metric that moves on the scale of model releases.
  - Eval as a product surface (let users see accuracy) — premature; per-customer schemas don't match BIRD/Spider, so the number would mislead users.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/).

- **GLOBAL-013** — $0/month for the free tier.
  - *In this feature:* the harness uses the same strict-$0 chain users hit; if we exceed the free tier on eval, we're hiding cost that users will hit too.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* the harness instruments per-question spans so failures can be debugged the same way as production calls.
- **GLOBAL-024** — Demand-signal telemetry. *(Eval results emit `feature.eval.*` events.)*
- **GLOBAL-025** — North-star: engine quality, onboarding, UX — each with explicit KPIs.
  - *In this feature:* this feature owns the engine-quality NL→SQL KPIs (BIRD-dev EM, Spider 2.0-lite EM, free-vs-frontier delta, validator FP rate, refuse-vs-hallucinate ratio). Phase 2 floor and Phase 3 floor are set in the GLOBAL-025 KPI table; baseline by 2026-06-15 per `SK-QUAL-005`.
- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid (flat sub + included monthly request allowance + soft-meter overage, 0% markup).
  - *In this feature:* eval runs through both the free chain and the hosted-premium chain (per `SK-QUAL-004`); BYOLLM lane instrumented when an opt-in eval key is configured but never used to gate a floor.

## Open questions / known unknowns

- **Dataset mapping.** BIRD's schemas don't perfectly match our `SchemaPlan` shape. Decide whether to (a) auto-translate BIRD schemas into typed plans at load time, or (b) keep BIRD's raw `information_schema` shape and exercise the *un-scaffolded* path only. (a) is harder but matches production; (b) is faster to ship but measures a different thing. Lean: ship (b) first, layer (a) when semantic-layer promotes.
- **Multi-dialect coverage.** Spider 2.0 includes BigQuery, Snowflake, SQLite. We support Postgres + ClickHouse. Decide whether to run only the PG + ClickHouse subset or to transpile non-supported dialects via `sqlglot`. Lean: PG + CH subset only; document the coverage gap.
- **Fixture cost.** Standing up the full BIRD fixture set is ~6 GB of seed data. Decide whether to stage in Neon Launch ($19/mo) just for the eval run or to run against ephemeral SQLite. Lean: ephemeral SQLite for read-only correctness checks; Neon only if a benchmark exercises write paths.
- **Privacy.** No user data ever flows into the eval harness. Document this firmly so a future contributor doesn't "improve coverage" by sampling production schemas. The harness is for *public* benchmark data only.
