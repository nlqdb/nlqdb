# SK-QUAL-014 — Offline mismatch classifier: bucket `mismatch` rows by structural divergence, no DB / no LLM

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-010`](./SK-QUAL-010-bird-positional-tuple-parity.md) (the scorer that
decides `match` vs `mismatch` — this classifier explains the `mismatch` half),
[`SK-QUAL-013`](./SK-QUAL-013-capacity-honest-budget-stop.md) (keeps the run's
`no_sql` honest; this keeps the `mismatch` bucket legible).

- **Decision:** `tools/eval/src/mismatch-classify.ts` buckets a finished
  report's `mismatch` rows by the **structural axis** on which the predicted
  SQL diverges from the gold SQL — `table_set` (different base-table set /
  join path), `agg_fn`, `distinct`, `group_by`, `order_limit`, `subquery`,
  and a mutually-exclusive `value_diff` fallback that fires only when every
  structural axis agrees (a literal / predicate / projection error). It is a
  **pure text/structure diff**: no SQLite DB, no LLM, no quota. It reads the
  shapes the runner already records (`results[].outcome` / `predicted_sql` /
  `question_id` + a gold-SQL map), so it runs on any baseline/report JSON
  without a re-dispatch. `bun run --filter @nlqdb/eval classify-mismatches`.

- **Core value:** Legible

- **Why:**
  - **A lever needs a class to move.** §4 of
    [`quality-score-source-of-truth.md`](../../../progress/quality-score-source-of-truth.md)
    ranks the backlog by expected pp, but until now "where the losses are"
    read only as "almost purely SQL reasoning (mismatches)" — no
    distribution. The first ad-hoc cut put `table_set` at 57% of mismatches;
    a quoted-identifier (`"transactions_1k"`) parsing bug inflated it. The
    fix (quote/backtick/bracket-aware table extraction, pinned by tests)
    corrects it to **table_set 72 / value_diff 62 / agg_fn 61 / subquery 54
    / distinct 48 / order_limit 23 / group_by 20** over the 236 BIRD-dev
    mismatches — broad, no single class > ~31%, which validates the
    broad-spectrum §4 levers (retrieved few-shot, value retrieval) over
    another narrow directive (D5). A date-format trap, plausible from
    spot-checks, measured small (2 separator diffs / 9 `substr`) — not a
    lever.
  - **Attribution per run, not per autopsy.** Re-running the classifier on
    each fresh report shows *which* class a shipped lever moved, so the
    same-seed A/B in the daily loop reports a class delta, not just an EX
    delta.

- **Consequence in code:** new `tools/eval/src/mismatch-classify.ts`
  (`classifyMismatch` / `classifyReport` pure fns + `import.meta.main` CLI),
  `tools/eval/test/mismatch-classify.test.ts`, and a `classify-mismatches`
  package script. No runtime/router change; no effect on scoring or the gate.

- **Alternatives rejected:**
  - **Execution-grounded error analysis (run gold + predicted, diff result
    sets).** More precise but needs the binary SQLite DBs and re-execution —
    against this tool's offline/no-quota point, and the runner already scored
    the rows. The structural diff is a deliberately cheap, heuristic first
    cut; it is the *means to rank levers*, not a scorer.
  - **A full SQL parser/AST.** Over-built for a seven-axis histogram (P5);
    the regex axes are pinned by tests and the quoting bug they caught is the
    only sharp edge.
  - **Leave it as a one-off script.** The number is needed every run to
    attribute levers; a committed, tested tool keeps it reproducible.
