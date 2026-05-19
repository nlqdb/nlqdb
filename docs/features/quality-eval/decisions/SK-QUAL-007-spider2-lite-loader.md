# SK-QUAL-007 — Spider 2.0-lite SQLite-subset loader scores only the 24-of-135 rows that ship gold SQL

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decision:
[`SK-QUAL-003`](../FEATURE.md#sk-qual-003) (three-dataset canon — BIRD-dev +
Spider 2.0-lite SQLite + internal `db.create` eval).

- **Decision:** The Spider 2.0-lite loader fetches the canonical
  `spider2-lite.jsonl` from the upstream GitHub repo
  (`xlang-ai/Spider2@main`, MIT-licensed, 547 rows), filters to the
  **135 SQLite-flavoured rows** by `instance_id` prefix `local###`, and
  hydrates per-instance gold SQL from
  `evaluation_suite/gold/sql/<instance_id>.sql`. Of the 135 rows, only
  **24** ship a gold SQL file — the upstream Spider 2.0 eval scores the
  remaining 111 via the **multi-CSV result-set path**
  (`evaluation_suite/gold/exec_result/<instance_id>_<a|b|...>.csv` plus
  the `condition_cols` / `ignore_order` metadata in
  `spider2lite_eval.jsonl`), which this slice **does not implement** —
  those rows emit `gold_error` (excluded from the EA denominator) and a
  follow-up slice 3b lands the CSV-result scorer. The loader's source of
  truth is the GitHub raw URL, **not the HuggingFace mirror** — the HF
  copy was stale at 260 rows as of 2026-05-19, missing 287 of the
  upstream's 547 entries (verified by direct download).
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** The HuggingFace mirror is a tempting "one fetch, one parse"
  source, but using stale data on a benchmark whose canonical row count
  appears in [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md)
  KPI table would silently inflate or deflate every reported number;
  fetching from GitHub raw costs one extra HTTP per gold-SQL row but
  costs zero accuracy. The 24-of-135 honest subset is also the right
  near-term shape: it lets us produce a real `spider_accuracy` value
  for the [`pre-alpha-gate`](../../pre-alpha-gate/FEATURE.md)
  baseline file ([`SK-GATE-001`](../../pre-alpha-gate/FEATURE.md#sk-gate-001))
  this week instead of waiting for the CSV-result scorer slice, while
  the 0.75 lane threshold demands ≥ 18 of 24 matches before the gate
  can lift — a defensible enough floor to publish without overfitting
  to a 24-row subset. **Cost-of-skipping** the 111 rows on the LLM
  budget: zero (we short-circuit before the `router.plan()` call), and
  they're visible as `gold_error` in the report so the operator can
  see exactly how much of the dataset is provisionally scored.
- **Consequence in code:**
  - `tools/eval/src/datasets/spider2-lite.ts` ships the loader: JSONL
    parse, `local###` filter, gold-SQL fetch (cache-first, then upstream
    raw URL), `resolveDbPath` over the canonical
    `resource/databases/spider2-localdb/<db>.sqlite` layout with a flat
    fallback for hand-curated CI caches.
  - `tools/eval/src/runner.ts::runOneQuestion` short-circuits questions
    with `sql.trim().length === 0` to `gold_error` *before* the LLM call
    so we don't burn free-tier quota on a row that can't be scored.
  - `tools/eval/src/types.ts` widens `EvalReport["dataset"]` to
    `"bird-mini-dev-sqlite" | "spider2-lite-sqlite"`; `QuestionResult`
    gains optional `instance_id` so Spider rows preserve the string key
    for baseline-pair joining (the report's `question_id` is the
    positional index into the filtered list).
  - The pinned upstream URL is the `main` branch tip; the next baseline
    snapshot ([`SK-QUAL-005`](../FEATURE.md#sk-qual-005)) records the
    commit SHA so leaderboard churn can't bump our numbers without a
    visible PR diff.
- **Alternatives rejected:**
  - **HuggingFace `xlangai/spider2-lite` as the source.** Stale at 260
    rows vs the upstream's 547 (verified 2026-05-19); using it would
    silently misreport on a benchmark named in
    [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md).
  - **Skip Spider 2.0-lite entirely until the CSV-result scorer lands.**
    Leaves [`SK-GATE-002`](../../pre-alpha-gate/FEATURE.md#sk-gate-002)'s
    `spider_accuracy` permanently null — the pre-alpha gate stays
    structurally closed forever, even when the BIRD lane clears. The
    24-row subset is the smallest honest-shippable scoring surface that
    unblocks the gate's exit condition.
  - **Treat the 111 missing-gold-SQL rows as `no_sql` instead of
    `gold_error`.** Both outcomes are non-match; `no_sql` is for "the
    router returned empty SQL" and using it for a dataset shape issue
    would conflate failure modes. `gold_error` is already the bucket
    excluded from the EA denominator and reserved for "the gold side
    of the question couldn't execute" — same semantic.
  - **Ship the CSV-result scorer in this PR.** Triples the slice scope
    (multi-CSV pandas-equivalent comparison + `condition_cols` +
    `ignore_order` plumbing) and would risk merging an incomplete eval
    that under-reports the gate's `spider_accuracy`; a follow-up slice
    3b PR is cleaner to review.
  - **Hand-write 111 gold SQL files for the missing rows.** Tempting
    but defeats the "comparable to published research" half of
    [`SK-QUAL-001`](../FEATURE.md#sk-qual-001) — our gold would no
    longer match the upstream's evaluation surface, and reported
    numbers wouldn't compare to the leaderboard. Multi-CSV is the
    canonical path.
