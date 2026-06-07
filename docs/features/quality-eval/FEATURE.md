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
**Status:** **Phase 2 — slices 1 + 2 + 3a + 3b + 3c shipped.** Slices 1 + 2 (BIRD Mini-Dev runner + EX scorer + free / single-model-frontier lanes; baseline diff against `tools/eval/baseline-2026-06-15.json`; McNemar per `SK-QUAL-006`; `feature.eval.{weekly,regression}` via `POST /v1/events/eval` → Queues → LogSnag `#north-star`; weekly Mon 04:00 UTC cron) ran end-to-end on `main`. Slice 3a (`SK-QUAL-007`) the Spider 2.0-lite loader; 3b (`SK-QUAL-008`) the canonical multi-CSV comparator; 3c (`SK-QUAL-009`) the `withExecRetry` scaffold + `agentic-frontier` lane + the `free_vs_agentic_frontier_delta` KPI — mechanics in each SK block below. PR CI typechecks + unit-tests with a mocked router and cached fixtures; real provider keys never fire on a PR. The runner is **resumable** (`SK-QUAL-011`) and runs on a **weekly canonical baseline + capped 4h smoke** cadence (`SK-QUAL-002`). **Remaining for the Phase 2 exit gate:** internal `db.create` accepted-answer eval (depends on a privacy-stripped R2 export) and first weekly measurement of the new lane to seed `baseline-2026-06-15.json` + `apps/api/src/gate/eval-baseline.ts`. Promotion of [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) still depends on this harness.

**Contribution to north-star:** Engine quality, NL→SQL layer — this feature IS the measurement instrument. The three-dataset canon (`SK-QUAL-003`) feeds the BIRD-dev / Spider 2.0-lite KPIs and the free-vs-frontier delta in the [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) KPI table; the weekly cron in `SK-QUAL-002` is the alert-and-decision input.
**Owners (code):** `tools/eval/**`, `packages/llm/**`, `.github/workflows/quality-eval-bird-mini.yml`
**Cross-refs:** [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) (the moat this harness measures the need for) · `llm-router/FEATURE.md` (the system under test) · `trust-ux/FEATURE.md` (uses these metrics to calibrate `SK-TRUST-003` confidence floors) · [`docs/research-receipts.md §8`](../../research-receipts.md) (dbt 2026 semantic-layer accuracy research)

## Touchpoints — read this feature before editing

- `tools/eval/` — benchmark runner (slices 1 + 2 + 3a + 3b + 3c shipped):
  - `src/runner.ts` — multi-dataset driver, CLI entry, lane loop, baseline + emit integration; wraps `plan() → score()` in `withExecRetry` for scaffolded lanes (`SK-QUAL-009`); routes Spider 2.0 rows to `scoreOneSpider2` (`SK-QUAL-008`)
  - `src/exec-retry.ts` — `withExecRetry({maxAttempts, plan, request, score})` (`SK-QUAL-009`): bounded retry loop on `exec_error` only; threads previous SQL + error into `PlanRequest.previousAttempt`
  - `src/score.ts` — BIRD's multiset / sequence-strict EX scorer **plus** the Spider 2.0 multi-CSV `comparePandasTable` / `compareMultiPandasTable` port + `scoreOneSpider2` (`SK-QUAL-008`)
  - `src/csv.ts` — minimal RFC-4180 CSV parser + per-column type inference for pandas-emitted gold CSVs (`SK-QUAL-008`)
  - `src/lanes.ts` — three lane builders: `free` (scaffolded), `frontier` (unscaffolded reference per `SK-QUAL-004`), `agentic-frontier` (scaffolded, opt-in via `RUN_AGENTIC_FRONTIER=1`) per `SK-QUAL-009`
  - `src/baseline.ts` — read baseline JSON + per-lane diff + McNemar (`SK-QUAL-006`)
  - `src/significance.ts` — McNemar exact-binomial + Edwards' continuity-corrected χ² (`SK-QUAL-006`)
  - `src/emit.ts` — POST report to `/v1/events/eval` (typed event fanout)
  - `src/datasets/bird-mini.ts` — HuggingFace `birdsql/bird_mini_dev` loader
  - `src/datasets/spider2-lite.ts` — Spider 2.0-lite SQLite-subset loader (`SK-QUAL-007` + `SK-QUAL-008`); hydrates per-instance gold CSV(s) + `condition_cols` / `ignore_order` from `xlang-ai/Spider2@main` (HF mirror is stale per 2026-05-19 verification)
  - `src/output.ts` — JSON report writer
  - `src/checkpoint.ts` — resumable-runner checkpoint (load / append / complete) per `SK-QUAL-011`
  - `baseline-2026-06-15.json` — pinned canonical baseline (`SK-QUAL-005`)
- `.github/workflows/quality-eval-bird-mini.yml` — BIRD: weekly full cron (Mon 04:00 UTC) + capped 4h `smoke` job (`SK-QUAL-011`) + manual dispatch (`include_agentic_frontier` → `RUN_AGENTIC_FRONTIER=1` per `SK-QUAL-009`)
- `.github/workflows/quality-eval-spider2-lite.yml` — Spider: weekly full cron (Tue 04:00 UTC) + capped 4h `smoke` job + manual dispatch (`SK-QUAL-007` + `SK-QUAL-009` agentic toggle)
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

- **Decision:** The eval harness runs two open benchmarks: **BIRD** (Big Bench for Industrial Database; messy real-world schemas — BIRD Mini-Dev ships 500 questions across 11 SQLite DBs, with MySQL + Postgres transpilations added 2025-07) and **Spider 2.0-lite** (SQLite subset only — the upstream `xlang-ai/Spider2@main` ships **547 rows** total across BigQuery (180) / Snowflake (207) / SQLite (135) / Google-Analytics SF (25); DuckDB lives in the separate `spider2-dbt` dataset, not lite; zero Postgres rows. Cross-engine generalisation evidence comes from BIRD's dialect transpilations instead). Accuracy is reported separately for each tier of the [`llm-router`](../llm-router/FEATURE.md) — Tier 1 (cheap classify), Tier 2 (Sonnet plan), Tier 3 (Opus hard) — and separately with and without the semantic-layer scaffolding.
- **Core value:** Bullet-proof, Honest latency
- **Why:** A single accuracy number averaged across tiers hides the failure mode (Opus is fine, Tier 1 misroutes). Per-tier reporting tells us *which model* to retrain / swap / cap. BIRD is the standard "messy real-world" benchmark and the closest analogue to the schemas users build with `db.create`. Spider 2.0 covers dialect / cross-domain generalization that BIRD doesn't. Both are public; results stay comparable to published research.
- **Consequence in code:** `tools/eval/src/runner.ts` (shipped slice 1) loads BIRD Mini-Dev, calls `packages/llm/src/router.ts::plan()` with the question + schema, executes the generated SQL against the BIRD SQLite fixtures, and compares the result-set to the gold answer. Per-lane accuracy lands in `tools/eval/results/<iso>.json`; baseline diff + event emission ship in slice 2 per `SK-QUAL-002`. Spider 2.0-lite SQLite loader ships in slice 3a per [`SK-QUAL-007`](#sk-qual-007); slice 3b ([`SK-QUAL-008`](#sk-qual-008)) ships the canonical multi-CSV scorer so all 135 `local###` rows contribute. The harness is a tool, not a CI gate (see `SK-QUAL-002`).
- **Alternatives rejected:**
  - Bespoke internal benchmark — non-comparable to research; no external validity.
  - WikiSQL only — too easy; saturated by 2024.
  - Spider 1.0 only — superseded; 2.0 covers more dialects.
  - Single averaged accuracy number — hides per-tier regression, the actionable signal.
  - **Spider 2.0 full set including BQ/Snowflake via transpilation** — adds a transpilation-bug failure mode the harness can't distinguish from a model-quality regression; SQLite subset is the honest call (corrected 2026-05).

### SK-QUAL-003 — Three-dataset canon: BIRD-dev + Spider 2.0-lite (SQLite subset) + internal `db.create` eval (the third dataset is the one that matters most)

**Body:** [`decisions/SK-QUAL-003-three-dataset-canon.md`](./decisions/SK-QUAL-003-three-dataset-canon.md).
Three datasets in weighted order: (1) internal `db.create` accepted-answer
eval (production-shape, internal-wins on disagreement); (2) BIRD-dev Mini-Dev
(500 SQLite — public, comparable; **52.8% annotation errors** per VLDB/CIDR
2026 [arXiv:2601.08778](https://arxiv.org/abs/2601.08778), corrected variants
in `uiuc-kang-lab/text_to_sql_benchmarks`); (3) Spider 2.0-lite **SQLite
subset only** — upstream ships **547 rows total** (180 BQ / 207 SF / 135
SQLite / 25 GA-SF; zero Postgres). All 135 `local###` rows now score via
the canonical multi-CSV evaluator per [`SK-QUAL-008`](#sk-qual-008); the
loader pins to GitHub raw — HF mirror was stale at 260 rows 2026-05-19.

### SK-QUAL-004 — Free-vs-agentic-frontier delta is the headline KPI; single-model frontier reports informationally

**Body:** [`decisions/SK-QUAL-004-free-vs-frontier-delta.md`](./decisions/SK-QUAL-004-free-vs-frontier-delta.md).
Three lanes per [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md):
**free**, **single-model frontier** (informational, ~73% canonical
BIRD-dev), **agentic-frontier** (~77-82% canonical SOTA — AskData+GPT-4o
77.64%/81.95%, Agentar 74.90%/81.67%; the ~93% from ReViSQL etc. is on the
Arcwise-corrected set, not canonical). Headline KPI is the
**free-vs-agentic-frontier delta** — Phase 2 ≤ 25 pp, Phase 3 ≤ 16 pp per
[`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md). Slice 1 + 2
shipped free + single-model-frontier; agentic lane lands in slice 3c with
`SK-LLM-017`.

### SK-QUAL-005 — Baseline by 2026-06-15; first floor enforced in Phase 2 exit gate

- **Decision:** The Phase 2 exit gate requires recorded baseline values for every engine-quality KPI in the [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) table by **2026-06-15**. The Phase 2 floor (BIRD-dev EM ≥ 72% free / ≥ 88% frontier; delta ≤ 22 pts) is enforced from the moment baselines exist. If baselines are below the floor on first measurement, the slice does not regress them — it ships engine work until the floor is cleared.
- **Core value:** Bullet-proof
- **Why:** "Phase 2 KPI floors" is meaningless without a baseline date. 2026-06-15 leaves ~one month from harness ship to baseline measurement — enough to debug the runner, not enough to drift. If we miss this date, the Phase 2 rollover is blocked per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) — that is the point.
- **Consequence in code:** `tools/eval/baseline-2026-06-15.json` is the canonical baseline snapshot. The weekly cron diffs against it. PRs that touch `packages/llm/**` add a one-line note to their description naming which KPI they're moving.
- **Alternatives rejected:**
  - No baseline date — "soon" never happens.
  - Baseline floor = whatever first measurement returns — ratchets us into accepting bad numbers as the new normal.

### SK-QUAL-002 — Eval cadence: weekly canonical baseline + capped 4h smoke; never a PR gate

**Body:** [`decisions/SK-QUAL-002-weekly-cron.md`](./decisions/SK-QUAL-002-weekly-cron.md).
Two scheduled cadences, never per-PR/per-merge: the **weekly full pass**
(BIRD Mon / Spider Tue 04:00 UTC) is canonical — diffs the baseline +
emits `feature.eval.weekly` / `feature.eval.regression` (EA delta ≤ -5 pp
**or** McNemar p < 0.05, `SK-QUAL-006`). A **capped 4h smoke** runs a
fixed sampled slice (`--sample-seed`) only on engine change since
`last_eval_sha` (≤6/day; `concurrency` coalesces onto latest HEAD),
never emits, never overwrites the baseline. Decoupling cadence from merge
volume avoids blowing the shared 1M/day free-tier cap; resilience via
[`SK-QUAL-011`](#sk-qual-011).

### SK-QUAL-011 — Resumable runner: checkpoint + budget-stop so a run survives a free-tier daily token cap

**Body:** [`decisions/SK-QUAL-011-resumable-runner.md`](./decisions/SK-QUAL-011-resumable-runner.md).
`tools/eval/src/checkpoint.ts` writes one JSONL line per scored
`(question_id, lane)` pair; `runEval` skips done pairs and appends as it
goes (deterministic `--sample-seed` order). When the whole chain is
rate-limited (`AllProvidersFailedError` all-`rate_limited`, the
[`SK-LLM-030`](../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)
contract) the run **budget-stops**: keeps the checkpoint, marks the report
`resumable: true`, doesn't emit, exits 0; the next dispatch resumes.
Checkpoint + `last_eval_sha` persist via `actions/cache`.

### SK-QUAL-006 — McNemar's paired-binary test as a parallel regression trigger

**Body:** [`decisions/SK-QUAL-006-mcnemar-paired-test.md`](./decisions/SK-QUAL-006-mcnemar-paired-test.md).
Per-lane regression alerts fire on two parallel triggers: (1) the
`SK-QUAL-002` 5-pp threshold on EA delta, and (2) McNemar's paired-binary
test (α = 0.05) on per-question outcomes. Both trigger independently;
each emits its own `feature.eval.regression`. McNemar catches small-but-real
regressions that the threshold misses at N ≈ 500 (binomial SE ≈ 2.2 pp).

### SK-QUAL-007 — Spider 2.0-lite SQLite-subset loader (slice 3a) — superseded by `SK-QUAL-008` for the scoring contract

**Body:** [`decisions/SK-QUAL-007-spider2-lite-loader.md`](./decisions/SK-QUAL-007-spider2-lite-loader.md).
**Status:** scoring contract superseded by [`SK-QUAL-008`](#sk-qual-008); the
file-layout / `local###` filter / path-traversal guard contracts still apply.

### SK-QUAL-008 — Spider 2.0-lite multi-CSV scorer (slice 3b) ports the canonical pandas comparator to TypeScript

**Body:** [`decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md`](./decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md).
Slice 3b lifts all 135 `local###` rows to scoreable: TypeScript port of
`compare_pandas_table` + `compare_multi_pandas_table`
(`tools/eval/src/score.ts::comparePandasTable` /
`compareMultiPandasTable` / `scoreOneSpider2`), a minimal
pandas-CSV parser (`tools/eval/src/csv.ts`), and a refit loader that
fetches per-instance gold CSV(s) + `condition_cols` / `ignore_order`
from `evaluation_suite/gold/`. Two invariants pinned by tests so the
port can't drift: `abs_tol = 1e-2` matches `math.isclose`, and the
`ignore_order` sort key `(x is None, str(x), is-numeric)` byte-matches
Python. The Spider workflow sparse-clones `evaluation_suite/gold/` into the
cached `spider2_data/` so the loader resolves every gold CSV off-disk in CI.

### SK-QUAL-009 — Agentic exec-retry scaffold + `agentic-frontier` lane (slice 3c)

**Body:** [`decisions/SK-QUAL-009-exec-retry-agentic-lane.md`](./decisions/SK-QUAL-009-exec-retry-agentic-lane.md).
New `tools/eval/src/exec-retry.ts::withExecRetry` wraps `plan() → score()`
in a bounded loop (`maxAttempts: 3`, exec-error-only, threads
`PlanRequest.previousAttempt`). Two lanes scaffold (`free` +
`agentic-frontier`); single-model `frontier` stays the unscaffolded ablation
reference. New headline KPI `free_vs_agentic_frontier_delta` lands on
`EvalReport` + `FeatureEvalWeeklyEvent` + the LogSnag card per `GLOBAL-025`.
Inference-time exec-retry evidence base is in the decision body.

### SK-QUAL-010 — BIRD scorer compares positional value tuples (column names ignored), matching canonical `evaluation.py`

**Body:** [`decisions/SK-QUAL-010-bird-positional-tuple-parity.md`](./decisions/SK-QUAL-010-bird-positional-tuple-parity.md).
`scoreOne` + the Spider `rowsToColumnMajor` transpose read positional tuples
(`.values()`) not name-keyed objects (`.all()`), so output aliases / casing
no longer enter the comparison — matching canonical BIRD `set(fetchall())`.
Multiset + ORDER-BY strictness (`SK-QUAL-008`) retained (conservative lower
bound); first post-fix cron re-seeds the baseline (`SK-QUAL-005`).

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

- **Privacy** — Decided: no user data ever flows into the eval harness. The harness is for public benchmark data only (BIRD, Spider). Any PR that adds production schema sampling is a security defect.
- **Deferred: a dedicated `feature.eval.smoke` event.** The 4h smoke
  cadence (`SK-QUAL-002`) produces a CI artifact + run-summary table and
  does **not** emit, keeping the weekly dashboard uncontaminated. A
  first-class `feature.eval.smoke` event touches `packages/events`,
  `recordEvalReport`, and the LogSnag sink — out of proportion to the
  immediate need; promote when a smoke dashboard is actually wanted.
- **Deferred: a hard token-budget counter in the runner.** Today the
  budget guard is W2's rate-limit signal (a 429-saturated chain
  budget-stops via `SK-QUAL-011`) plus the changed-since-`last_eval_sha`
  gate. A pre-emptive per-day token ceiling is parked — we don't know each
  free tier's true limit, and the reactive stop is self-calibrating.
- **Validator integration.** **Resolved in slice 3c per [`SK-QUAL-009`](#sk-qual-009)** — `withExecRetry` wraps `plan() → score()`, bounded at the production retry budget (exec-error-only, threads `PlanRequest.previousAttempt`). Evidence base (MAC-SQL Refiner, CHESS, MAGIC; RetrySQL-is-training-time correction) in the SK-QUAL-009 body.
- **Hosted-premium / agentic-frontier lane.** **Slice 3c shipped per [`SK-QUAL-009`](#sk-qual-009)** — `agentic-frontier` wraps the single-model frontier provider in `withExecRetry` (opt-in `RUN_AGENTIC_FRONTIER=1`); unscaffolded `frontier` stays the ablation reference. **Still open:** multi-model frontier expansion (GPT-5 + Gemini 2.5 Pro as separate provider entries) — deferrable until the Sonnet 4.6 baseline lands; BYOLLM-lane instrumentation still depends on `SK-LLM-016`.
- **Spider 2.0-lite multi-CSV result-set scorer (slice 3b).** **Shipped** per [`SK-QUAL-008`](#sk-qual-008). Follow-up: pin a `xlang-ai/Spider2` commit SHA in the next Spider baseline so leaderboard churn shows up as a visible PR diff (placeholder under `SK-QUAL-005`).
- **Corrected-set evaluation (VLDB/CIDR 2026 — `uiuc-kang-lab/text_to_sql_benchmarks`).** UIUC Kang ([arXiv:2601.08778](https://arxiv.org/abs/2601.08778)) found 52.8% annotation errors in BIRD Mini-Dev and ship two corrected variants. Open: evaluate against *both* canonical and corrected sets, reporting Spearman-rank deltas (not McNemar — gold labels differ). Lean yes if it's a ~50-LOC patch (join by `question_id`, same scorer) and the corrected JSON's license permits bundling.
