# SK-QUAL-015 — Offline column-coverage harness: measure the recall ceiling of goal-token column pruning before building it

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). The prerequisite the
§4 #2 backlog lever in
[`quality-score-source-of-truth.md`](../../../progress/quality-score-source-of-truth.md)
names ("column-level recall risk is per-column — needs an offline recall
harness like T19's first"). Sibling of
[`SK-QUAL-014`](./SK-QUAL-014-mismatch-error-class-classifier.md) (mismatch
classifier); both are read-only offline instruments that direct the levers.

- **Decision:** `tools/eval/src/column-coverage.ts` exports a pure
  `coverage(gold) → CoverageResult` that, over a BIRD gold JSON, measures the
  **recall ceiling** of pruning a table's columns by goal-token match: of the
  qualified `alias.column` references a gold query makes, what fraction share a
  `wordTokens` token — the *same* tokenizer [`SK-LLM-037`](../../llm-router/decisions/SK-LLM-037-goal-relevant-schema-pruning.md)'s
  pruner uses, imported from `@nlqdb/llm` — with the goal+evidence text. The
  uncovered remainder is split by `isKeyLike` into **key-like** (id/key/code/ref/
  link_to_… — a join/PK column an FK/PK-protection rule re-admits without the
  goal naming it, as `SK-LLM-037`'s FK closure re-admits join *tables*) and
  **value/measure** (recoverable only by the value-retrieval half of §4 #2). A
  `bun column-coverage <gold.json>` CLI prints the partition + the busiest
  value-misses.

- **Core value:** Legible

- **Why:**
  - **Column pruning has no recall safety net, so measure it first.**
    `SK-LLM-037` prunes whole *tables* and is recall-monotone — the FK closure
    re-admits any join target, verified at 99.8% gold-table recall (T19/T21).
    Pruning *columns* by the same goal-token rule drops any needed column that
    shares no token with the goal, with nothing to re-admit it. Run on BIRD-dev
    2026-06 the ceiling is **59.8%** (1091/1825 qualified refs) — a token-only
    column pruner would drop **40%** of the columns gold queries need. That is
    the number that turns "column pruning" from an assumed win into a gated one.
  - **The split tells you which half of §4 #2 to build.** Of the uncovered
    columns, **27.4%** are key-like (an FK/PK rule lifts the achievable recall
    to ~87%, mirroring the table-level FK closure) but **12.8%** are
    value/measure columns — `displayname`, `date`, `year`, `segment` (the goal
    says "SME"), `currency` (the goal says "CZK"), `frequency`,
    `fastestlapspeed`. No pruner recovers those: they are named by *value*, not
    name. They are the **irreducible floor** a column pruner cannot cross, and
    they are exactly the value-grounding class `SK-QUAL-014` found dominating the
    mismatch mass. So the evidence re-ranks §4 #2: **value-retrieval first**
    (additive — zero recall risk — and the only lever that recovers the floor),
    **column-pruning second** (recall-gated on key protection + a real-DDL
    recall run; its win is mainly Spider distractor removal).
  - **A ceiling, honestly bounded.** It counts only qualified `alias.column`
    refs (the unambiguous ones — bare identifiers collide with table/alias
    names and would inflate the count, the `SK-QUAL-014` noise lesson) and
    cannot see the full DDL (PK/FK declarations, types), so the real pruner with
    key-protection lands at or above the key-inclusive number. The harness
    reports a ceiling and says so; it does not claim to be the pruner's recall.

- **Consequence in code:** `tools/eval/src/column-coverage.ts` (pure
  `goldColumns` / `isKeyLike` / `coveredByGoal` / `coverage` + `import.meta.main`
  CLI), `test/column-coverage.test.ts` (extraction + partition + key/value
  classification, mocked, no network), the `column-coverage` script in
  `tools/eval/package.json`, and a one-line `wordTokens` re-export from
  `packages/llm/src/index.ts` so the harness shares the pruner's tokenizer.
  Read-only over a gold JSON — no change to `runner.ts`, the scorer, or the
  chain, so no KPI can move; it directs the levers that do.

- **Alternatives rejected:**
  - **Build the column pruner now and measure recall from the next eval's EX.**
    That spends a full quota-gated eval window to discover a 40% recall hole the
    gold JSON reveals offline for free; §4 #2 explicitly asks for the harness
    *first*.
  - **Inline a private tokenizer (as `SK-QUAL-014` does its `norm`).** The whole
    point is fidelity to the pruner's matching — a private copy could drift and
    report a ceiling the real pruner never hits. Re-exporting `wordTokens` is
    one line and keeps them identical by construction.
  - **Run the real pruner over introspected SQLite DDL for an exact per-column
    recall.** That needs the multi-hundred-MB BIRD `dev_databases` fixtures (an
    eval-machine download), so it belongs in the gated eval run that verifies
    the pruner before it ships — not in this offline, fixture-free first pass.
