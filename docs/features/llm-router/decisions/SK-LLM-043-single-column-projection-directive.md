# SK-LLM-043 — Single-column projection directive in the planner prompt (don't concatenate requested columns into one value)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) alongside [`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md)
(projection / REAL-cast) — it is the projection sibling of `SK-LLM-027`'s
"exact columns" bullet, placed immediately after it, orthogonal to the
count/group-by/HAVING/cast bullets ([`SK-LLM-032`](./SK-LLM-032-count-grain-directive.md),
[`SK-LLM-034`](./SK-LLM-034-group-by-grain-directive.md),
[`SK-LLM-040`](./SK-LLM-040-aggregate-filter-having-directive.md),
[`SK-LLM-035`](./SK-LLM-035-numeric-text-cast-directive.md)). Not superseded;
one more bullet in the same block.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet, placed immediately after the `SK-LLM-027` exact-projection bullet so
  the two result-shape rules read together: "Return each attribute the goal
  names as its own column — do not concatenate columns into one value (e.g.
  `first_name || ' ' || last_name`) unless the goal explicitly asks for a single
  combined string; concatenation collapses the requested columns into one and
  fails the per-column result set." No exemplar is refit (see *Alternatives
  rejected*).
- **Core value:** Engine quality, Free
- **Why:** Measured on the pinned BIRD baseline
  ([`tools/eval/baseline-2026-06-15.json`](../../../../tools/eval/baseline-2026-06-15.json),
  free lane, 500 q, EX 0.512): the `SK-QUAL-014` offline mismatch analyzer finds
  **7 of 238 mismatches** carry a `first_name || ' ' || last_name`-shaped
  concatenation in the predicted projection where the gold returns the component
  columns separately, and **0 of 256 matches** use `||` at all — so the
  regression floor of discouraging concatenation is zero. BIRD gold uses `||` in
  only **1 of 500** queries (the lone case that *explicitly* asks for a combined
  string — the bound the directive's escape clause protects). The model
  concatenates a name/label into a single-column result, which fails the
  positional-tuple set scorer
  ([`SK-QUAL-010`](../../quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md))
  against gold's `(first_name, last_name, …)` per-column tuple. A **deterministic
  ceiling check** — de-concatenating the projection of each of the 7 cases and
  re-scoring against the real BIRD SQLite databases with the canonical scorer —
  flips **3** (qid 1381, 898, 1002) mismatch→match (EX 0.512 → 0.518, +0.6 pp),
  the other 4 co-occurring with a separate structural error the directive does
  not address. The directive is prompt-only and **independent** of every other
  bullet — `SK-LLM-027` bounds projection *width* (extra columns), this bounds
  projection *fusion* (columns merged into one). The **"unless the goal
  explicitly asks for a single combined string"** clause is the load-bearing
  regression bound: it keeps a genuine "full name" request producing one column.
  The combined effect is re-measured on the next eval run, not on a PR
  ([`SK-QUAL-002`](../../quality-eval/decisions/SK-QUAL-002-pr-ci-never-fires-real-keys.md)).
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to the
  `PLAN_DIRECTIVES` array (≈45 input tokens per `plan` call). `PLAN_SYSTEM` and
  the per-provider wiring are unchanged — every provider keeps importing the one
  `PLAN_SYSTEM` constant, and `buildPlanSystem(k ≤ 0)` still returns it
  byte-for-byte ([`SK-LLM-041`](./SK-LLM-041-similarity-retrieved-few-shot.md)).
  `packages/llm/test/prompts.test.ts` pins the bullet, including the escape
  clause and the collapse mechanism.
- **Alternatives rejected:**
  - **Post-process the SQL to split a `A || B` projection into `A, B`.** Deciding
    whether a concatenation is the intended output (an explicit "combined
    string" goal) or an accidental collapse is the planner's judgement; a
    string-rewriting post-processor would duplicate that reasoning brittly and
    mangle the 1-in-500 legitimate case — mirroring the `SK-LLM-027` / `-032` /
    `-034` / `-040` rejection of post-processors (`CLAUDE.md` §P5). (The
    de-concat rewrite in the *Why* is a one-off offline ceiling probe, never a
    production path.)
  - **Refit an `SK-LLM-026` exemplar to demonstrate separate columns.** The
    static exemplars are not yet attributed by the `SK-LLM-041` per-lever
    ablation; editing one now would contaminate that pending measurement. A
    directive-only addition keeps the exemplar block's signal clean.
