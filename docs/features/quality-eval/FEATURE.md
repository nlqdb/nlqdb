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

**One-liner:** NL-to-SQL accuracy benchmarking — three-dataset canon (BIRD-dev + Spider 2.0-lite SQLite subset + internal `db.create` eval per [`SK-QUAL-003`](#sk-qual-003)) against the LLM router's free / BYOLLM / hosted-premium lanes; the **free-vs-agentic-frontier delta** (`SK-QUAL-004`) is the headline KPI for [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md)'s engine north-star.
**Status:** **Phase 2 — slices 1 + 2 shipped (regression detection + event emission + baseline file).** Slice 1 (`tools/eval/` workspace, BIRD Mini-Dev SQLite runner, multiset EX scorer, free + single-model frontier lanes, weekly workflow) ran end-to-end on `main`. Slice 2 adds: baseline diff (`tools/eval/src/baseline.ts`) against `tools/eval/baseline-2026-06-15.json`; McNemar's paired-binary regression test (`SK-QUAL-006`) as a parallel trigger to the 5-pp threshold per `SK-QUAL-002`; `feature.eval.weekly` + `feature.eval.regression` typed events in `@nlqdb/events`; bearer-token-authenticated `POST /v1/events/eval` ingestion in `apps/api/src/events-feature.ts` → Cloudflare Queues → events-worker → LogSnag `#north-star`; weekly Mon 04:00 UTC cron (switched from daily per `SK-QUAL-002`). PR CI still typechecks + runs unit tests (mocked router + ephemeral SQLite + mocked baseline reader); real provider keys never fire on a PR. **Remaining for the Phase 2 exit gate (slice 3):** Spider 2.0-lite **SQLite-subset** loader (the dataset ships zero PG rows — see `SK-QUAL-003` post-2026-05 correction), internal `db.create` accepted-answer eval (depends on a privacy-stripped R2 export), and the **agentic-frontier lane** (the 80% Phase 2 floor in `GLOBAL-025` is single-model-unreachable per 2026 BIRD leaderboard reality; we need orchestration to clear it). Promotion of [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) still depends on this harness.

**Contribution to north-star:** Engine quality, NL→SQL layer — this feature IS the measurement instrument. The three-dataset canon (`SK-QUAL-003`) feeds the BIRD-dev / Spider 2.0-lite KPIs and the free-vs-frontier delta in the [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) KPI table; the weekly cron in `SK-QUAL-002` is the alert-and-decision input.
**Owners (code):** `tools/eval/**`, `packages/llm/**`, `.github/workflows/quality-eval-bird-mini.yml`
**Cross-refs:** [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) (the moat this harness measures the need for) · `llm-router/FEATURE.md` (the system under test) · `trust-ux/FEATURE.md` (uses these metrics to calibrate `SK-TRUST-003` confidence floors) · [`docs/research-receipts.md §8`](../../research-receipts.md) (dbt 2026 semantic-layer accuracy research)

## Touchpoints — read this feature before editing

- `tools/eval/` — benchmark runner (slices 1 + 2 shipped):
  - `src/runner.ts` — main driver, CLI entry, lane loop, baseline + emit integration
  - `src/score.ts` — execution-accuracy scorer (multiset / sequence-strict)
  - `src/lanes.ts` — free + single-model frontier router builders
  - `src/baseline.ts` — read baseline JSON + per-lane diff + McNemar (`SK-QUAL-006`)
  - `src/significance.ts` — McNemar exact-binomial + Edwards' continuity-corrected χ² (`SK-QUAL-006`)
  - `src/emit.ts` — POST report to `/v1/events/eval` (typed event fanout)
  - `src/datasets/bird-mini.ts` — HuggingFace `birdsql/bird_mini_dev` loader
  - `src/output.ts` — JSON report writer
  - `baseline-2026-06-15.json` — pinned canonical baseline (`SK-QUAL-005`)
- `.github/workflows/quality-eval-bird-mini.yml` — weekly Mon 04:00 UTC + manual dispatch
- `apps/api/src/events-feature.ts::recordEvalReport` — bearer-token cron ingestion
- `apps/api/src/index.ts` — `POST /v1/events/eval` route wiring
- `packages/events/src/types.ts` — `FeatureEvalWeeklyEvent`, `FeatureEvalRegressionEvent`
- `apps/events-worker/src/sinks/logsnag.ts` — `#north-star` channel mappings
- `packages/llm/src/router.ts` — the system under test (calls `plan()` with `dialect: "sqlite"`)
- `packages/llm/src/types.ts` — `PlanRequest.dialect` was widened to `"postgres" | "sqlite"` for SK-QUAL-001
- `apps/api/src/ask/sql-validate.ts` — schema-fit checks the harness exercises
- The Postgres / ClickHouse adapter test fixtures — repurposed as eval fixtures

## Decisions

### SK-QUAL-001 — Benchmark canon: BIRD (real-world) + Spider 2.0 (multi-dialect); accuracy reported by tier

- **Decision:** The eval harness runs two open benchmarks: **BIRD** (Big Bench for Industrial Database; messy real-world schemas — BIRD Mini-Dev ships 500 questions across 11 SQLite DBs, with MySQL + Postgres transpilations added 2025-07) and **Spider 2.0-lite** (SQLite subset only — the dataset ships ~260 rows across BigQuery / Snowflake / DuckDB / SQLite, no Postgres; cross-engine generalisation comes from BIRD's dialect transpilations instead). Accuracy is reported separately for each tier of the [`llm-router`](../llm-router/FEATURE.md) — Tier 1 (cheap classify), Tier 2 (Sonnet plan), Tier 3 (Opus hard) — and separately with and without the semantic-layer scaffolding.
- **Core value:** Bullet-proof, Honest latency
- **Why:** A single accuracy number averaged across tiers hides the failure mode (Opus is fine, Tier 1 misroutes). Per-tier reporting tells us *which model* to retrain / swap / cap. BIRD is the standard "messy real-world" benchmark and the closest analogue to the schemas users build with `db.create`. Spider 2.0 covers dialect / cross-domain generalization that BIRD doesn't. Both are public; results stay comparable to published research.
- **Consequence in code:** `tools/eval/src/runner.ts` (shipped slice 1) loads BIRD Mini-Dev, calls `packages/llm/src/router.ts::plan()` with the question + schema, executes the generated SQL against the BIRD SQLite fixtures, and compares the result-set to the gold answer. Per-lane accuracy lands in `tools/eval/results/<iso>.json`; baseline diff + event emission ship in slice 2 per `SK-QUAL-002`. Spider 2.0-lite SQLite loader ships in slice 3. The harness is a tool, not a CI gate (see `SK-QUAL-002`).
- **Alternatives rejected:**
  - Bespoke internal benchmark — non-comparable to research; no external validity.
  - WikiSQL only — too easy; saturated by 2024.
  - Spider 1.0 only — superseded; 2.0 covers more dialects.
  - Single averaged accuracy number — hides per-tier regression, the actionable signal.
  - **Spider 2.0 full set including BQ/Snowflake via transpilation** — adds a transpilation-bug failure mode the harness can't distinguish from a model-quality regression; SQLite subset is the honest call (corrected 2026-05).

### SK-QUAL-003 — Three-dataset canon: BIRD-dev + Spider 2.0-lite (SQLite subset) + internal `db.create` eval (the third dataset is the one that matters most)

- **Decision:** The harness reports on **three** datasets, in this order of weight: (1) **Internal `db.create` eval** — questions sampled from real user `db.create` schemas (anonymized via aggressive column-name + value-class swaps; no row data persisted), scored against the gold answer the user actually accepted; this is the dataset that most closely matches production. (2) **BIRD-dev** (Mini-Dev, 500 SQLite questions) — public, comparable to published research, our "honest external" yardstick; **annotation errors confirmed at ~52% by VLDB/CIDR 2026 papers** — runs are also evaluated against the `uiuc-kang-lab/text_to_sql_benchmarks` corrected variant when available. (3) **Spider 2.0-lite SQLite subset** — Spider 2.0-lite ships **zero Postgres rows** (BigQuery + Snowflake + DuckDB + SQLite, ~260 total per HF viewer 2026-05). We restrict to the SQLite-flavoured rows; cross-engine generalisation evidence comes from BIRD's dialect transpilations (added 2025-07) instead.
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** Public benchmarks are gameable and stale — BIRD's distribution doesn't match a `db.create` schema, and Spider 2.0's enterprise complexity isn't what a solo-developer persona is asking. The internal eval, built from actually-accepted answers, is the only dataset that measures the thing we ship. Public benchmarks stay in the table for external comparability and so the "free-vs-frontier delta" stays meaningful to readers outside the team. **The three weights are not equal** — when the internal eval and BIRD disagree, internal wins. This prevents BIRD-overfit, the failure mode that broke the 2024 leaderboard *and was re-confirmed by VLDB / CIDR 2026 papers showing ~52% annotation-error rate on BIRD Mini-Dev*. The original doc claim of "PG + ClickHouse subset only" was wrong — Spider 2.0-lite has no PG rows. Corrected 2026-05.
- **Consequence in code:** `tools/eval/datasets/` ships three loaders: `bird-mini.ts` (shipped slice 1), `spider2-lite.ts` (slice 3 — SQLite subset only), and `internal.ts` (slice 3 — reads `db.create` accepted-answer rows from a dedicated R2 bucket with `principal.id` stripped at write time per [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md)'s privacy contract). The weekly cron runs all three once slice 3 lands. The Grafana panel shows three lines, plus the free-vs-agentic-frontier delta as a separate panel.
- **Alternatives rejected:**
  - Internal-only — no external comparability; can't honestly answer "are you state of the art?"
  - BIRD-only — what we already had; misses the production-shape gap.
  - Equal weighting — when internal and BIRD disagree, the team has to choose; tying it to "internal wins" pre-commits us to the right answer.
  - **Spider 2.0-lite via sqlglot transpilation** (BQ/Snowflake → PG) — adds a transpilation-bug failure mode we can't distinguish from a model-quality regression; SQLite-only subset is the honest call.

### SK-QUAL-004 — Free-vs-agentic-frontier delta is the headline KPI; single-model frontier reports informationally

- **Decision:** The harness reports execution-match accuracy under **three dispatch lanes** ([`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)): the **free chain** (Gemini Flash → Groq → Workers-AI → OpenRouter free), **single-model frontier** (Sonnet 4.6 / GPT-5 / Gemini 2.5 Pro class, no orchestration — informational), and **agentic-frontier** (frontier model + planner + validator + retry per `SK-LLM-017`; the system class that clears 80% BIRD-dev per Agentar/ReViSQL 2026). The **free-vs-agentic-frontier delta** is the single most-watched number. Narrowing delta = nlqdb's scaffolding (planner, validator, plan-cache, schema retrieval, few-shot, retry) is compounding. Widening delta = we're shipping distribution faster than engine work. **Slice 1 shipped the free + single-model frontier lanes;** the agentic lane lands in slice 3 (depends on `SK-LLM-017` orchestration exposing a `plan()`-compatible callable).
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** Without this number, the "great-on-free-LLMs ⇒ invincible-on-frontier-LLMs" thesis is unfalsifiable. Reporting only frontier accuracy hides the free-tier user experience; reporting only free accuracy hides whether the engine has headroom. The delta makes both visible in one number, with target trajectory in [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md): ≤ 25 pp (Phase 2 floor) → ≤ 16 pp (Phase 3 floor). The 2026 BIRD leaderboard reality (single-model frontier ≈ 73%, agentic SOTA ≈ 87-91%) is what forces the agentic-vs-single-model split — pre-2026-05 the docs assumed single-model frontier could clear 88%; revised based on live leaderboard verification.
- **Consequence in code:** `tools/eval/lanes.ts` selects the dispatch lane per run; the same questions are evaluated through both lanes back-to-back so the delta is per-question, not per-run-average (cancels noise). BYOLLM lane is also instrumented when an opt-in eval key is configured, but does not gate any floor — BYOLLM accuracy depends on the user's key, not on our work. `report.free_vs_frontier_delta` keeps its name (back-compat with slice-1 baselines); the field stores the agentic-frontier delta once that lane ships.
- **Alternatives rejected:**
  - One average accuracy number — hides which lane is regressing.
  - Per-tier accuracy without a delta — forces every reader to do the subtraction; team focus dissipates.
  - Delta tracked only on BIRD — too narrow; the internal eval's delta is the production-shape one.
  - **Single-model frontier only** — caps the visible ceiling at ~73% and makes the moat thesis untestable; agentic-frontier is the right comparator for "what does *nlqdb the system* achieve on a frontier model".

### SK-QUAL-005 — Baseline by 2026-06-15; first floor enforced in Phase 2 exit gate

- **Decision:** The Phase 2 exit gate requires recorded baseline values for every engine-quality KPI in the [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) table by **2026-06-15**. The Phase 2 floor (BIRD-dev EM ≥ 72% free / ≥ 88% frontier; delta ≤ 22 pts) is enforced from the moment baselines exist. If baselines are below the floor on first measurement, the slice does not regress them — it ships engine work until the floor is cleared.
- **Core value:** Bullet-proof
- **Why:** "Phase 2 KPI floors" is meaningless without a baseline date. 2026-06-15 leaves ~one month from harness ship to baseline measurement — enough to debug the runner, not enough to drift. If we miss this date, the Phase 2 rollover is blocked per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) — that is the point.
- **Consequence in code:** `tools/eval/baseline-2026-06-15.json` is the canonical baseline snapshot. The weekly cron diffs against it. PRs that touch `packages/llm/**` add a one-line note to their description naming which KPI they're moving.
- **Alternatives rejected:**
  - No baseline date — "soon" never happens.
  - Baseline floor = whatever first measurement returns — ratchets us into accepting bad numbers as the new normal.

### SK-QUAL-002 — Eval is a weekly cron, not a PR gate; thresholds drive *decisions*, not *merges*

**Body:** [`decisions/SK-QUAL-002-weekly-cron.md`](./decisions/SK-QUAL-002-weekly-cron.md).
Weekly Mon 04:00 UTC GitHub Actions cron (Workers Cron CPU + wall-clock
limits rule it out). Regression alerts fire on **either** EA delta ≤ -5
pp **or** McNemar p < 0.05 (`SK-QUAL-006`); both report separately.
Runner POSTs `POST /v1/events/eval` with a bearer token; the API emits
`feature.eval.weekly` always + one `feature.eval.regression` per
(lane, trigger) through the canonical Cloudflare Queues → LogSnag pipeline.

### SK-QUAL-006 — McNemar's paired-binary test as a parallel regression trigger

**Body:** [`decisions/SK-QUAL-006-mcnemar-paired-test.md`](./decisions/SK-QUAL-006-mcnemar-paired-test.md).
Per-lane regression alerts fire on two parallel triggers: (1) the
`SK-QUAL-002` 5-pp threshold on EA delta, and (2) McNemar's paired-binary
test (α = 0.05) on per-question outcomes. Both trigger independently;
each emits its own `feature.eval.regression`. McNemar catches small-but-real
regressions that the threshold misses at N ≈ 500 (binomial SE ≈ 2.2 pp).

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
- **GLOBAL-027** — Pre-alpha gate consumes the free-chain BIRD/Spider numbers this feature produces.
  - *In this feature:* the weekly cron's report shape is the contract `apps/api/src/gate/eval-baseline.ts` mirrors. When a cron run lands new numbers, the follow-up PR amends `eval-baseline.ts` so the gate's threshold check sees fresh values. Lifecycle: when both lanes clear (BIRD ≥ 0.65 AND Spider ≥ 0.75), the gate's removal PR also retires `GLOBAL-027`. See [`pre-alpha-gate/FEATURE.md`](../pre-alpha-gate/FEATURE.md).

## Open questions / known unknowns

- **Dataset mapping.** BIRD's schemas don't perfectly match our `SchemaPlan` shape. Decide whether to (a) auto-translate BIRD schemas into typed plans at load time, or (b) keep BIRD's raw `information_schema` shape and exercise the *un-scaffolded* path only. (a) is harder but matches production; (b) is faster to ship but measures a different thing. Lean: ship (b) first, layer (a) when semantic-layer promotes. **Slice 1 chose (b)** — `tools/eval/src/runner.ts::introspectSchema` reads `sqlite_master` and passes the raw `CREATE TABLE` DDL to `plan()`.
- **Fixture cost.** Standing up the full BIRD fixture set is ~6 GB of seed data. Decide whether to stage in Neon Launch ($19/mo) just for the eval run or to run against ephemeral SQLite. Lean: ephemeral SQLite for read-only correctness checks; Neon only if a benchmark exercises write paths. **Slice 1 chose ephemeral SQLite** — `bun:sqlite` opened readonly, `bird_data/` cached in GH Actions.
- **Privacy.** No user data ever flows into the eval harness. Document this firmly so a future contributor doesn't "improve coverage" by sampling production schemas. The harness is for *public* benchmark data only.
- **Validator integration.** Slice 1 calls `packages/llm/src/router.ts::plan()` directly — the LLM's raw plan output goes straight to execution. Production wraps `plan()` in `withStageRetry` + `validateSql` (`apps/api/src/ask/orchestrate.ts`), which lifts accuracy on the retry pass. Slice 2 left this open (the validator is libpg_query-based and Postgres-only; BIRD is SQLite, so re-using production's validator directly doesn't work). Slice 3 should add a *generic-execution-retry pipeline lane* (max 1 retry on `exec_error`) and report `(raw, pipeline)` as two columns per `GLOBAL-025`'s scaffolding thesis.
- **Hosted-premium / agentic-frontier lane.** Slice 1 + 2 ship the free + single-model-frontier lanes. Slice 3 lands the agentic-frontier lane (`SK-LLM-017`-style orchestration: planner → validator → exec → retry) so the Phase 2 floor of ≥ 80% BIRD-dev EM is provable. GPT-5 and Gemini 2.5 Pro added as separate frontier providers in slice 3 so per-model accuracy is visible. BYOLLM-lane instrumentation lands once `SK-LLM-016` ships.
- **Corrected-set evaluation (VLDB/CIDR 2026).** Two 2026 papers showed ~52% annotation errors in BIRD Mini-Dev; `uiuc-kang-lab/text_to_sql_benchmarks` publishes corrected variants. Decide whether slice 3 should evaluate against *both* the canonical and corrected sets and report deltas — yes if it's a 50-LOC patch (load the second JSON, join by `question_id`); no if it doubles the run cost without a new decision lever. Lean: yes (run cost dominated by LLM call, dataset switch is free).
