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
**Status:** **Phase 2 — slices 1 + 2 + 3a + 3b + 3c shipped.** BIRD Mini-Dev + Spider 2.0-lite runners + EX scorers; free / single-model-frontier / `agentic-frontier` lanes; baseline diff vs `tools/eval/baseline-2026-06-15.json` + McNemar (`SK-QUAL-006`); `feature.eval.{weekly,regression}` via `POST /v1/events/eval` → Queues → LogSnag `#north-star`. The runner is **resumable** (`SK-QUAL-011`/`SK-QUAL-013`) and runs **manually on demand** (`SK-QUAL-002`); canonical 6-provider runs seed the baseline + `apps/api/src/gate/eval-baseline.ts`. **Remaining for the Phase 2 exit gate:** internal `db.create` accepted-answer eval (depends on a privacy-stripped R2 export). Promotion of [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) still depends on this harness.

**Contribution to north-star:** Engine quality, NL→SQL layer — this feature IS the measurement instrument; the on-demand run (`SK-QUAL-002`) is the alert-and-decision input.
**Owners (code):** `tools/eval/**`, `packages/llm/**`, `.github/workflows/quality-eval-bird-mini.yml`
**Cross-refs:** [`docs/future/semantic-layer.md`](../../future/semantic-layer.md) (the moat this harness measures) · `llm-router/FEATURE.md` (system under test) · `trust-ux/FEATURE.md` (calibrates `SK-TRUST-003` confidence floors) · [`docs/research-receipts.md §8`](../../research-receipts.md) (dbt 2026 semantic-layer accuracy)

## Touchpoints — read this feature before editing

- `tools/eval/` — benchmark runner (slices 1 + 2 + 3a + 3b + 3c shipped):
  - `src/runner.ts` — multi-dataset driver, CLI, lane loop, baseline + emit; `withExecRetry`-wraps scaffolded lanes; `--throttle-ms` (`SK-QUAL-012`), `--capacity-wait-ms` + budget-stop (`SK-QUAL-013`); `--self-consistency N` / `--sc-temperature T` → `samplePlans`→`voteOverSamples`→score-the-winner (`SK-QUAL-017`)
  - `src/exec-retry.ts` — `withExecRetry` bounded retry on `exec_error` only (`SK-QUAL-009`)
  - `src/score.ts` — BIRD multiset/sequence-strict EX scorer + the Spider 2.0 multi-CSV port + `scoreOneSpider2` (`SK-QUAL-008`)
  - `src/csv.ts` — minimal RFC-4180 CSV parser + type inference for gold CSVs (`SK-QUAL-008`)
  - `src/lanes.ts` — `free` / `frontier` (`SK-QUAL-004`) / `agentic-frontier` (`RUN_AGENTIC_FRONTIER=1`) lane builders (`SK-QUAL-009`)
  - `src/baseline.ts` + `src/significance.ts` — baseline diff + McNemar exact-binomial / Edwards' χ² (`SK-QUAL-006`)
  - `src/emit.ts` — POST report to `/v1/events/eval`
  - `src/analyze-mismatches.ts` — mismatch error-class classifier (`SK-QUAL-014`); `src/column-coverage.ts` — column-prune recall-ceiling harness (`SK-QUAL-015`); `src/self-consistency.ts` — `majorityVote` + `voteOverSamples` orchestration + `score.ts::{fingerprintRows,executeRows}` (`SK-QUAL-017`)
  - `src/datasets/{bird-mini,spider2-lite,persona-bench}.ts` — HF BIRD loader; Spider 2.0-lite loader + gold-CSV hydration + external-knowledge injection (`SK-QUAL-007`/`008`/`016`); persona-bench ICP fixture + `loadPersonaBench` materialiser (`SK-QUAL-018`)
  - `src/output.ts` + `src/checkpoint.ts` — JSON report writer; resumable checkpoint (`SK-QUAL-011`)
  - `baseline-2026-06-15.json` — pinned canonical baseline (`SK-QUAL-005`)
- `.github/workflows/quality-eval-bird-mini.yml` — BIRD: manual `workflow_dispatch` only (`SK-QUAL-002`), `mode: full|smoke` (smoke = sampled + resumable per `SK-QUAL-011`); `include_agentic_frontier` → `RUN_AGENTIC_FRONTIER=1` per `SK-QUAL-009`; `self_consistency`/`sc_temperature` → smoke `--self-consistency N --sc-temperature T` per `SK-QUAL-017`
- `.github/workflows/quality-eval-spider2-lite.yml` — Spider: manual `workflow_dispatch` only (`SK-QUAL-002`), `mode: full|smoke`; `SK-QUAL-007` loader + `SK-QUAL-009` agentic toggle + `SK-QUAL-017` `self_consistency` smoke input
- `.github/workflows/quality-eval-persona-bench.yml` — persona-bench (ICP): manual `workflow_dispatch` (`persona: all|P1|P2` + `include_frontier`); no fixture download, no baseline/emit, so not blocked by the < 7-day gate (`SK-QUAL-018`)
- `apps/api/src/events-feature.ts::recordEvalReport` — bearer-token run ingestion
- `apps/api/src/index.ts` — `POST /v1/events/eval` route wiring
- `packages/events/src/types.ts` — `FeatureEvalWeeklyEvent`, `FeatureEvalRegressionEvent`
- `apps/events-worker/src/sinks/logsnag.ts` — `#north-star` channel mappings
- `packages/llm/src/router.ts` — the system under test (calls `plan()` with `dialect: "sqlite"`)
- `packages/llm/src/types.ts` — `PlanRequest.dialect` was widened to `"postgres" | "sqlite"` for SK-QUAL-001
- `apps/api/src/ask/sql-validate.ts` — schema-fit checks the harness exercises
- The Postgres / ClickHouse adapter test fixtures — repurposed as eval fixtures

## Decisions

### SK-QUAL-001 — Benchmark canon: BIRD (real-world) + Spider 2.0 (multi-dialect); accuracy reported by tier

**Body:** [`decisions/SK-QUAL-001-benchmark-canon.md`](./decisions/SK-QUAL-001-benchmark-canon.md).
Two open benchmarks — BIRD Mini-Dev (500 SQLite questions, messy
real-world schemas) and Spider 2.0-lite (SQLite subset only; the full-set
BQ/Snowflake transpilation was rejected as a confound). Accuracy reports
per router tier, never as one averaged number; results stay comparable
to published research. The harness is a tool, not a CI gate
(`SK-QUAL-002`).

### SK-QUAL-003 — Three-dataset canon: BIRD-dev + Spider 2.0-lite (SQLite subset) + internal `db.create` eval (the third dataset is the one that matters most)

**Body:** [`decisions/SK-QUAL-003-three-dataset-canon.md`](./decisions/SK-QUAL-003-three-dataset-canon.md).
Three datasets in weighted order: (1) internal `db.create` accepted-answer
eval (production-shape, internal-wins on disagreement); (2) BIRD-dev Mini-Dev
(500 SQLite — public, comparable; ~52.8% annotation errors per
[arXiv:2601.08778](https://arxiv.org/abs/2601.08778)); (3) Spider 2.0-lite
**SQLite subset only** — upstream ships 547 rows (135 `local###` SQLite;
zero Postgres). All 135 score via the canonical multi-CSV evaluator per
[`SK-QUAL-008`](#sk-qual-008); the loader pins to GitHub raw (HF mirror was
stale 2026-05-19).

### SK-QUAL-004 — Free-vs-agentic-frontier delta is the headline KPI; single-model frontier reports informationally

**Body:** [`decisions/SK-QUAL-004-free-vs-frontier-delta.md`](./decisions/SK-QUAL-004-free-vs-frontier-delta.md).
Three lanes per [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md):
**free**, **single-model frontier** (informational, ~73% canonical
BIRD-dev), **agentic-frontier** (~77-82% canonical SOTA). Headline KPI is
the **free-vs-agentic-frontier delta** — Phase 2 ≤ 25 pp, Phase 3 ≤ 16 pp
per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md). Slice 1 + 2
shipped free + single-model-frontier; agentic lane lands in slice 3c with
`SK-LLM-017`.

### SK-QUAL-005 — Baseline by 2026-06-15; Phase 2 floor enforced from first measurement

- **Decision:** Every engine-quality KPI in the [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) table must have a recorded baseline by **2026-06-15** (met — canonical snapshot `tools/eval/baseline-2026-06-15.json`, diffed by every manual run). The Phase 2 floor (BIRD-dev EM ≥ 72% free / ≥ 88% frontier; delta ≤ 22 pts) is enforced from that point; a below-floor first measurement ships engine work until cleared, never regresses it. PRs touching `packages/llm/**` name the KPI they move.
- **Core value:** Bullet-proof
- **Why:** A floor is meaningless without a baseline date; missing it blocks the Phase 2 rollover per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) by design.
- **Alternatives rejected:** No date ("soon" never happens); floor = first measurement (ratchets bad numbers into the norm).

### SK-QUAL-002 — Eval cadence: manual on-demand only; never a PR gate

**Body:** [`decisions/SK-QUAL-002-weekly-cron.md`](./decisions/SK-QUAL-002-weekly-cron.md).
Manual `workflow_dispatch` only, never per-PR/per-merge and never on a
schedule. A `mode` input picks **full** (500 BIRD / 135 Spider, diffs the
baseline + emits `feature.eval.weekly` / `feature.eval.regression`, EA
delta ≤ -5 pp **or** McNemar p < 0.05, `SK-QUAL-006`) or **smoke**
(sampled slice, no emit, resumable per `SK-QUAL-011`). Gating *decisions*
not *merges* keeps the harness a measurement tool; on-demand (not
scheduled) keeps the shared 1M/day free-tier cap available to live
traffic. Accepted trade-off: drift is unmeasured until an operator runs
it. Resilience via [`SK-QUAL-011`](#sk-qual-011).

### SK-QUAL-011 — Resumable runner: checkpoint + budget-stop so a run survives a free-tier daily token cap

**Body:** [`decisions/SK-QUAL-011-resumable-runner.md`](./decisions/SK-QUAL-011-resumable-runner.md).
`tools/eval/src/checkpoint.ts` writes one JSONL line per scored
`(question_id, lane)` pair; `runEval` skips done pairs and appends as it
goes (deterministic `--sample-seed` order). When the whole chain is
rate-limited (`AllProvidersFailedError` all-`rate_limited`, the
[`SK-LLM-030`](../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)
contract) the run **budget-stops**: keeps the checkpoint, marks the report
`resumable: true`, doesn't emit, exits 0 — a daily-cap hit reads as a
pause, not a wall of `no_sql`. The operator re-dispatches once the cap
resets (smoke checkpoint persists via `actions/cache`).

### SK-QUAL-006 — McNemar's paired-binary test as a parallel regression trigger

**Body:** [`decisions/SK-QUAL-006-mcnemar-paired-test.md`](./decisions/SK-QUAL-006-mcnemar-paired-test.md).
Per-lane regression alerts fire on two parallel triggers: (1) the
`SK-QUAL-002` 5-pp threshold on EA delta, and (2) McNemar's paired-binary
test (α = 0.05) on per-question outcomes. Both trigger independently;
each emits its own `feature.eval.regression`. McNemar catches small-but-real
regressions the threshold misses at N ≈ 500.

### SK-QUAL-007 — Spider 2.0-lite SQLite-subset loader (slice 3a) — superseded by `SK-QUAL-008` for the scoring contract

**Body:** [`decisions/SK-QUAL-007-spider2-lite-loader.md`](./decisions/SK-QUAL-007-spider2-lite-loader.md).
**Status:** scoring contract superseded by [`SK-QUAL-008`](#sk-qual-008); the
file-layout / `local###` filter / path-traversal contracts still apply.

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
cached `spider2_data/` for off-disk CI resolution.

### SK-QUAL-009 — Agentic exec-retry scaffold + `agentic-frontier` lane (slice 3c)

**Body:** [`decisions/SK-QUAL-009-exec-retry-agentic-lane.md`](./decisions/SK-QUAL-009-exec-retry-agentic-lane.md).
New `tools/eval/src/exec-retry.ts::withExecRetry` wraps `plan() → score()`
in a bounded loop (`maxAttempts: 3`, exec-error-only, threads
`PlanRequest.previousAttempt`). Two lanes scaffold (`free` +
`agentic-frontier`); single-model `frontier` stays the unscaffolded ablation
reference. New headline KPI `free_vs_agentic_frontier_delta` lands on
`EvalReport` + `FeatureEvalWeeklyEvent` + the LogSnag card per `GLOBAL-025`.

### SK-QUAL-010 — BIRD scorer compares positional value tuples (column names ignored), matching canonical `evaluation.py`

**Body:** [`decisions/SK-QUAL-010-bird-positional-tuple-parity.md`](./decisions/SK-QUAL-010-bird-positional-tuple-parity.md).
`scoreOne` + the Spider `rowsToColumnMajor` transpose read positional tuples
(`.values()`) not name-keyed objects (`.all()`), so output aliases / casing
no longer enter the comparison — matching canonical BIRD `set(fetchall())`.
Multiset + ORDER-BY strictness (`SK-QUAL-008`) retained (conservative lower
bound); first post-fix cron re-seeds the baseline (`SK-QUAL-005`).

### SK-QUAL-012 — Inter-question throttle so a low-RPM free chain measures reasoning, not availability

**Body:** [`decisions/SK-QUAL-012-throttle-paced-measurement.md`](./decisions/SK-QUAL-012-throttle-paced-measurement.md).
Optional `--throttle-ms` (`RunOptions.throttleMs`, default 0 ⇒ unchanged)
sleeps between questions so the ~5-RPM Cerebras head (`SK-LLM-023`) doesn't
cascade every breaker open into a `no_sql` wall. Measurement-harness knob
only — production is untouched. Complements the `SK-QUAL-011` budget-stop.

### SK-QUAL-013 — Capacity-honest budget stop: a rate-limit breaker wall pauses the run, never scores `no_sql`

**Body:** [`decisions/SK-QUAL-013-capacity-honest-budget-stop.md`](./decisions/SK-QUAL-013-capacity-honest-budget-stop.md).
Budget-stop fires on **capacity exhaustion** (every attempt `rate_limited`
**or** `circuit_open` — a 429 opens the breaker for its `Retry-After`
window, so the wall after the first 429 reads `circuit_open`), after one
bounded `--capacity-wait-ms` wait-and-retry (workflows: 65 s; default 0).
Full-mode workflows cache the checkpoint by commit SHA so a re-dispatch
resumes. Fixes the 2026-06-11 500-q run scoring 246 breaker-wall rows as
`no_sql` without a single LLM call.

### SK-QUAL-014 — Offline mismatch error-class classifier: bucket a run's loss mass so the §4 backlog is picked from evidence

**Body:** [`decisions/SK-QUAL-014-mismatch-error-class-classifier.md`](./decisions/SK-QUAL-014-mismatch-error-class-classifier.md).
Pure `classifyMismatch(predicted, gold)` + `histogram()` + a
`bun analyze-mismatches <baseline.json> <gold.json>` CLI tag the structural
diffs of every `mismatch` row in a saved `EvalReport` (DISTINCT/GROUP-BY/HAVING
grain, table & column counts, aggregate-fn set, subquery shape, …). Read-only
over the committed baseline — no keys, no quota, no chain change. Run against
BIRD 2026-06-12 it corrected the working assumption: with quote-aware table
parsing `fewer_tables` collapses 105 → 35, and aggregation/DISTINCT grain +
value-grounding (§4 #2), not schema-link recall, is the dominant loss mass.

### SK-QUAL-015 — Offline column-coverage harness: measure the recall ceiling of goal-token column pruning before building it

**Body:** [`decisions/SK-QUAL-015-column-coverage-harness.md`](./decisions/SK-QUAL-015-column-coverage-harness.md).
Pure `coverage(gold)` + `bun column-coverage <gold.json>` measure what fraction
of qualified gold columns share a `wordTokens` token (the pruner's tokenizer)
with the goal — the recall ceiling of the §4 #2 column-pruning sub-lever.
BIRD-dev 2026-06: **59.8%** covered, **+27.4%** key-like (→ ~87%), **12.8%**
value/measure. Read-only, no keys/quota/chain change.

### SK-QUAL-016 — Inject Spider 2.0-lite external-knowledge docs into the prompt, the way BIRD `evidence` already is

**Body:** [`decisions/SK-QUAL-016-spider-external-knowledge.md`](./decisions/SK-QUAL-016-spider-external-knowledge.md).
`loadSpider2Lite` rides each instance's `external_knowledge` doc through
`EvalQuestion.evidence` into `enrichedGoal` — the channel BIRD always used,
closing the `SK-QUAL-007` deferral. **13 of 135 `local###` (9.6%)** carried a
dropped doc — the knowledge-gated tail. Cache-authoritative, fail-soft,
traversal-gated. EX delta next Spider dispatch.

### SK-QUAL-017 — Self-consistency majority vote: cluster N sampled plans by the result set, vote the answer

**Body:** [`decisions/SK-QUAL-017-self-consistency-majority-vote.md`](./decisions/SK-QUAL-017-self-consistency-majority-vote.md).
`majorityVote` clusters N executed plans by their **result set** (the answer, not
the SQL string), returning the modal cluster's SQL — the §4 #3 reasoning lever.
**Now end-to-end:** sampling at temperature > 0 + the vote + the
`--self-consistency N` / `--sc-temperature T` runner branch (separate from
`withExecRetry`) + the `self_consistency`/`sc_temperature` smoke inputs, all
baseline-safe (N=1 default = greedy, `SK-LLM-024` byte-identical). EX delta is the
greedy-vs-SC gap on the first N≥2 dispatch.

### SK-QUAL-018 — persona-bench: nlqdb's own ICP-shaped NL→SQL benchmark, gold-executable fixture first

**Body:** [`decisions/SK-QUAL-018-persona-bench.md`](./decisions/SK-QUAL-018-persona-bench.md).
The third quality number `GLOBAL-027` §Lifecycle kept: NL→gold-SQL over the
schemas `personas.md` builds. v0 (`persona-bench.ts`) ships
the **data half** — `saas_app` (§P1) + `agent_memory` (§P2), now **23 questions**
(batch 2: anti-join/negation + multi-join; batch 3: scalar-subquery,
COUNT(DISTINCT), and the **multi-predicate-retention** filter shape a 2026-06-23
run flagged as an engine miss — q13 dropped a `status = 'paid'` predicate) with
time-stable literal-date gold + the **gold-executability invariant** (23/23
execute, non-empty). The **runner-wiring half** then makes it a dispatchable
`EvalDataset` — `loadPersonaBench` materialises each schema to SQLite on demand
(`--dataset persona-bench [--persona P1|P2]`), additive new-branch (BIRD/Spider
untouched). The **dispatch half** (`quality-eval-persona-bench.yml`) is now live,
baseline-safe (no fixture/baseline/emit) so ungated by `SK-QUAL-002`'s < 7-day
rule; free-chain EX + ICP free-vs-frontier delta land on the first dispatch.
Growth toward the 50–100-question target continues per run.

### SK-QUAL-019 — persona-bench ranked golds must be tie-free (no false-negative under sequence-strict scoring)

**Body:** [`decisions/SK-QUAL-019-tie-free-ranked-golds.md`](./decisions/SK-QUAL-019-tie-free-ranked-golds.md).
`score.ts` is sequence-strict whenever the gold has `ORDER BY`, so an unbroken
rank-key tie false-mismatches a correct prediction that orders the tie
differently. q8 ("5 most-recalled facts") tied two facts at `recall_count = 2`
and was a **stable** llama-leg false-miss (2/2 local runs); the `recalls` seed now
gives distinct counts (4/3/2/1) so q8's gold == the prediction deterministically
(stable match, 2/2 post-fix), the recalled-fact set is unchanged so `q18` /
"never recalled" hold, and a unit test asserts every `ORDER BY` gold has a
duplicate-free rank key (audit: q8 was the only tie-fragile one of q0/q8/q13/q18).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/).

- **GLOBAL-013** — $0/month free tier. *The harness uses the same strict-$0 chain users hit; exceeding it on eval hides cost users will hit too.*
- **GLOBAL-014** — OTel span on every external call. *Per-question spans so failures debug like production.*
- **GLOBAL-024** — Demand-signal telemetry. *Eval results emit `feature.eval.*` events.*
- **GLOBAL-025** — North-star KPIs. *This feature owns the engine-quality NL→SQL KPIs (BIRD/Spider EX, free-vs-frontier delta) + persona-bench (`SK-QUAL-018`); baseline per `SK-QUAL-005`.*
- **GLOBAL-026** — LLM strategy. *Eval runs the free + hosted-premium chains (`SK-QUAL-004`); BYOLLM lane instrumented but never gates a floor.*
- **GLOBAL-027** — Pre-alpha gate consumes this feature's free-chain BIRD/Spider numbers. *The report shape is the contract `apps/api/src/gate/eval-baseline.ts` mirrors. Lifecycle: [`pre-alpha-gate/FEATURE.md`](../pre-alpha-gate/FEATURE.md).*

## Open questions / known unknowns

- **Privacy** — Decided: no user data ever enters the harness; public benchmark + hand-authored persona-bench data only.
- **Deferred:** a `feature.eval.smoke` event; a hard token-budget counter (`SK-QUAL-011`/`012` cover it reactively).
- **Still open** (agentic lane shipped, [`SK-QUAL-009`](#sk-qual-009)): multi-model frontier until the Sonnet 4.6 baseline lands; BYOLLM lane depends on `SK-LLM-016`; pin a `xlang-ai/Spider2` SHA next Spider baseline.
- **Canonical raw EX — BIRD 0.520 (2026-06-19, flat) / Spider 0.1852 (2026-06-17)**, 6-provider GHA runs (`SK-QUAL-013`). Breakdown: `quality-score-source-of-truth.md` §2.
- **Value retrieval (§4 #2a) demoted + prod-side privacy-gated (2026-06-19).**
  `SK-QUAL-014`: `literal_only` = 0 ⇒ value-sampling flips ~0 mismatches
  standalone, below the reasoning levers. The **prod** build needs a **founder
  decision** — it would feed **user cell-values** to the free chain (today only
  DDL leaves the system); do not build until ruled on.
- **Corrected-set evaluation — parked until the next BIRD refresh** (`GLOBAL-033`). UIUC Kang ([arXiv:2601.08778](https://arxiv.org/abs/2601.08778)) found 52.8% BIRD annotation errors. **Adopt iff** license permits bundling **and** it's a ~50-LOC scorer-reuse patch; else skip.
