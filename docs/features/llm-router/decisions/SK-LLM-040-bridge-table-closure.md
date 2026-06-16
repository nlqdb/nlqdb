# SK-LLM-040 — Bridge-table closure: keep the M:N junction that joins two kept tables

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). A recall fix on the
schema-pruner shipped in [`SK-LLM-037`](./SK-LLM-037-goal-relevant-schema-pruning.md):
its FK closure is forward-only, so it drops the one table category that is
*always* needed for a join yet *rarely* token-matches the goal.

- **Decision:** After `pruneSchemaForGoal`'s forward `REFERENCES` closure
  (`SK-LLM-037`), a second single-shot pass keeps any **not-yet-kept** table
  that `REFERENCES` **≥ 2 distinct kept tables** — the M:N junction (e.g.
  `roles(mid, aid)`, `student_course`, `cast_info`) connecting two
  already-relevant entities. The pass is evaluated against the *pre-bridge*
  kept set (no cascade ⇒ deterministic, order-independent), and the existing
  `MAX_KEPT_RATIO ≥ 0.9 → full schema` guard still bounds any over-inclusion.
- **Core value:** Engine quality, Free
- **Why:** `SK-LLM-037`'s closure follows references **out of** kept tables, so
  it pulls a fact table's parents but never the junction *between* two kept
  parents — a junction is referenced *by* nobody kept and references *down*
  into the kept set. Junctions also carry abbreviated FK columns (`mid`,
  `aid`) or use goal-absent synonyms, so the token seed misses them too. Net
  effect before this fix: ask "which actors starred in *Inception*", the
  pruner keeps `movies` + `actors` but drops `roles` — and the planner has no
  path to join them. Schema-linking for joins is the recognised small-model
  accuracy lever (RSL-SQL [arXiv:2411.00073](https://arxiv.org/abs/2411.00073)),
  and the keep-extras-over-drop-needed asymmetry
  ([arXiv:2408.07702](https://arxiv.org/abs/2408.07702)) says adding the
  junction is the safe side. The `≥ 2 distinct kept` threshold is the
  high-precision bridge signal: a one-parent child table (a detail/log row)
  stays pruned; only a table that *bridges* two relevant tables is pulled in.
- **Consequence in code:** ~6 lines in `packages/llm/src/schema-prune.ts`
  between the forward closure and the statement filter; pure + zero-dep, so
  production `/v1/ask` and the eval harness still share the function
  byte-for-byte through `buildPlanUser` (the eval-mirrors-production
  guardrail holds). **Measured (deterministic unit recall, no LLM):** on a
  7-table IMDB-shape schema where `movies`/`actors` join only through the
  abbreviated junction `roles(mid, aid)`, gold-junction recall **0 → 1** (the
  bridge goes from pruned-out to kept) while precision holds — a single-parent
  detail table (`ratings`) and the unrelated subgraph (`directors`,
  `studios`, `genres`) stay pruned. The combined BIRD/Spider EX effect lands
  on the next scheduled quality-eval (`SK-QUAL-002`); this targets the
  *mismatch* mass `SK-LLM-037` explicitly left to a follow-up.
- **Alternatives rejected:**
  - **Full reverse closure (keep every table referencing a kept table).**
    Balloons the kept set with detail/log children for no join benefit; the
    `≥ 2 distinct kept` threshold isolates the actual bridge.
  - **Lower the threshold to ≥ 1 kept reference.** That is every child table
    of a kept parent — re-inflates the prompt the pruner exists to shrink.
  - **Iterate the bridge pass to a fixpoint.** A bridge added in pass *n*
    could qualify another in *n+1*; the single-shot pre-bridge snapshot keeps
    the function deterministic and the closure bounded, and a bridge-of-bridges
    is not a shape BIRD/Spider schemas exhibit.
  - **Match junction columns by FK-target name instead of count.** Heavier
    parse (resolve every FK's target, re-tokenise) for the same outcome the
    reference count already gives.
