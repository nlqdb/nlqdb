# SK-LLM-037 — Goal-relevant schema pruning in the planner prompt (recall-first, table-granular)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). The conservative
slice of the schema-linking lever the engine-quality tracker ranked top of
its backlog (`quality-score-source-of-truth.md` §4 #2); value retrieval
(sample cell-values) stays a separate future lever.

- **Decision:** `buildPlanUser` (`packages/llm/src/prompts.ts`) prunes the
  schema it embeds via the new pure `pruneSchemaForGoal(schema, goal)`
  (`packages/llm/src/schema-prune.ts`): keep every `CREATE TABLE`/`VIEW`
  whose table-name or column-name word-tokens overlap the goal's tokens,
  then close the join graph to a fixpoint both ways — a kept table's
  `REFERENCES` parents, **plus** any bridge table that references two-or-more
  kept tables (the many-to-many link a token match never reaches, e.g.
  `enrolments(sid→students, cid→courses)` for "courses per student"; ≥2 kept
  references bounds it to genuine bridges) — so kept joins stay plannable, and
  send the **full** schema whenever pruning is not a clear win — schema
  < 2000 chars, < 5 tables, zero matches, kept ratio ≥ 0.9, unparseable
  DDL, or a **retry** (`previousAttempt` set — the failed attempt is the
  case where pruning may have hidden the needed table).
- **Core value:** Engine quality, Free
- **Why:** Two mechanisms, both literature-backed. (1) *Distractor removal*:
  schema linking — sending only goal-relevant schema — is a recognised
  accuracy lever for small models (C3-SQL [arXiv:2307.07306](https://arxiv.org/abs/2307.07306),
  RSL-SQL [arXiv:2411.00073](https://arxiv.org/abs/2411.00073)). (2)
  *Capacity*: the free chain's verified binding constraint is per-minute TPM
  (`quality-score-source-of-truth.md` §5), and the schema is the dominant
  variable prompt term. The risk is the known one — pruning out a needed
  table hurts far more than keeping extras ([arXiv:2408.07702](https://arxiv.org/abs/2408.07702)
  measures the asymmetry) — so every guard errs toward the full schema, and
  the design was verified offline before shipping: against all 500 BIRD
  Mini-Dev questions it prunes 27.8% of prompts (−7.1% schema chars) with
  **99.8% gold-table recall** (1 miss, recovered by the full-schema retry
  path; the bridge rule only ever *adds* tables, so it cannot lower that
  recall — a synthetic multi-hop suite confirms it lifts join-path table
  recall 4/6 → 6/6 where parent-only closure dropped the link tables);
  against all 135 Spider 2.0-lite SQLite questions it prunes 67.4%
  (−26.5% schema chars; no gold SQL exists to check recall there — the
  guards + retry bound the risk). Production `db.create` schemas are
  typically under both floors, so `/v1/ask` behaviour only changes for
  genuinely large schemas.
- **Consequence in code:** `schema-prune.ts` is pure + zero-dep; both
  production `/v1/ask` and the eval harness share it through the one
  `buildPlanUser` choke point (the eval-mirrors-production guardrail holds
  by construction). The plan-cache key (`schema_hash`) is computed upstream
  and unaffected. Tests pin the keep/closure/fallback behaviours; the
  combined EX effect is measured on the next smoke dispatch (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **Column-level pruning (M-Schema).** Larger gain ceiling but the recall
    failure mode is per-column and much harder to bound offline; table-level
    with FK closure is the slice whose worst case (1/500 on BIRD) is
    measured. Revisit if the measured table-level delta justifies it
    (`CLAUDE.md` §P5).
  - **LLM-based linking (an extra `schema_link` call).** Spends the scarce
    resource (free-tier per-minute quota) to save it; a deterministic token
    overlap is free and auditable.
  - **Pruning in the eval runner only.** Breaks the eval-mirrors-production
    guardrail — the eval would measure a system we don't ship.
  - **Embedding/similarity retrieval over schema elements.** A new dependency
    and an index hop on the hot path for marginal gain over token overlap at
    BIRD/Spider schema sizes (`GLOBAL-016` small-mature-packages bar not met
    for the critical path).
