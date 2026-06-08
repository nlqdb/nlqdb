# SK-LLM-035 — Numeric-text-cast directive in the planner prompt (cast TEXT-declared columns used numerically)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) alongside [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md)
(projection / REAL-cast), [`SK-LLM-029`](./SK-LLM-029-null-safe-extremum.md)
(NULL-safe extremum), [`SK-LLM-032`](./SK-LLM-032-count-grain-directive.md)
(count grain), and [`SK-LLM-034`](./SK-LLM-034-group-by-grain-directive.md)
(group-by grain) — it is not superseded; this is one more bullet in the same
block, orthogonal to each of them.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet, placed immediately after the `SK-LLM-027` REAL-cast-ratio bullet so
  the two numeric-cast rules read together: "When the schema declares a column
  as TEXT but the goal compares, orders, sums, or averages it numerically, cast
  it to a number (`CAST(<col> AS REAL)`) — a TEXT column is compared
  lexicographically (so `'100'` sorts before `'9'` and a plain `ORDER BY` or `>`
  mis-ranks); the cast is harmless when the values are already numeric." No
  exemplar is refit (see *Alternatives rejected*).
- **Core value:** Engine quality, Free
- **Why:** **"Implicit Type Conversion"** is a named error type (C1, a logic
  error) in the in-context-learning text-to-SQL error study
  ([arXiv:2501.09310](https://arxiv.org/pdf/2501.09310), 29 types across 7
  categories over BIRD + Spider). It is BIRD's signature real-world trap:
  columns declared `TEXT` that actually hold numeric strings. SQLite gives such
  a column **text affinity** and, absent a cast, compares it **lexicographically**
  rather than numerically ([SQLite datatypes §3.3 / §4.2](https://sqlite.org/datatype3.html)) —
  so `'100' < '9'` is true, `WHERE pct > 50` mis-filters, and a bare `ORDER BY`
  mis-ranks; the SQL runs without error and returns a silently wrong result that
  fails execution-accuracy under both the BIRD multiset scorer
  ([`SK-QUAL-010`](../../quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md))
  and the Spider comparator
  ([`SK-QUAL-008`](../../quality-eval/decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md)).
  `CAST(<col> AS REAL)` is the dialect-portable fix BIRD gold itself uses. The
  directive is prompt-only and **independent** of every existing bullet —
  `SK-LLM-018` fixes identifier fidelity, `SK-LLM-029` the extremum NULL guard,
  `SK-LLM-032` the count *object*, `SK-LLM-034` the grouping *cardinality*, and
  `SK-LLM-027` casts an **integer/integer division** to avoid truncation, a
  different trigger (a *declared-integer* divide) and a different failure
  (truncation, not lexicographic mis-order). Two scope clauses are load-bearing
  as regression bounds:
  - **"declares a column as TEXT … but the goal … numerically"** scopes the
    rule to exactly the C1 case (a text-affinity column read off the DDL the
    runner already sends verbatim), so it never fires on a column already
    declared `INTEGER`/`REAL` and never rewrites string comparisons.
  - **"harmless when the values are already numeric"** states the no-regression
    invariant: `CAST('100' AS REAL)` and `CAST(100 AS REAL)` both yield the
    numeric `100.0`, which the positional-tuple set scorers treat as equal to
    the integer `100` (Python `100 == 100.0`; bun:sqlite `.values()` returns a
    JS number either way), so adding the cast cannot turn a passing row into a
    failing one.
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to the
  `PLAN_DIRECTIVES` array (≈55 input tokens per `plan` call — the per-minute
  free-tier-quota tradeoff the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks stays small). `PLAN_SYSTEM` and the per-provider wiring are
  unchanged — every provider keeps importing the one `PLAN_SYSTEM` constant.
  `packages/llm/test/prompts.test.ts` pins the bullet, including the
  lexicographic mechanism and the already-numeric no-regression guard. The
  combined effect is measured on the first weekly cron after this lands, not on
  a PR (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **A blanket "always cast numeric-looking columns" rule.** Over-broad: it
    would cast columns already typed `INTEGER`/`REAL` (cosmetic churn, and a
    foothold for the model to cast a genuine text column it should compare as a
    string). Scoping to a `TEXT`-*declared* column the model can read off the
    DDL is the honest, false-positive-free form.
  - **Refit an `SK-LLM-026` exemplar to demonstrate the cast.** `SK-LLM-026`'s
    three static exemplars have not yet been measured by a cron; editing one now
    would contaminate that pending measurement (the cron diff couldn't separate
    the exemplar change from the model). A directive-only addition keeps the
    exemplar block's signal clean — the same call `SK-LLM-032` and `SK-LLM-034`
    made; a demonstration is a follow-up once `SK-LLM-026`'s delta is known
    (`CLAUDE.md` §P5 — don't add until the cheaper lever is measured).
  - **Send per-column sample cell-values so the model infers true types instead
    of being told to cast.** That is the value-retrieval lever (the engine-quality
    source of truth §4 #2) — a runner + production-schema-assembly change that
    must stay mirrored (eval-mirrors-production guardrail) and is far larger than
    one prompt bullet. Parked there; this directive is the zero-dependency slice
    of the same gain (`CLAUDE.md` §P5).
  - **Post-process the SQL to inject casts.** Deciding which column is a
    text-stored number and which comparison is numeric is exactly the planner's
    judgement; a string-rewriting post-processor would duplicate that reasoning
    brittly for no gain, mirroring the `SK-LLM-027` / `SK-LLM-032` / `SK-LLM-034`
    rejection of a post-processor (`CLAUDE.md` §P5).
