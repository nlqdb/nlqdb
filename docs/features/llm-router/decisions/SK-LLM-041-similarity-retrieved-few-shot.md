# SK-LLM-041 — Similarity-retrieved few-shot exemplar selection (DAIL-SQL retrieval half — deterministic core)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-026`](./SK-LLM-026-static-few-shot-plan-exemplars.md) (the static
3-shot `PLAN_FEW_SHOT` prefix), which shipped the *format* half of DAIL-SQL
([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)) and explicitly deferred
the *retrieval* half. Shares the [`SK-LLM-037`](./SK-LLM-037-goal-relevant-schema-pruning.md)
`wordTokens` tokenizer so the planner prompt's two pure helpers split
identifiers identically.

- **Decision:** Add `packages/llm/src/few-shot-select.ts` — a pure, zero-dep
  module that is the **deterministic core** of similarity-retrieved few-shot:
  - `maskQuestion(q)` — replace every literal value (quoted string, then bare
    number) with one `val` placeholder, so two questions differing only by
    their values read as the same skeleton ("how many X named `val`").
  - `maskedTokens(q)` — `wordTokens(maskQuestion(q))` (reuses `SK-LLM-037`).
  - `questionSimilarity(a,b)` — Jaccard overlap of the masked-token sets, in
    [0,1], symmetric; two empty/token-less sides score 0.
  - `selectExemplars(goal, pool, k)` — rank a pool of `{question, payload}`
    exemplars by masked similarity, return the top `k` most-similar first;
    **drop zero-similarity candidates** (never pad the prompt with an unrelated
    demonstration) and **break ties on pool order** (earliest wins) so
    selection is reproducible run-to-run.
  Plus, shipped 2026-06-21 as the **pool-curation masking half** — DAIL's
  schema-identifier mask layered on `maskQuestion`'s value mask (only the
  exemplar pool rows themselves stay deferred — see below):
  - `maskSchemaIdentifiers(q, schema)` — replace every question word that names
    a schema **table or column** with one `col` placeholder, reusing
    `SK-LLM-037`'s `schemaTokens`/`wordTokens` so the identifier set is
    byte-identical to what the pruner sees. Value masking alone collapses
    "albums by the artist named `val`" and "employees at the company named
    `val`" only as far as their *domain nouns* (`albums`/`artist` vs
    `employees`/`company`); masking identifiers too yields one shared skeleton
    "`col` by the `col` named `val`" — the step DAIL §4.1 names as what lets an
    exemplar match across schemas. Empty/identifier-less schema ⇒ value-only.
  - `maskWithSchema(q, schema)` — full DAIL mask: values → `val`, then
    identifiers → `col`; the skeleton a pool row + the live goal are each run
    through (against their own schema) before ranking.
  And, shipped 2026-06-21 as the **schema-aware retrieval entry point** that
  consumes the masking half (the gap it left: `maskWithSchema` had no selector,
  so a real cross-schema pool could only be ranked by hand-masking each row):
  - `SchemaExemplar<T>` — a pool row that carries its **own** `schema` (a real
    DAIL pool is one schema per `db_id`, so each row masks against the
    identifiers *it* was written over, not the live goal's).
  - `selectExemplarsForSchema(goal, goalSchema, pool, k)` — masks the goal
    against the live schema and each row against its own, then ranks via the
    same top-k core as `selectExemplars`. A cross-domain twin (different schema,
    identical skeleton) now ranks top from **raw** rows, with no caller-side
    pre-masking. `maskedTokensWithSchema` is the symmetric tokenizer.
  This is **staged ahead of two halves it does not build:** (a) the exemplar
  *pool rows* themselves — the curated BIRD-dev train-split `{question, schema,
  SQL}` records `selectExemplarsForSchema` ranks (the masking + selector both
  exist; the rows still need sourcing) plus, for the hot `plan` path, an
  embedding index — masked-token Jaccard is the offline, key-free stand-in for
  DAIL's embedding cosine; (b) wiring into `buildPlanUser` behind a per-lever
  ablation of the static `SK-LLM-026` prefix. `prompts.ts`, `PLAN_SYSTEM`, and
  the provider chain are **unchanged**.
- **Core value:** Engine quality, Free
- **Why:** The engine-quality source of truth ranks
  [§4 #1 similarity-retrieved few-shot](../../../progress/quality-score-source-of-truth.md)
  as the top reasoning lever alongside §4 #3 self-consistency, after the
  prompt-directive levers (T13–T16/T22) **saturated** on BIRD (06-19 re-run
  flat, McNemar p=0.50) and the `SK-QUAL-014` literal axis **falsified**
  value-retrieval (§4 #2) standalone. DAIL-SQL measures the retrieval half at
  **≈+3–5 pp beyond static few-shot** on small models. The **masking** step is
  the load-bearing idea ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)
  §4.1, "DAIL Selection masks domain-specific words … then ranks by the
  distance between masked-question embeddings"): without it, two structurally
  identical questions over different schemas share almost no tokens, and a
  structurally *different* question that reuses a literal scores spuriously
  high — so masked similarity is what enables **cross-domain** exemplar reuse.
  The deterministic Jaccard core is the prove-the-primitive-offline slice
  (mirrors [`SK-QUAL-017`](../../quality-eval/decisions/SK-QUAL-017-self-consistency-majority-vote.md)'s
  vote core and `SK-QUAL-014/015`): the connective tissue must exist and be
  proven before the pool + index + prod-wiring half is worth building, and it
  must not perturb the shipped chain before the next dispatch can attribute it.
- **Consequence in code:** `packages/llm/src/few-shot-select.ts` +
  `schema-prune.ts`'s exported `schemaTokens` (no new dependency) +
  `packages/llm/test/few-shot-select.test.ts` (20 cases) — including the
  **end-to-end DAIL property** three ways: (1) value-mask only, masked selection
  picks the cross-domain twin over a literal-overlap distractor; (2)
  schema-mask, two same-shape questions over *unrelated* schemas collapse to
  one identical skeleton (similarity 1, where value-only is < 1) and the twin
  outranks a same-schema row of a different shape; (3) `selectExemplarsForSchema`
  ranks that twin top from **raw** rows (each masked against its own schema
  inside the selector, no hand-masking). No production code path imports the
  module yet, so the `SK-LLM-024` greedy-decoding determinism invariant and the
  current BIRD/Spider baselines are untouched; the EX delta is measured by the
  next canonical dispatch ([`SK-QUAL-002`](../../quality-eval/decisions/SK-QUAL-002-pr-ci-never-fires-real-keys.md)
  — PR CI never fires real keys).
- **Alternatives rejected:**
  - **Wire retrieval straight into `buildPlanUser` now.** Would swap a shipped
    lever (the `SK-LLM-026` static prefix) before a per-lever ablation
    attributes it (`CLAUDE.md` §P5; the source-of-truth §6 "Next" lists that
    ablation as still pending) — contaminating the very measurement that tells
    us whether retrieval beats static. Build + prove the primitive first;
    wire + dispatch as the named follow-on.
  - **Embedding-cosine similarity in the core.** DAIL uses masked-question
    embeddings; an embedding call is a paid/keyed external dependency that
    can't run in PR CI (`SK-QUAL-002`) and would make the core non-deterministic
    (`SK-LLM-024`). Masked-token Jaccard is the zero-dep, reproducible
    stand-in; the embedding index is the prod hot-path half, staged with the
    pool.
  - **Skip masking; rank on raw question tokens.** The fixture test shows raw
    overlap picks the value-reuse distractor over the cross-domain twin — the
    exact failure masking exists to prevent (`arXiv:2308.15363` §4.1). Masking
    is not an optimisation here; it is the mechanism.
