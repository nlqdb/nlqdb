---
name: quality-eval
description: NL-to-SQL accuracy benchmarking — BIRD/Spider against the LLM router; thresholds gate semantic-layer promotion and confidence-floor tuning.
when-to-load:
  globs:
    - packages/llm/**
    - apps/api/src/ask/**
    - tools/eval/**
  topics: [eval, benchmark, BIRD, Spider, accuracy, semantic-layer]
---

# Feature: Quality Eval

**One-liner:** NL-to-SQL accuracy benchmarking — BIRD/Spider against the LLM router; thresholds gate semantic-layer promotion and confidence-floor tuning.
**Status:** planned (Phase 3) — design-locked here, no harness code yet. Promotion of [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) depends on metrics from this harness.
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

## Open questions / known unknowns

- **Dataset mapping.** BIRD's schemas don't perfectly match our `SchemaPlan` shape. Decide whether to (a) auto-translate BIRD schemas into typed plans at load time, or (b) keep BIRD's raw `information_schema` shape and exercise the *un-scaffolded* path only. (a) is harder but matches production; (b) is faster to ship but measures a different thing. Lean: ship (b) first, layer (a) when semantic-layer promotes.
- **Multi-dialect coverage.** Spider 2.0 includes BigQuery, Snowflake, SQLite. We support Postgres + ClickHouse. Decide whether to run only the PG + ClickHouse subset or to transpile non-supported dialects via `sqlglot`. Lean: PG + CH subset only; document the coverage gap.
- **Fixture cost.** Standing up the full BIRD fixture set is ~6 GB of seed data. Decide whether to stage in Neon Launch ($19/mo) just for the eval run or to run against ephemeral SQLite. Lean: ephemeral SQLite for read-only correctness checks; Neon only if a benchmark exercises write paths.
- **Privacy.** No user data ever flows into the eval harness. Document this firmly so a future contributor doesn't "improve coverage" by sampling production schemas. The harness is for *public* benchmark data only.
