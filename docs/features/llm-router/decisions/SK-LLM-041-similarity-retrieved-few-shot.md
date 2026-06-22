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
  And, shipped 2026-06-21 as the **curated pool rows** half (a) —
  `plan-exemplar-pool.ts`: `PLAN_EXEMPLAR_POOL`, hand-authored
  `{question, schema, SQL}` `PlanExemplar`s (one per `SK-QUAL-014` structural
  mismatch bucket — group-by-count, HAVING, COUNT(DISTINCT), scalar/IN subquery,
  **anti-join (NOT IN, NULL-guarded)**, join-aggregate, group-max,
  **group-order-limit (top-N of an aggregate)**, **order-by-limit (plain top-N,
  no aggregation)**, NULL-safe-min,
  **null-filter (plain `WHERE col IS NULL`)**, REAL-cast ratio,
  date-range — **14 rows, grown 2026-06-22** from the initial 10: +anti-join and
  +group-order-limit (two high-mass `SK-QUAL-014` shapes the pool could not
  demonstrate at all — negation, order-by-aggregate-limit), then +null-filter and
  +order-by-limit on a **second** evidence source — the persona-bench
  (`SK-QUAL-018`) ICP-retrieval probe (see Consequence): nlqdb's own "who never
  logged in" query (`personas.md` §P1) retrieved the anti-join NOT-IN demo, the
  wrong shape for a plain `IS NULL` filter; and the most common ICP dashboard
  shape — plain top-N ("the 10 most recent signups") — retrieved
  `group-order-limit`, teaching a spurious `GROUP BY` a plain `ORDER BY … LIMIT`
  doesn't have), each
  `payload` rendered through the now-exported `prompts.ts::planExample` so a
  retrieved demonstration is byte-identical in shape to a static `SK-LLM-026`
  one, plus `retrievePlanExemplars(goal, schema, k)` (thin wrapper over
  `selectExemplarsForSchema` so a caller imports one symbol). These are
  hand-authored, **not** the BIRD train split — that is an external,
  download-/key-gated dataset not in the repo; an embedding-indexed BIRD pool is
  the prod hot-path follow-on. The pool's retrieval is proven offline (see
  Consequence).
  And, shipped 2026-06-21 as **half (b)** — the **per-lever T9 ablation** that
  wires the pool into the provider chain — `plan-exemplar-pool.ts::buildPlanSystem(goal, schema, k)`:
  the static `SK-LLM-026` few-shot prefix lives in the planner **system** prompt
  (`PLAN_SYSTEM`), so the ablation belongs there, not in `buildPlanUser`.
  `buildPlanSystem` returns `PLAN_SYSTEM` **byte-for-byte** when `k <= 0` (every
  production call — `PlanRequest.retrieveExemplars` is unset, like `temperature`
  for `SK-QUAL-017`) and swaps the static prefix for the `k` retrieved exemplars
  (rendered through the shared `fewShotBlock`, so the swapped prefix is
  byte-identical in shape) when `k > 0`; a goal that retrieves nothing falls back
  to the static prefix. `_chat-provider.ts` calls it with `req.retrieveExemplars
  ?? 0`, and the eval's `--retrieve-exemplars k` flag threads `k` into every
  `plan()` request (greedy + self-consistency paths), so the next dispatch runs
  greedy-static vs greedy-retrieved as an A/B. **Still not built:** the hot
  `plan`-path embedding index over a larger pool (masked-token Jaccard is the
  offline, key-free stand-in for DAIL's embedding cosine). Production output is
  **unchanged** — `retrieveExemplars` is never set off the eval, so `PLAN_SYSTEM`
  + the greedy decode are byte-identical (`SK-LLM-024` + the `SK-LLM-009` cache
  prefix intact).
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
  inside the selector, no hand-masking). Plus `plan-exemplar-pool.ts` +
  `plan-exemplar-pool.test.ts`: an **offline retrieval measurement**
  over a held-out probe set (each probe a paraphrase of one bucket over a
  *different* schema) records **precision@1 = 14/14** (every probe retrieves its
  intended structural bucket across domains — **held at 1.0 across the 2026-06-22
  pool growth to four near-neighbour buckets** — anti-join, group-order-limit,
  null-filter, order-by-limit — the harder regime) and **lift = +0.576** — masked
  skeleton-similarity of the top-1 retrieved exemplar **0.818** vs **0.242** for
  an uninformed pool-average pick, the offline analog of DAIL's measured
  retrieval win, proving the pool+selector is worth a dispatch before paying for
  one. The 2026-06-22 growth records two **same-probe before/after coverage
  deltas** (the `SK-LLM-036/037` pattern): (1) a "…have never …" goal retrieved
  the *positive* in-subquery demo (the un-negated shape — the wrong lesson)
  **before** the `anti-join` row existed and the NOT-IN demo **after**; (2) a
  "never logged in" goal (a NULL **attribute** of the row, not a missing
  **relation**) retrieved the anti-join NOT-IN demo **before** the `null-filter`
  row existed and the `IS NULL` demo **after** — while the positive in-subquery
  probe still retrieves in-subquery and a "never <relation>" goal still retrieves
  anti-join (the bidirectional masking guards — masked Jaccard keeps the
  skeletons separable; the discriminating token is the verb, not "never").
  **Second evidence source — persona-bench ICP retrieval** (`tools/eval/test/persona-retrieval.test.ts`,
  the `SK-LLM-041 × SK-QUAL-018` bridge): running `retrievePlanExemplars` over
  the **20 persona-bench (`SK-QUAL-018`) ICP questions** — nlqdb's OWN target
  distribution, not synthetic probes — scores **precision@1 18/20**
  against a per-question expected-bucket map: the null-filter row flips q3 ("who
  never logged in") off the misleading anti-join demo, and the order-by-limit row
  lands q0 ("the 10 most recent signups") on the plain `ORDER BY … LIMIT` demo —
  the expected-bucket map for q0 was tightened to drop the `group-order-limit`
  GROUP-BY stand-in it previously tolerated (17/20 under the corrected contract
  *without* the row → 18/20 *with* it). The 2 remaining
  misses (q8, "the 5 most-recalled facts …"; q10, "which predicates does
  'support-bot' use, and how often" — a filtered GROUP-BY-COUNT with NO HAVING
  whose top-1 is the `having` demo) are **documented, not absorbed**: both are
  *selector*-side artifacts (the right buckets exist), so the fix is
  query-skeleton similarity (DAIL §4.1's second variant), out of scope for a
  pool-row add. Half (b) adds `buildPlanSystem` + `prompts.ts`'s exported `PLAN_DIRECTIVES`
  / `PLAN_FEW_SHOT_HEADER` / `fewShotBlock` (the static `PLAN_FEW_SHOT` rebuilt
  through `fewShotBlock`, byte-identical) + the `_chat-provider.ts` system-prompt
  call + the eval `--retrieve-exemplars` flag (`runner.ts`), with 4 new
  `plan-exemplar-pool.test.ts` cases (off-path byte-identity for `k ∈ {0,-1,NaN}`;
  swap-on-`k`; no-match fallback; **token budget**) and 1 `runner.test.ts` case
  (the flag threads `k` into every `plan()` request; unset ⇒ never present). The
  **token-budget finding**: the retrieved `k=3` prefix is **3225 chars vs the
  static 3448** (0.935×) — retrieval is token-*negative*, so it carries no extra
  prompt cost into a dispatch. Production output is **byte-identical** —
  `retrieveExemplars` is never set off the eval, so `PLAN_SYSTEM` + greedy decode
  + the BIRD/Spider baselines are untouched; the EX delta (greedy-static vs
  greedy-retrieved) is measured by the next canonical dispatch
  ([`SK-QUAL-002`](../../quality-eval/decisions/SK-QUAL-002-pr-ci-never-fires-real-keys.md)
  — PR CI never fires real keys, and forbids a back-to-back dispatch while a
  baseline is < 7 days old).
- **Alternatives rejected:**
  - **Flip production's default to retrieval now (no ablation toggle).** Would
    swap a shipped lever (the `SK-LLM-026` static prefix) before a dispatch
    attributes it (`CLAUDE.md` §P5) — contaminating the very measurement that
    tells us whether retrieval beats static. `buildPlanSystem` is the **gated
    ablation** instead: default off (prod byte-identical), on only under the
    eval's `--retrieve-exemplars` dispatch, so the A/B is clean. Prod adopts
    retrieval only after the dispatch shows an EX gain.
  - **Inject retrieved exemplars into `buildPlanUser` (the user prompt),
    additive on top of the static prefix.** The static `SK-LLM-026` prefix
    lives in the **system** prompt; appending retrieved demos to the user prompt
    would show the model two few-shot blocks in two positions and measure
    "static + retrieved", not "retrieved vs static". The ablation *replaces* the
    system-prompt prefix so the dispatch isolates retrieval's effect.
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
