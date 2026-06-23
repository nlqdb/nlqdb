# SK-QUAL-010 — BIRD scorer compares positional value tuples (column names ignored), matching canonical `evaluation.py`

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-001`](../FEATURE.md#sk-qual-001) (benchmark canon — "results stay
comparable to published research"),
[`SK-QUAL-008`](./SK-QUAL-008-spider2-lite-multi-csv-scorer.md) (the parallel
Spider comparator this aligns the BIRD path with).

- **Decision:** The BIRD execution-accuracy scorer
  (`tools/eval/src/score.ts::scoreOne`) reads result rows as **positional
  value tuples** via bun:sqlite `.values()`, not name-keyed objects via
  `.all()`. Output column **names / aliases / function-name casing are
  ignored** in the comparison — only the positional values matter, which is
  exactly what canonical BIRD does (`set(cursor.fetchall())` over Python
  sqlite3 tuples). The Spider 2.0 column-major converter
  (`rowsToColumnMajor`) likewise reads `.values()` so two same-named
  predicted columns (e.g. `SELECT name, name`) survive as distinct columns
  instead of collapsing under one object key. We **retain** the multiset
  (duplicate-count-sensitive) comparison and the ORDER-BY-sensitive branch
  (`SK-QUAL-008`'s `hasOrderBy`) — both deliberately *stricter* than
  canonical BIRD's order-and-duplicate-blind `set()`, so our reported EX is
  a conservative lower bound on the canonical leaderboard number, never an
  inflated one.

- **Core value:** Bullet-proof, Honest latency

- **Why:**
  - **Canonical BIRD ignores column names.** The official
    `evaluation.py` is `set(cursor.fetchall()) == set(...)`; Python's
    sqlite3 `fetchall()` returns positional tuples, so the output column
    label never enters the comparison (verified against the upstream
    `AlibabaResearch/DAMO-ConvAI` BIRD `evaluation.py`, 2026-06). The
    pre-fix `.all()` path keyed each row by column name and folded the name
    into the row identity, so a correct answer whose alias or function-name
    casing differed from gold — `count(*) AS total` vs `COUNT(*)` — scored
    `mismatch`. That is a **measurement artifact**, not a model error, and
    it depresses the free-chain BIRD EX the
    [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md)
    engine-quality KPIs read. Removing it serves `SK-QUAL-001`'s comparability mandate
    directly.
  - **Positional comparison is strictly more correct, both directions.**
    It recovers false-mismatches (alias/case differences on identical
    values) **and** removes a false-match the name-keyed form allowed: a
    column *swap* (`SELECT species, id` vs `SELECT id, species`) used to
    pass because the sorted key-set matched, but the positional tuples
    differ — which is the canonical behaviour. Net direction on the
    headline number is up, because correct-answer alias divergence is far
    more common than coincidental swaps.
  - **Same root bug in the Spider transpose.** `rowsToColumnMajor` built
    column vectors from `Object.keys(rows[0])`; SQLite returns two
    identically-named columns, but a JS object holds one key, so the second
    column vanished and a gold column that needed it found no match →
    false `mismatch`. Reading `.values()` and transposing by position is
    the same fix and keeps the BIRD and Spider paths consistent (both
    "compare values, not labels").
  - **Why keep multiset + ORDER BY strictness (vs full `set()` parity).**
    Canonical BIRD's `set()` is order- and duplicate-blind — it counts a
    prediction correct even when the question asked for an ordering it
    didn't produce, a documented BIRD quirk. Adopting that would *raise*
    our number on answers that are arguably wrong. Staying stricter on
    those two axes makes our EX a defensible lower bound while the
    name-insensitivity (the unambiguous artifact) is fixed. The two
    behaviours are independent: column-name parity is a correctness fix,
    order/duplicate strictness is a conservatism choice.

- **Consequence in code:**
  - `tools/eval/src/score.ts`: `SqliteDatabase.query` gains `values()`;
    `scoreOne` reads gold + predicted via `.values()` (`unknown[][]`) and
    feeds them to the unchanged `rowsMatch` (multiset, ORDER-BY-aware via
    `hasOrderBy`); `canonicalize` now serialises positional tuples (its
    sorted-key object branch is retained only as a fallback);
    `rowsToColumnMajor` transposes positional rows for `scoreOneSpider2`.
  - `tools/eval/test/score.test.ts` pins the contract: aliased/cased
    identical values match; a swapped column order mismatches; the
    `rowsToColumnMajor` transpose keeps two same-named columns distinct.
  - **Baseline migration (operational).** `baseline-2026-06-15.json` was
    scored with the pre-fix name-keyed comparator, so the first post-fix
    run's per-question diff (`SK-QUAL-006` McNemar / `SK-QUAL-002` 5-pp
    threshold) conflates the scorer change with any model change and must
    be read as a one-time scorer migration, not a regression. That run's
    report re-seeds `baseline-2026-06-15.json` (`SK-QUAL-005`)
    under the corrected scorer; thereafter diffs are model-only again.

- **Alternatives rejected:**
  - **Keep name-keyed object comparison.** Diverges from canonical BIRD,
    depresses the gate-relevant number on a measurement artifact, and is
    not comparable to the published leaderboard — fails `SK-QUAL-001`.
  - **Adopt full canonical `set()` (order- and duplicate-blind).** Would
    credit answers that ignore a requested ordering or collapse intended
    duplicates; raises the number on arguably-wrong predictions. The
    conservative lower bound is the honest call while the gate is live.
  - **Normalise aliases in the SQL text before executing.** Brittle SQL
    rewriting that can't cover every alias/casing/function form; executing
    and comparing values is exactly what EX is defined to be.
  - **Prompt the model to match gold column names.** Impossible — the
    harness never sees gold SQL or gold column labels at plan time, and
    the labels are arbitrary annotator choices.
