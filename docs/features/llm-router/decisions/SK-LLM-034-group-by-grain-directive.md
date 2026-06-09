# SK-LLM-034 — Group-by-grain directive in the planner prompt (per-group GROUP BY alignment)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) alongside [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md)
(projection / REAL-cast), [`SK-LLM-029`](./SK-LLM-029-null-safe-extremum.md)
(NULL-safe extremum), and [`SK-LLM-032`](./SK-LLM-032-count-grain-directive.md)
(count grain) — it is not superseded; this is one more bullet in the same
block, orthogonal to each of them.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet, placed after the `SK-LLM-032` count-grain bullet and before the
  dialect-strict bullet: "Match the aggregation grain to the goal: when it
  asks for an aggregate per group (`per`/`for each`/`by <category>`),
  `GROUP BY` that column and project it beside the aggregate so each group is
  one row; when it asks for one overall total, omit `GROUP BY`. Every
  non-aggregated column in the SELECT must also appear in `GROUP BY`." No
  exemplar is refit (see *Alternatives rejected*).
- **Core value:** Engine quality, Free
- **Why:** **"Unaligned Aggregation Structure"** is a named semantic error
  type (E5) in the in-context-learning text-to-SQL error study
  ([arXiv:2501.09310](https://arxiv.org/pdf/2501.09310), 29 types across 7
  categories over BIRD + Spider): the generated SQL misses, mis-places, or
  adds a redundant aggregation component — most commonly a **missing
  `GROUP BY`** on a per-group question, which collapses the answer to a single
  global aggregate. That is a result-set **cardinality** mismatch (one row
  where gold returns one-per-group), so it fails execution-accuracy under both
  the BIRD multiset scorer
  ([`SK-QUAL-010`](../../quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md))
  and the Spider row-count-sensitive comparator
  ([`SK-QUAL-008`](../../quality-eval/decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md)).
  It is **independent** of the existing directives, none of which address
  grouping cardinality: `SK-LLM-018` fixes identifier fidelity, `SK-LLM-027`
  fixes the projected *columns*, `SK-LLM-029` the extremum NULL guard, and
  `SK-LLM-032` the count *object* (`COUNT(DISTINCT)` vs `COUNT(*)`) and
  `SELECT DISTINCT` — but a `COUNT(*)` with the wrong (missing) `GROUP BY` is
  still the wrong *shape*. The directive is prompt-only, dataset-agnostic, and
  dialect-portable (`GROUP BY` and the "non-aggregated column ⇒ in GROUP BY"
  rule are standard SQL on SQLite and Postgres), so it can lift **BIRD and
  Spider** alike. Two clauses are load-bearing as regression bounds:
  - The **"when it asks for one overall total, omit `GROUP BY`"** guard, plus
    the **"in an aggregate query"** scope on the non-aggregated-column rule,
    bound the inverse regression: they stop the model adding a spurious
    `GROUP BY` to a single-aggregate question (many rows where gold returns
    one) *and* keep the rule from over-grouping a plain non-aggregate `SELECT`
    into an effective `DISTINCT` that would drop intended duplicate rows under
    the multiset scorer.
  - The **non-aggregated-column rule** is a correctness gain inside an
    aggregate query: Postgres rejects a bare non-aggregated column outright
    (error `42803`), and SQLite returns an *arbitrary* row's value for it
    (well-defined only for a lone `MIN()`/`MAX()`; arbitrary for every other
    bare-aggregate shape per [SQLite](https://www.sqlite.org/lang_select.html))
    — a non-deterministic wrong answer the rule eliminates without harming a
    correct query.
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to
  the `PLAN_DIRECTIVES` array (≈45 input tokens per `plan` call — below the
  `SK-LLM-026` exemplar block, above the dialect-strict bullet; the
  per-minute free-tier-quota tradeoff the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks stays small). `PLAN_SYSTEM` and the per-provider wiring are
  unchanged — every provider keeps importing the one `PLAN_SYSTEM` constant.
  `packages/llm/test/prompts.test.ts` pins the bullet, including both its
  grouping clause and the overall-total guard. The combined effect is measured
  on the next eval run after this lands, not on a PR (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **A blanket "always `GROUP BY` the first listed column" rule.** Over-broad:
    it would group single-aggregate questions and inflate the row count, the
    exact regression the overall-total guard prevents. The phrasing-scoped form
    ("per/for each/by") is the honest call.
  - **Refit an `SK-LLM-026` exemplar to demonstrate the per-group `GROUP BY`.**
    `SK-LLM-026`'s three static exemplars have not yet been measured by a cron;
    editing one now would contaminate that pending measurement (the cron diff
    couldn't separate the exemplar change from the model). A directive-only
    addition keeps the exemplar block's signal clean — the same call
    `SK-LLM-032` made; a demonstration is a follow-up once `SK-LLM-026`'s delta
    is known (`CLAUDE.md` §P5 — don't add until the cheaper lever is measured).
  - **Post-process the SQL to inject a `GROUP BY`.** Deciding *which* column is
    the grouping grain is exactly the planner's judgement; a string-rewriting
    post-processor would duplicate that reasoning brittly for no gain
    (`CLAUDE.md` §P5), mirroring the `SK-LLM-027` / `SK-LLM-032` rejection of a
    post-processor.
  - **A separate `HAVING`-vs-`WHERE` bullet in the same PR.** `HAVING`/`WHERE`
    mis-placement is a different, lower-frequency error type and a mis-placed
    aggregate in `WHERE` is usually a hard exec-error (only 7/500 in the
    baseline), so its EX headroom is small. Folding two prompt changes into one
    PR also blurs which moved the next eval run. Parked as a backlog item, not
    bundled here (`CLAUDE.md` §P5).
