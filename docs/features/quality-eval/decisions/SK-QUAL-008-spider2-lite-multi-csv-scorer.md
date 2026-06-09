# SK-QUAL-008 — Spider 2.0-lite multi-CSV scorer (slice 3b) ports the canonical pandas comparator to TypeScript

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-003`](../FEATURE.md#sk-qual-003) (three-dataset canon),
[`SK-QUAL-007`](./SK-QUAL-007-spider2-lite-loader.md) (slice 3a — loader
shipping the 24-of-135 gold-SQL path).

- **Decision:** Slice 3b lifts the remaining 111 of 135 `local###` rows
  from `gold_error` to scoreable by porting the canonical Spider 2.0
  evaluator (`spider2-lite/evaluation_suite/evaluate_utils.py`) —
  `compare_pandas_table` + `compare_multi_pandas_table` — to TypeScript
  in `tools/eval/src/score.ts` (`comparePandasTable`,
  `compareMultiPandasTable`, `scoreOneSpider2`). The loader at
  `tools/eval/src/datasets/spider2-lite.ts` now fetches the per-instance
  gold CSV(s) from
  `evaluation_suite/gold/exec_result/<instance_id>(_[a-z])?.csv` and the
  per-instance `condition_cols` / `ignore_order` metadata from
  `evaluation_suite/gold/spider2lite_eval.jsonl`. All 135 SQLite rows
  score through one path — the slice-3a gold-SQL hydration is removed
  because canonical Spider 2.0 scoring is multi-CSV-only. A new CSV
  parser at `tools/eval/src/csv.ts` handles pandas-emitted RFC-4180-ish
  CSVs (header, doubled-quote escapes, quoted multi-line fields,
  optional BOM) with per-column numeric inference (`Number.isFinite`
  over every non-empty cell → numeric; otherwise string). The workflow
  `quality-eval-spider2-lite.yml` sparse-clones
  `spider2-lite/evaluation_suite/gold/` from upstream (one
  `git clone --depth 1 --filter=blob:none --sparse` plus
  `sparse-checkout set`, ~2 MB on disk) into the existing
  `spider2_data/` cache so the loader can resolve every gold CSV
  off-disk in CI.
- **Core value:** Bullet-proof, Honest latency, Simple
- **Why:**
  - **Pure-TS port (vs subprocess to upstream `evaluate.py`).** The
    harness already runs on Bun; introducing pandas as a CI dependency
    would force a Python install on every eval run, double the
    runtime ($BUN$ start vs $PY+PANDAS$ start), and split the
    comparator across two languages where the BIRD scorer is
    TS-native. A faithful port keeps the harness single-runtime and
    auditable; two invariants protect the port from drifting:
    `abs_tol = 1e-2` constant equal to upstream's `math.isclose`
    default, and an `ignore_order` sort key of
    `(x is None, str(x), is-numeric)` byte-for-byte matching Python's
    `(x is None, str(x), isinstance(x, (int, float)))`. Tests pin both
    against representative gold/pred pairs.
  - **Canonical multi-CSV path for all 135 rows (vs keeping the
    slice-3a gold-SQL path for the 24).** Two scoring paths within one
    dataset is twice the maintenance and would let the 24-row subset
    diverge from the upstream Spider 2.0 leaderboard. Upstream scores
    every `local###` row through the multi-CSV evaluator regardless of
    whether a gold SQL exists; we match. The slice-3a baseline never
    landed (no Spider row in `baseline-2026-06-15.json`), so no
    regression-detector noise from the switch.
  - **Cache-authoritative on-disk fixture (vs network fallback per
    instance).** With ~300 gold CSV files × 135 instances, falling back
    to GitHub raw on a cache miss would mean ~300 HTTP round-trips on
    every cron run. A sparse-clone of `evaluation_suite/gold/` costs
    one HTTP (the clone) and gives O(1) disk reads thereafter. The
    loader treats the cache dir as authoritative: instances missing
    from `<cache>/exec_result/` surface as `gold_error` rather than
    silently fanning out to upstream mid-cron and confusing the
    failure mode.
  - **Pinned `xlang-ai/Spider2@main` (vs a vendored snapshot).** Upstream
    activity on the lite eval JSONL has been near-zero for months; a
    weekly clone catches any clarification without us re-vendoring.
    `SK-QUAL-005` will pin a commit SHA the first time we mint a
    Spider baseline so future leaderboard churn can't move our number
    silently — same posture as BIRD's HF revision pin in slice 2.
- **Consequence in code:**
  - `tools/eval/src/csv.ts` ships the parser + `csvToGoldTable`
    column-major converter. ~80 LOC; tests cover BOM, CRLF, quoted
    fields with commas/newlines, doubled-quote escapes, mixed-type
    column → string fallback, all-numeric column → numeric, empty
    cells → null.
  - `tools/eval/src/score.ts` adds `comparePandasTable`,
    `compareMultiPandasTable`, `normaliseConditionCols`, and
    `scoreOneSpider2`. The `normaliseConditionCols` mirror covers all
    three `compare_multi_pandas_table` edge cases: empty list,
    `[[]]`, and `null`/undefined all degrade to "no restriction"; a
    flat `number[]` broadcasts across multi-gold; a `number[][]`
    passes through verbatim.
  - `tools/eval/src/datasets/spider2-lite.ts` drops gold-SQL
    hydration; `loadGoldCsvs` is cache-first with a network-probe
    fallback (`<id>.csv` → `<id>_a..z.csv` to the first 404, matching
    `resolve_gold_paths`); `loadEvalIndex` reads the metadata JSONL.
    `EvalQuestion.spider2` is populated only when at least one gold
    CSV is found — half-loaded scoring contracts never reach the
    runner.
  - `tools/eval/src/runner.ts::runOneQuestion` routes by payload:
    `question.spider2 ? scoreOneSpider2 : scoreOne` (gold-SQL EX
    path). The short-circuit "no gold of any kind" condition is
    unified: `sql.trim() === "" && !hasSpider2Gold` returns
    `gold_error` before the LLM call.
  - `tools/eval/src/types.ts` adds `Spider2EvalPayload`
    (`gold_tables`, `condition_cols`, `ignore_order`) as an optional
    field on `EvalQuestion`.
  - `.github/workflows/quality-eval-spider2-lite.yml` adds the
    sparse-clone step (replaces the slice-3a in-loader fetch),
    increments the cache key to `spider2-lite-v2-*`, and refreshes the
    step-summary note to reflect "all 135 rows scoreable".
- **Alternatives rejected:**
  - **Subprocess to `evaluate.py`.** Splits the harness across two
    runtimes, adds a pandas dependency to the eval run, and
    doubles CI startup time without buying anything the TS port can't
    match (tests pin the two invariants that matter — tolerance + sort
    key).
  - **Hybrid: TS in the hot path, Python verification step.**
    Considered. Would catch drift, but ~2× implementation cost for
    slice 1 of the path. Revisit if the port produces a number that
    diverges from the upstream leaderboard by more than the noise
    floor.
  - **Keep the 24-row gold-SQL path alongside the 111-row
    multi-CSV.** Two scoring paths within one dataset; the 24's
    numbers would never compare cleanly to the upstream Spider 2.0
    leaderboard. Slice 3a was provisional; slice 3b normalises.
  - **Network-only loader (no on-disk cache as authoritative source).**
    300 HTTP round-trips on every eval run; flaky upstream =
    flaky scoring. Sparse-clone gives O(1) disk reads.
  - **Pull the whole upstream repo (`xlang-ai/Spider2` is ~50 MB).**
    Wastes bandwidth on assets we don't need; sparse-checkout
    restricts the working tree to `spider2-lite/` (~2 MB on disk).
  - **Add a `csv-parse` / `papaparse` dependency.** Gold CSVs are
    pandas-emitted and stick to a narrow dialect; a vetted 80-LOC
    hand-rolled parser is easier to audit than a 500 KB+ dep,
    consistent with P5 "simplify rather than complexify".
