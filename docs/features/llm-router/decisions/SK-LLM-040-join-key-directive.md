# SK-LLM-040 — Join-key directive in the planner prompt (join on the declared foreign key, not a same-named/non-key column)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) alongside [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md)
(projection / REAL-cast), [`SK-LLM-029`](./SK-LLM-029-null-safe-extremum.md)
(NULL-safe extremum), [`SK-LLM-032`](./SK-LLM-032-count-grain-directive.md)
(count grain), [`SK-LLM-034`](./SK-LLM-034-group-by-grain-directive.md)
(group-by grain), and [`SK-LLM-035`](./SK-LLM-035-numeric-text-cast-directive.md)
(numeric-text cast) — it is not superseded; this is one more bullet in the same
block, orthogonal to each of them. Complements the structural schema-pruning
levers [`SK-LLM-037`](./SK-LLM-037-goal-relevant-schema-pruning.md) (which keeps
the join-relevant tables *present*); this rule governs which *columns* the join
predicate uses once they are present.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet, placed immediately after the schema-literal identifier bullet (the
  join predicate is a schema-linking concern): "When joining tables, join on the
  column pair the schema declares as a `FOREIGN KEY ... REFERENCES` (child
  foreign-key column = parent referenced column), not on columns that merely
  share a name or on a non-key column; when no foreign key is declared between
  them, join on the corresponding key columns (typically a shared id). A wrong
  join column silently returns mismatched or duplicated rows and fails
  execution-accuracy." No exemplar is refit (see *Alternatives rejected*).
- **Core value:** Engine quality, Free
- **Why:** **Join Errors** — joining on the wrong foreign-key columns — are a
  named, prevalent failure category in the in-context-learning text-to-SQL error
  study ([arXiv:2501.09310](https://arxiv.org/pdf/2501.09310), 29 types across 7
  categories over BIRD + Spider) and recur across the 2025/26 schema-linking
  surveys ("errors are prevalent in JOIN operations where wrong foreign-key
  columns are used"). The current Spider/BIRD bottleneck is **SQL-reasoning
  mismatches** (canonical 500-q BIRD run 2026-06-12: mismatch 236, `no_sql` 3 —
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2), the exact territory a join-predicate rule targets: a join on the wrong
  column pair runs without error and returns a silently wrong result set that
  fails both the BIRD multiset scorer
  ([`SK-QUAL-010`](../../quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md))
  and the Spider comparator
  ([`SK-QUAL-008`](../../quality-eval/decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md)).
  The DDL the runner already sends verbatim declares the `FOREIGN KEY ...
  REFERENCES` pairs, so the directive is grounded in text the model already has
  — no new context. It is **independent** of every existing bullet: `SK-LLM-018`
  fixes identifier fidelity, `SK-LLM-027` projection + the integer-ratio cast,
  `SK-LLM-029` the extremum NULL guard, `SK-LLM-032` the count *object*,
  `SK-LLM-034` the grouping *cardinality*, `SK-LLM-035` the text/number cast —
  none constrain the **join predicate**. Two clauses are load-bearing as
  regression bounds:
  - **"the column pair the schema declares as a `FOREIGN KEY ... REFERENCES`"**
    scopes the rule to the declared relationship the model can read off the DDL,
    so it never invents a join nor over-applies on a single-table query.
  - **"when no foreign key is declared between them, join on the corresponding
    key columns"** bounds the regression on schemas that omit FK declarations —
    Spider's SQLite-subset DDL frequently does — so the rule degrades to the
    sensible same-meaning-key join instead of refusing to join.
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to the
  `PLAN_DIRECTIVES` array (≈70 input tokens per `plan` call — the per-minute
  free-tier-quota tradeoff the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks stays small). `PLAN_SYSTEM` and the per-provider wiring are unchanged
  — every provider keeps importing the one `PLAN_SYSTEM` constant.
  `packages/llm/test/prompts.test.ts` pins the bullet, including the
  declared-FK predicate, the FK-less fallback, and the silent-wrong-rows
  mechanism. The combined effect is measured on the next eval run after this
  lands, not on a PR (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **Refit an `SK-LLM-026` exemplar to demonstrate the FK join.** `SK-LLM-026`'s
    three static exemplars have not yet been measured per-lever by a cron;
    editing one now would contaminate that pending measurement (the cron diff
    couldn't separate the exemplar change from the model). A directive-only
    addition keeps the exemplar block's signal clean — the same call `SK-LLM-032`,
    `SK-LLM-034`, and `SK-LLM-035` made (`CLAUDE.md` §P5 — don't add until the
    cheaper lever is measured). The existing Album↔Artist exemplar already joins
    on the matching key, so the behaviour is demonstrated without a refit.
  - **Post-process the SQL to rewrite join predicates onto declared FKs.**
    Deciding which FK chain a multi-table query needs is exactly the planner's
    judgement; a string-rewriting post-processor would duplicate that reasoning
    brittly (and break on aliases, self-joins, and FK-less schemas) for no gain,
    mirroring the `SK-LLM-027` / `SK-LLM-032` / `SK-LLM-035` rejection of a
    post-processor (`CLAUDE.md` §P5).
  - **Inject the FK graph as a separate prompt section.** The DDL already carries
    every `FOREIGN KEY ... REFERENCES` clause verbatim (and `SK-LLM-037` keeps the
    join-relevant tables in it); a parallel FK list would duplicate that text and
    risk drifting from the schema the model is told to treat as literal. The
    directive points the model at the FK clauses it already sees — zero new
    context, no duplication.
