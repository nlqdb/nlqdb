# SK-LLM-032 — Count-grain directive in the planner prompt (COUNT(DISTINCT) vs COUNT(\*), and SELECT DISTINCT)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) alongside [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md)
(projection / REAL-cast) and [`SK-LLM-029`](./SK-LLM-029-null-safe-extremum.md)
(NULL-safe extremum) — it is not superseded; this is one more bullet in the
same block.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet, placed after the `SK-LLM-029` extremum bullet and before the
  dialect-strict bullet: "Count and list at the grain the goal asks for: use
  `COUNT(DISTINCT <col>)` — not `COUNT(*)` — when it asks how many
  distinct/different/unique entities, or when a one-to-many join repeats the
  counted rows; use `SELECT DISTINCT` when it asks for distinct values;
  otherwise use `COUNT(*)` / a plain `SELECT` so intended duplicates are kept."
  No exemplar is refit (see *Alternatives rejected*).
- **Core value:** Engine quality, Free
- **Why:** Two named error categories in the in-context-learning text-to-SQL
  error study ([arXiv:2501.09310](https://arxiv.org/pdf/2501.09310), over
  BIRD + Spider) are independent of the `SK-LLM-018` schema-link, `SK-LLM-027`
  projection/REAL-cast, and `SK-LLM-029` extremum rules, so none of them
  address it:
  - **"Wrong COUNT Object"** — the model emits `COUNT(*)` (or `COUNT(id)`)
    where the goal means `COUNT(DISTINCT <key>)`. The study's worked example
    counts molecules with a triple bond as `COUNT(*)` over a bond table that
    has many rows per molecule, where the gold counts `DISTINCT molecule_id`.
    A one-to-many join silently inflates `COUNT(*)` (our mechanistic read of
    that example — E6 itself is the broader "wrong count object"), so the
    result is a different number from gold — a hard EX mismatch under both the
    BIRD multiset scorer (`tools/eval/src/score.ts::rowsMatch`, retained strict
    per [`SK-QUAL-010`](../../quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md))
    and the Spider column comparator (`comparePandasTable`).
  - **"Missing DISTINCT Keyword"** — a non-aggregate `SELECT` returns
    duplicate rows where the goal asks for distinct values. Extra duplicate
    rows change the result set ⇒ EX mismatch on both scorers.
  The directive is prompt-only, dataset-agnostic, and dialect-portable
  (`COUNT(DISTINCT …)` / `SELECT DISTINCT` are standard SQL on both SQLite and
  Postgres), so it can lift **BIRD and Spider** alike. The trailing
  "otherwise … so intended duplicates are kept" guard is load-bearing: it
  scopes the rule to questions whose phrasing (*distinct / different /
  unique*) or join shape makes deduplication the gold behaviour, and stops the
  model from sprinkling `DISTINCT` onto queries where gold keeps duplicates —
  the regression both the strict BIRD multiset scorer
  ([`SK-QUAL-010`](../../quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md))
  and the row-count-sensitive Spider comparator
  ([`SK-QUAL-008`](../../quality-eval/decisions/SK-QUAL-008-spider2-lite-multi-csv-scorer.md),
  `vectorsMatch` fails on a length mismatch) would otherwise punish.
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to
  the `PLAN_DIRECTIVES` array (≈50 input tokens per `plan` call — above the
  `SK-LLM-029` bullet, below the `SK-LLM-026` exemplar block; the per-minute
  free-tier-quota tradeoff the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks stays small). `PLAN_SYSTEM` and the per-provider wiring are
  unchanged — every provider keeps importing the one `PLAN_SYSTEM` constant.
  `packages/llm/test/prompts.test.ts` pins the bullet, including its guard
  clause. The combined effect is measured on the next eval run after this
  lands, not on a PR (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **A blanket "always `SELECT DISTINCT`" rule.** Over-broad: it would
    deduplicate result sets the goal wants kept (e.g. "list every order
    total", where repeated values are intended), turning multiset-correct
    answers into mismatches under the strict BIRD scorer. The phrasing- and
    join-scoped form is the honest call.
  - **Refit an `SK-LLM-026` exemplar to demonstrate `COUNT(DISTINCT)`.**
    `SK-LLM-026`'s three static exemplars shipped one PR ago and have not yet
    been measured by a cron; editing one now would contaminate that pending
    measurement (the cron diff couldn't separate the exemplar change from the
    model). A directive-only addition keeps the exemplar block's signal clean;
    a demonstration is a follow-up once `SK-LLM-026`'s delta is known
    (`CLAUDE.md` §P5 — don't add until the cheaper lever is measured).
  - **Post-process the SQL to inject `DISTINCT`.** Deciding *when* distinctness
    is intended is exactly the planner's judgement; a string-rewriting
    post-processor would duplicate that reasoning brittly for no gain
    (`CLAUDE.md` §P5), mirroring the `SK-LLM-027` rejection of a
    result-trimming post-processor.
