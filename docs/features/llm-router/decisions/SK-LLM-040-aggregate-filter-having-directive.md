# SK-LLM-040 — Aggregate-filter directive in the planner prompt (filter groups by an aggregate in HAVING, not WHERE)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) alongside [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md)
(projection / REAL-cast), [`SK-LLM-029`](./SK-LLM-029-null-safe-extremum.md)
(NULL-safe extremum), [`SK-LLM-032`](./SK-LLM-032-count-grain-directive.md)
(count grain), [`SK-LLM-034`](./SK-LLM-034-group-by-grain-directive.md)
(group-by grain), and [`SK-LLM-035`](./SK-LLM-035-numeric-text-cast-directive.md)
(numeric-text cast) — it is not superseded; this is one more bullet in the same
block, orthogonal to each of them.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet, placed immediately after the `SK-LLM-034` group-by-grain bullet so the
  two aggregation-structure rules read together: "Filter groups by an aggregate
  in HAVING, not WHERE: a threshold on a group's aggregate (e.g. groups having
  more than N rows, or whose SUM/AVG exceeds a value) belongs in a HAVING clause
  after GROUP BY, because WHERE filters individual rows before aggregation and
  cannot reference an aggregate; keep plain per-row predicates in WHERE." No
  exemplar is refit (see *Alternatives rejected*).
- **Core value:** Engine quality, Free
- **Why:** **"Unaligned Aggregation Structure"** is a named error type (E5 in
  the in-context-learning text-to-SQL error study
  [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310), 29 types across 7
  categories over BIRD + Spider) whose definition spans "aggregate functions,
  GROUP BY clause, **and HAVING clause**". [`SK-LLM-034`](./SK-LLM-034-group-by-grain-directive.md)
  covers the GROUP BY half (grouping cardinality); the HAVING half is
  uncovered. A group-level threshold expressed in `WHERE` rather than `HAVING`
  fails two distinct ways, both costing execution-accuracy:
  - **Hard error (wasted retry).** `WHERE COUNT(*) > 5` is rejected by SQLite
    ("misuse of aggregate function") and Postgres ("aggregate functions are not
    allowed in WHERE"). The exec-retry path
    ([`SK-ASK-013`](../../ask-pipeline/FEATURE.md#sk-ask-013) /
    [`SK-ASK-022`](../../ask-pipeline/FEATURE.md#sk-ask-022))
    then burns a re-plan round-trip — quota the free chain can't spare — and may
    not recover if the model re-emits the same shape.
  - **Silent mismatch.** Omitting the group filter entirely (returning all
    groups instead of the qualifying ones) is a cardinality mismatch that runs
    without error and fails the positional-tuple set scorers
    ([`SK-QUAL-010`](../../quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md)
    BIRD ·
    [`SK-QUAL-008`](../../quality-eval/decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md)
    Spider) — the territory of §4's mismatch backlog in the
    [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md).
  The directive is prompt-only and **independent** of every existing bullet —
  `SK-LLM-018` fixes identifier fidelity, `SK-LLM-027` the projection / ratio
  cast, `SK-LLM-029` the extremum NULL guard, `SK-LLM-032` the count *object*,
  `SK-LLM-034` the grouping *cardinality*, and `SK-LLM-035` the implicit numeric
  cast. The **"keep plain per-row predicates in WHERE"** clause is the
  load-bearing regression bound: it stops the rule pushing ordinary row filters
  into `HAVING` (which would force the engine to scan and aggregate rows it
  could have filtered first — a correctness *and* performance foothold). The
  combined effect is measured on the next eval run, not on a PR (`SK-QUAL-002`).
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to the
  `PLAN_DIRECTIVES` array (≈55 input tokens per `plan` call — the per-minute
  free-tier-quota tradeoff the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks stays small). `PLAN_SYSTEM` and the per-provider wiring are
  unchanged — every provider keeps importing the one `PLAN_SYSTEM` constant.
  `packages/llm/test/prompts.test.ts` pins the bullet, including the
  WHERE-vs-aggregation mechanism and the per-row-predicate no-regression guard.
- **Alternatives rejected:**
  - **Refit an `SK-LLM-026` exemplar to demonstrate GROUP BY + HAVING.**
    `SK-LLM-026`'s three static exemplars have not yet been attributed by a
    per-lever ablation (the source-of-truth §6 "Next"); editing one now would
    contaminate that pending measurement. A directive-only addition keeps the
    exemplar block's signal clean — the same call `SK-LLM-032`, `SK-LLM-034`,
    and `SK-LLM-035` made (`CLAUDE.md` §P5 — don't add until the cheaper lever
    is measured).
  - **Post-process the SQL to rewrite a `WHERE`-on-aggregate into `HAVING`.**
    Deciding which predicate is a group threshold vs a row filter is exactly the
    planner's judgement; a string-rewriting post-processor would duplicate that
    reasoning brittly for no gain, mirroring the `SK-LLM-027` / `SK-LLM-032` /
    `SK-LLM-034` / `SK-LLM-035` rejection of a post-processor (`CLAUDE.md` §P5).
  - **Rely on the exec-retry to fix the hard-error case.** Retry costs a
    free-chain round-trip and only catches the *hard-error* half — it does
    nothing for the silent-mismatch half (a query that runs but returns the
    wrong groups). Preventing both at plan time is strictly cheaper than
    repairing one of them after exec.
