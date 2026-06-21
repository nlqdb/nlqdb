# Agents Guide — tools/eval

`tools/eval` is the NL→SQL quality-eval harness. Per
[`docs/features/quality-eval/FEATURE.md`](../../docs/features/quality-eval/FEATURE.md)
(`SK-QUAL-001..005`), it is the engine north-star instrument — its
output is the input to the Phase 2 exit gate in
[`docs/phase-plan.md §2`](../../docs/phase-plan.md). Read that feature
before editing anything here.

## Read first

Before editing under `tools/eval/`:

| If you touch… | Read first |
|---|---|
| `src/datasets/bird-mini.ts`, BIRD loader, gold-SQL fields | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-003`) |
| `src/datasets/spider2-lite.ts`, Spider 2.0-lite `local###` loader, gold-CSV fetch | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-003`, `SK-QUAL-007`, `SK-QUAL-008`) |
| `src/csv.ts`, pandas-CSV parser + column type inference (Spider 2.0 gold ingest) | `docs/features/quality-eval/decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md` |
| `src/score.ts`, the EX (BIRD) scorer **and** the Spider 2.0 multi-CSV comparator port | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-001`, `SK-QUAL-008`) |
| `src/lanes.ts`, dispatch-lane selection | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-004`) + `docs/features/llm-router/decisions/SK-LLM-017-hosted-premium-chain.md` |
| `src/runner.ts`, the runner, CI workflow | `docs/features/quality-eval/decisions/SK-QUAL-002-weekly-cron.md` + `FEATURE.md` (`SK-QUAL-005`, `SK-QUAL-011`) |
| `src/checkpoint.ts`, resumable-runner checkpoint, `--sample-seed`, budget-stop | `docs/features/quality-eval/decisions/SK-QUAL-011-resumable-runner.md` |
| `src/baseline.ts`, baseline comparison + regression detection | `docs/features/quality-eval/decisions/SK-QUAL-002-weekly-cron.md` + `decisions/SK-QUAL-006-mcnemar-paired-test.md` |
| `src/significance.ts`, McNemar's test | `docs/features/quality-eval/decisions/SK-QUAL-006-mcnemar-paired-test.md` |
| `src/analyze-mismatches.ts`, offline mismatch error-class classifier | `docs/features/quality-eval/decisions/SK-QUAL-014-mismatch-error-class-classifier.md` |
| `src/column-coverage.ts`, offline column-prune recall-ceiling harness | `docs/features/quality-eval/decisions/SK-QUAL-015-column-coverage-harness.md` |
| `src/self-consistency.ts`, self-consistency `majorityVote` + `voteOverSamples` orchestration + `fingerprintRows` / `executeRows` (in `score.ts`) | `docs/features/quality-eval/decisions/SK-QUAL-017-self-consistency-majority-vote.md` |
| `src/emit.ts`, POST /v1/events/eval | `docs/features/quality-eval/decisions/SK-QUAL-002-weekly-cron.md` + `docs/features/events-pipeline/FEATURE.md` |
| `baseline-2026-06-15.json` | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-005`) — pinned canonical baseline |

## Layout

```
tools/eval/
├── src/
│   ├── runner.ts          # main entry — accepts --baseline + --emit-url/--emit-token
│   ├── score.ts           # BIRD EX scorer + Spider 2.0 multi-CSV pandas-comparator port (SK-QUAL-008)
│   ├── csv.ts             # minimal RFC-4180 CSV parser + column type inference (SK-QUAL-008)
│   ├── lanes.ts           # free / frontier router builders
│   ├── baseline.ts        # read baseline JSON, per-lane diff, McNemar trigger
│   ├── significance.ts    # McNemar exact-binomial + Edwards' chi-squared
│   ├── emit.ts            # POST report to /v1/events/eval (typed event fanout)
│   ├── output.ts          # JSON report writer
│   ├── analyze-mismatches.ts # offline mismatch error-class classifier + CLI (SK-QUAL-014)
│   ├── column-coverage.ts # offline column-prune recall-ceiling harness + CLI (SK-QUAL-015)
│   ├── self-consistency.ts # offline self-consistency majority-vote core + CLI (SK-QUAL-017)
│   ├── types.ts           # canonical types — EvalQuestion, EvalReport, Spider2EvalPayload
│   └── datasets/
│       ├── bird-mini.ts      # birdsql/bird_mini_dev loader (HF + on-disk)
│       └── spider2-lite.ts   # xlang-ai/Spider2 SQLite-subset loader + gold-CSV / eval-JSONL hydration (local### prefix)
├── test/                  # bun test unit tests (no real LLM, no network)
├── results/               # report JSON output (gitignored except .keep)
└── baseline-2026-06-15.json  # pinned canonical baseline (SK-QUAL-005)
```

## Running locally

```bash
# Unit tests (~1 s, no network)
bun run --filter @nlqdb/eval test
bun run --filter @nlqdb/eval typecheck

# Real eval (requires GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY
# and a local BIRD Mini-Dev fixture cache):
bun run --filter @nlqdb/eval bird-mini -- \
  --data-dir ./bird_data \
  --limit 50 \
  --out tools/eval/results

# Adding the frontier lane:
OPENROUTER_FRONTIER_API_KEY=sk-... \
  bun run --filter @nlqdb/eval bird-mini -- --limit 50

# Baseline comparison + event emission (the full eval-run path):
bun run --filter @nlqdb/eval bird-mini -- \
  --data-dir ./bird_data \
  --limit 500 \
  --baseline tools/eval/baseline-2026-06-15.json \
  --emit-url https://app.nlqdb.com \
  --emit-token "$EVAL_INGEST_TOKEN"

# Spider 2.0-lite SQLite subset (all 135 `local###` questions score via
# the canonical multi-CSV comparator per SK-QUAL-008). Fixtures from
# upstream — SQLite DBs from Google Drive (see the README quickstart in
# https://github.com/xlang-ai/Spider2/tree/main/spider2-lite) and the
# gold tree via a sparse clone of `evaluation_suite/gold/` into the
# same `--data-dir` root.
bun run --filter @nlqdb/eval spider2-lite -- \
  --data-dir ./spider2_data \
  --out tools/eval/results
```

## Conventions

- **No real LLM in PR CI.** Unit tests stub the router; the weekly
  workflows `.github/workflows/quality-eval-{bird-mini,spider2-lite}.yml`
  are the only places real provider keys run.
- **EX (execution match) on BIRD; canonical multi-CSV column-comparator on Spider 2.0.**
  Exact-match is gameable (BIRD's rationale + 2024 leaderboard collapse).
  BIRD: when ORDER BY is present in gold SQL, comparison is sequence-strict;
  otherwise multiset. Spider 2.0 (`SK-QUAL-008`): predicted result-set's
  columns are matched against any of the per-instance gold CSV(s) using the
  same 1e-2 abs tolerance + `ignore_order` sort key that upstream's
  `compare_pandas_table` uses — don't drift these two invariants.
- **Errors capped to 240 chars.** GLOBAL-012 — one-sentence errors.
  Result JSON stays small.
- **`predicted_sql` capped to 4 KB** in the report so a runaway model
  response can't blow up the file.
- **`dialect: "sqlite"`** is the only place this literal flows.
  Production `apps/api` callers still pass `"postgres"`. Widen carefully.
