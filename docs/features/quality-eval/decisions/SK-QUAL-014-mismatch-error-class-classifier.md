# SK-QUAL-014 — Offline mismatch error-class classifier: bucket a run's loss mass so the §4 backlog is picked from evidence

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Reads the report
[`SK-QUAL-001`](./SK-QUAL-001-benchmark-canon.md) writes; feeds the §4 backlog
in [`quality-score-source-of-truth.md`](../../../progress/quality-score-source-of-truth.md).

- **Decision:** `tools/eval/src/analyze-mismatches.ts` exports a pure
  `classifyMismatch(predicted, gold) → string[]` that tags the **structural**
  differences between a predicted and gold SQL (DISTINCT grain, GROUP
  BY/HAVING, table count, projection width, aggregate-fn set, ORDER BY/LIMIT,
  CAST, NULL-guard, subquery count; `other_predicate_or_value` when none
  differ). `histogram(results, gold)` joins a baseline `EvalReport` to the
  BIRD gold JSON on `question_id` and tallies the `mismatch` rows; a
  `bun analyze-mismatches <baseline.json> <gold.json>` CLI prints it. Tags
  are **non-exclusive** and **surface-only** — a tag is a lead to read, not a
  proven semantic error.

- **Core value:** Legible

- **Why:**
  - **The report counted mismatches but never characterised them.** A
    canonical run records 236/500 BIRD `mismatch` rows (2026-06-12) with no
    breakdown, so §4's lever ranking was inference, not measurement. The
    classifier turns "mismatch 236" into a per-class histogram a reviewer can
    act on, and re-runs on every future baseline (deterministic, no keys, no
    quota — the only network is fetching the gold JSON the CLI is handed).
  - **A naive parser lies in the same direction the levers chase.** The first
    cut used a bare-word `from\s+(\w+)` table regex and reported
    `fewer_tables` as the dominant class (105/236), pointing at schema-link
    recall (T19/T21). Predicted SQL quotes identifiers (`FROM
    "transactions_1k"`), so the regex undercounted tables: with quote-aware
    parsing `fewer_tables` collapses **105 → 35** and the real mass is
    aggregation/DISTINCT grain + subquery shape. Shipping the wrong parser
    would have mis-aimed the next several runs — the quote-handling test is
    the regression guard.
  - **The literal axis turns the value-grounding hypothesis into a number —
    and re-ranks it.** The structural tags never inspect string-literal
    *values*, so a wrong/mis-cased constant fell into `other_predicate_or_value`
    undifferentiated. The classifier now compares the case-preserved literal
    multisets directly (`literal_diff`, `literal_case_only`) and exports
    `isLiteralOnly(pred, gold)` — true when masking string literals makes
    predicted ≡ gold, i.e. the structure is correct and *only* the constants
    differ, the one case value-retrieval could flip to a match unaided. Run on the
    2026-06-19 BIRD baseline (238 mismatches): `literal_diff` is the **largest**
    single tag (**90**), yet `literal_case_only` is **6** and `literal_only` is
    **0** — every literal error co-occurs with a structural one, so the §4 #2a
    value-retrieval lever recovers **~0 mismatches standalone**. That falsifies
    the "additive, do-first" framing the column-name ceiling (`SK-QUAL-015`)
    implied; the remaining loss is structural reasoning (grain/shape/predicate).
  - **The date sub-axis falsifies the §4 #2c date-normalisation directive the
    same way (2026-06-20).** `canonDate` (zero-pad date heads, strip one trailing
    LIKE `%`) + `isDateLiteralOnly` (date-canonical literal multisets match **and**
    masked structure identical) + the `date_literal_only` tag isolate the
    date-encoding slice of `literal_diff`. On the same 238-mismatch baseline:
    `date_literal_only` = **2** total, **0 standalone** — the run-18 "~16" eyeball
    over-counted, and every date diff co-occurs with a structural error (`LIKE
    '…%'` vs `= '…'` needs an operator change). A date `PLAN_DIRECTIVES` bullet
    flips ~0 rows ⇒ #2c parked, same verdict as #2a.

- **Consequence in code:** `tools/eval/src/analyze-mismatches.ts` (pure
  classifier + `literalsIn` / `isLiteralOnly` / `canonDate` / `isDateLiteralOnly`
  + `histogram` + `import.meta.main` CLI; the CLI prints the `literal_only` +
  `date_literal_only` headlines above the tally),
  `test/analyze-mismatches.test.ts` (quote-handling regression + structural +
  literal-axis class assertions, mocked, no network), and the
  `analyze-mismatches` script in `tools/eval/package.json`. Read-only over an
  existing report — no change to `runner.ts`, the scorer, or the chain, so no
  KPI can move; it is an instrument that *directs* the levers that do.

- **Alternatives rejected:**
  - **Fold the breakdown into `runner.ts` / the report JSON.** Couples a
    diagnostic to the hot measurement path and bloats every report; the diff
    is offline and re-runnable against any saved baseline.
  - **Execute predicted vs gold and diff result-sets instead of SQL text.**
    That is already what the EX scorer does to *decide* `mismatch`; the value
    here is explaining *why* without the DB fixture, on the committed
    baseline alone.
  - **A semantic SQL differ (parse to AST, prove inequivalence).** Heavy, and
    BIRD's gold-annotation noise means "structurally different" is the honest
    ceiling — over-claiming equivalence would itself mislead.
