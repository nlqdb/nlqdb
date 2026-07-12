# SK-LLM-044 — Entity-identification projection directive in the planner prompt (name over surrogate id; no subset answers)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block), placed immediately after the
[`SK-LLM-043`](./SK-LLM-043-single-column-projection-directive.md) bullet so
the three result-shape rules ([`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md)
exact projection → SK-LLM-043 no concatenation → this) read together. Not
superseded; one more bullet in the same block.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet: when the goal asks to identify, list, or rank entities
  (which/who/top-N `<entity>`), project the column that *names* the entity —
  the human-readable name, JOINing to its naming table when the queried table
  carries only a surrogate id/code — adding the id or other attributes only as
  the goal requests them; and a multi-part goal gets every explicitly
  requested attribute, never a subset. Prompt-only; no exemplar refit.
- **Core value:** Engine quality, Free
- **Why:** Evidence-picked on the 2026-07-11 canonical Spider 2.0-lite run
  (free lane, 135 q, raw EX 0.2741 — the first fully-answered run after
  `SK-QUAL-013`'s transient-wall fix). An offline result-shape bucketing of
  all 98 non-matches (re-executing each predicted SQL against the local
  SQLite fixtures and diffing against the gold CSVs with the canonical
  comparator) splits the loss mass: 52/98 execute to the **exact gold row
  count** but fail on column values — the join/filter/grain is right and the
  projection is wrong. The directive-addressable core of that mass is
  projection *identity*: the model answers an identification goal with the
  surrogate id where gold carries the name (local026 — bowler id `294` vs
  gold `"P Awana"`; local020, local133), or omits an explicitly requested
  attribute (local023 — asked for avg-runs-per-match *and* batting average,
  returned one; local004, local194, local209, local220, local131), ~10–12
  rows ≈ 7–9 pp of Spider headroom. Spider's canonical comparator
  (`SK-QUAL-008`) tolerates extra predicted columns — every gold column just
  needs a matching predicted column — so projecting the naming column is
  free there; BIRD's positional scorer (`SK-QUAL-010`) follows the goal's
  literal ask, which the bullet defers to ("only as the goal requests
  them"), so the `SK-LLM-027` minimal-projection bound still governs
  unrequested extras.
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to
  the `PLAN_DIRECTIVES` array (≈85 input tokens per `plan` call), placed
  directly after the `SK-LLM-043` bullet. `PLAN_SYSTEM` and the per-provider
  wiring are unchanged — `buildPlanSystem(k ≤ 0)` still returns the one
  constant byte-for-byte ([`SK-LLM-041`](./SK-LLM-041-similarity-retrieved-few-shot.md)).
  `packages/llm/test/prompts.test.ts` pins the bullet: the name-over-id rule,
  the literal-ask regression bound, and the no-subset half.
- **Alternatives rejected:** A Spider-only prompt fork in the eval harness
  (measures a harness, not the product — the planner the users hit must be
  the planner the benchmark scores); relaxing the `SK-LLM-027` bullet
  wholesale (its extra-column bound is load-bearing on BIRD); an exemplar
  demonstrating the JOIN-to-name pattern (token cost in every plan call for
  a rule the bullet states declaratively; revisit if the measured lift
  underdelivers).
