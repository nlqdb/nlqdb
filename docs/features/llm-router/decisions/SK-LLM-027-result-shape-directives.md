# SK-LLM-027 — Result-shape directives in the planner prompt (exact projection + REAL-cast ratios)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the
`PLAN_DIRECTIVES` block) — it is not superseded; these are two additional
bullets in the same block, demonstrated by the
[`SK-LLM-026`](./SK-LLM-026-static-few-shot-plan-exemplars.md) exemplars.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains two
  result-shape bullets between the `Evidence:` bullet and the dialect-strict
  bullet: (1) **exact projection** — "Select exactly the columns the goal
  asks for, and only those — extra id/name/descriptive columns change the
  result set and fail execution-accuracy"; (2) **REAL-cast ratios** — "For a
  ratio or percentage of two integer columns, cast one operand to REAL (e.g.
  `CAST(x AS REAL) / y`) so the division is not integer-truncated." The
  `SK-LLM-026` exemplar 2 is refit to demonstrate (2): its `income` table's
  `total_income` becomes `INTEGER` (so both ratio operands are integer) and
  its answer becomes `SELECT CAST(total_income AS REAL) / residents …`. The
  existing exemplars 1 and 3 already demonstrate (1) — `COUNT(*)` and a
  single requested `customer_id`, never an extra column.
- **Core value:** Engine quality, Free
- **Why:** The two dominant non-`no_sql` failure classes in the 0.318
  free-chain BIRD-dev baseline (`tools/eval/baseline-2026-06-15.json`: 283
  mismatches) are independent of the `SK-LLM-018` schema-link rules and so
  unaddressed by them. **Projection:** a query can be logically correct yet
  fail execution-accuracy purely because the `SELECT` clause includes extra
  columns — a recognised EX failure mode (Open-SQL
  [arXiv:2405.06674](https://arxiv.org/pdf/2405.06674); BIRD
  [arXiv:2305.03111](https://arxiv.org/pdf/2305.03111)). The BIRD scorer
  (`tools/eval/src/score.ts::canonicalize`) keys each row by its full column
  set, so an extra projected column is a hard mismatch; the Spider 2.0-lite
  scorer (`comparePandasTable`) only requires every gold column to find a
  match and **ignores extra prediction columns**, so the directive lifts
  BIRD and is Spider-neutral *for the dominant over-projection case*. The
  one residual risk is symmetric for both scorers — *under*-projection, where
  the model drops a column the gold needs. The directive's framing ("exactly
  the columns the goal asks for") steers toward the gold's own minimal
  projection rather than toward "fewer", so it bounds that tail without
  eliminating it; the dominant error on a "helpful" reasoning head is the
  *over*-projection it removes. **REAL cast:** SQLite integer-divides
  `int / int` and truncates ([SQLite forum
  19569c70bb](https://sqlite.org/forum/info/19569c70bbe5b797)); BIRD's
  `Evidence:` formulas are overwhelmingly ratios/percentages and that gold
  predominantly casts to REAL, so a floored prediction mismatches it.
  Honest residual: the BIRD scorer is *exact* (no numeric tolerance, unlike
  Spider's `1e-2`), so on the minority of ratio golds that genuinely
  integer-floor, a cast prediction would now mismatch — the
  `two integer columns` scope and BIRD's dominant REAL-casting convention
  make this net-positive in expectation, not risk-free. Both bullets are
  prompt-only, dataset-agnostic, and demonstrated (not just stated) per the
  `SK-LLM-026` few-shot thesis — the cheapest place to convert mismatches
  into matches on the small/open models the strict-$0 chain runs.
- **Consequence in code:** `packages/llm/src/prompts.ts` adds two strings to
  the `PLAN_DIRECTIVES` array and refits exemplar 2; `PLAN_SYSTEM` and the
  per-provider wiring are unchanged (every provider keeps importing the one
  `PLAN_SYSTEM` constant — no plumbing). `packages/llm/test/prompts.test.ts`
  pins both bullets and the cast demonstration. The two bullets add ≈40
  input tokens per `plan` call — far below the `SK-LLM-026` exemplar block,
  so the per-minute-quota tradeoff the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks is negligible. The combined effect is measured on the first
  weekly cron after this lands, not on a PR (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **A blanket "cast every numeric division to REAL" rule.** Over-broad:
    on a column whose true value is integral the cast is a no-op under the
    BIRD scorer (JS collapses `5.0`→`5`), but the narrower "two integer
    columns" scope keeps the directive honest about *when* truncation is the
    bug and avoids teaching the model to litter casts.
  - **Add a result-set-trimming post-processor instead of a directive.**
    Stripping extra columns after generation needs the harness to know which
    columns the goal "asked for" — exactly the judgement the planner already
    makes. A post-processor would duplicate that reasoning in brittle
    string-parsing for no gain (`CLAUDE.md` §P5).
  - **State the rules without refitting an exemplar.** `SK-LLM-026`'s own
    finding is that demonstration beats statement for small models; leaving
    the REAL cast undemonstrated would be inconsistent with that. Projection
    discipline was already demonstrated by exemplars 1/3, so only the cast
    exemplar changed.
