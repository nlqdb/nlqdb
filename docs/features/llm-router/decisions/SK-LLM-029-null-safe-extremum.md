# SK-LLM-029 — NULL-safe extremum ordering directive in the planner prompt

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) alongside [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md) — it
is one additional bullet in the same block, demonstrated by the refit
[`SK-LLM-026`](./SK-LLM-026-static-few-shot-plan-exemplars.md) exemplar 3.
Neither is superseded.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  result-correctness bullet after the REAL-cast bullet: "When selecting a
  single extreme row by ordering (`ORDER BY <col> ... LIMIT`), exclude NULLs
  in the ordered column (`WHERE <col> IS NOT NULL`): in SQLite a NULL sorts
  before every value, so an ascending LIMIT would return a NULL as a false
  minimum." The `SK-LLM-026` exemplar 3 is refit from a `GROUP BY ... ORDER BY
  SUM(amount) DESC LIMIT 1` aggregation to a direct extremum that demonstrates
  the new rule — `SELECT id FROM products WHERE price IS NOT NULL ORDER BY
  price ASC LIMIT 1` (still postgres dialect, still single-column projection,
  so the `SK-LLM-018` casing-variety and `SK-LLM-027` projection coverage is
  retained; only the GROUP-BY-SUM idiom, which no directive backed, is
  dropped per `CLAUDE.md` §P5).
- **Core value:** Engine quality, Free
- **Why:** BIRD is explicitly a *dirty-data* benchmark — "realistic databases
  … including dirty data such as null values and inconsistent formatting"
  ([BIRD arXiv:2305.03111](https://arxiv.org/pdf/2305.03111)). SQLite treats
  NULL as smaller than every value, so an unfiltered `ORDER BY col ASC LIMIT
  1` returns a NULL row as a false minimum ([SQLite ORDER BY
  semantics](https://www.sqlite.org/lang_select.html); confirmed default is
  `NULLS FIRST` in ASC). BIRD gold for "cheapest / smallest / earliest /
  lowest" questions therefore filters the ranked column (`WHERE col IS NOT
  NULL`), and a prediction that omits the filter mismatches gold even when the
  ranking logic is correct — a value-correctness loss the `SK-LLM-018`
  schema-link rules and `SK-LLM-027` projection/REAL-cast rules do not touch.
  The directive is **dialect-portable**: postgres defaults `NULLS LAST` for
  ASC, so the filter is never harmful there (it only drops rows whose ranked
  value is NULL, which is the intended extremum semantics in both engines).
  Prompt-only, demonstrated not just stated (per the `SK-LLM-026` few-shot
  thesis that demonstration beats statement on the small/open models the
  strict-$0 chain runs).
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to
  the `PLAN_DIRECTIVES` array and refits exemplar 3; `PLAN_SYSTEM` and the
  per-provider wiring are unchanged (every provider keeps importing the one
  `PLAN_SYSTEM` constant — no plumbing). `packages/llm/test/prompts.test.ts`
  pins the bullet and the refit exemplar. The bullet adds ≈25 input tokens per
  `plan` call — below the `SK-LLM-027` two-bullet add and far below the
  `SK-LLM-026` exemplar block, so the per-minute-quota tradeoff the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks is negligible. The effect is measured on the first weekly cron
  after this lands, not on a PR (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **`ORDER BY col ASC NULLS LAST` instead of a `WHERE` filter.** `NULLS
    LAST` only exists in SQLite ≥ 3.30 and reorders rather than excludes — a
    NULL still occupies a row, so a `LIMIT 1` after `DESC` could still surface
    a NULL when all real values are exhausted. `WHERE col IS NOT NULL` is the
    form BIRD gold uses and is portable to every dialect and SQLite version.
  - **A blanket "always add `IS NOT NULL` to every filter."** Over-broad: it
    would change result sets on questions where NULL rows are part of the
    intended answer (e.g. "list customers, including those with no order").
    Scoping the rule to *single-extreme-row selection* keeps it honest about
    when NULL is a false answer.
  - **A post-generation result-set patch that strips a leading NULL row.**
    Needs the harness to know the prediction was an extremum query — exactly
    the judgement the planner already makes; it would duplicate that reasoning
    in brittle string-parsing for no gain (`CLAUDE.md` §P5).
  - **State the rule without refitting an exemplar.** `SK-LLM-026`'s finding
    is that demonstration beats statement for small models; the extremum
    idiom was demonstrated by the old exemplar 3 but *without* the NULL guard,
    so the guard had to enter the exemplar to be demonstrated, not merely
    stated.
