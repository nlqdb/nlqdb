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
| `src/datasets/**`, the BIRD loader, gold-SQL fields | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-003`) |
| `src/score.ts`, the EX (execution-accuracy) scorer | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-001`) |
| `src/lanes.ts`, dispatch-lane selection | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-004`) + `docs/features/llm-router/decisions/SK-LLM-017-hosted-premium-chain.md` |
| `src/runner.ts`, the runner, CI workflow | `docs/features/quality-eval/FEATURE.md` (`SK-QUAL-002`, `SK-QUAL-005`) |

## Layout

```
tools/eval/
├── src/
│   ├── runner.ts          # main entry (`bun run --filter tools/eval bird-mini`)
│   ├── score.ts           # execution-accuracy (multiset compare, gold/exec error)
│   ├── lanes.ts           # free / frontier router builders
│   ├── output.ts          # JSON report writer
│   ├── types.ts           # canonical types — BirdQuestion, EvalReport, etc.
│   └── datasets/bird-mini.ts  # birdsql/bird_mini_dev loader (HF + on-disk)
├── test/                  # bun test unit tests (no real LLM, no network)
└── results/               # report JSON output (gitignored except .keep)
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
```

## Conventions

- **No real LLM in PR CI.** Unit tests stub the router; the daily
  workflow `.github/workflows/quality-eval-bird-mini.yml` is the only
  place real provider keys run.
- **EX (execution match) only.** Exact-match is gameable (BIRD's
  rationale + 2024 leaderboard collapse). When ORDER BY is present in
  gold SQL, comparison is sequence-strict; otherwise multiset.
- **Errors capped to 240 chars.** GLOBAL-012 — one-sentence errors.
  Result JSON stays small.
- **`predicted_sql` capped to 4 KB** in the report so a runaway model
  response can't blow up the file.
- **`dialect: "sqlite"`** is the only place this literal flows.
  Production `apps/api` callers still pass `"postgres"`. Widen carefully.
