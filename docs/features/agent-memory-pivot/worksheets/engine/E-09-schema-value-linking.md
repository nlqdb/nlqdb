# E-09 — Schema value-linking (surface categorical column values to the planner)

**Status:** ⬜ not started — **scoped from the run-156 diagnosis** (2026-07-30)
**Sequence:** Engine 9 · **Risk:** med · **Runs:** ~2 · **Prereqs:** E-01 ✅ · **Gate:** none (all code)
**Cross-link:** `ask-pipeline`, `db-adapter`, `schema-widening`, `quality-eval` (`SK-QUAL-023`) · moves **`SK-PIVOT-016` criterion 4**

## Why this slice exists — the run-156 diagnosis

The dogfood gate's weak axis is temporal EX: **2/7** (synthetic 2/3, **ops
0/4**), the binding constraint on `SK-PIVOT-016` criterion 4. Run 156 read the
per-question generated SQL from the `SK-QUAL-023` run summary
([30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690)) and
found the misses across both corpora share **one root cause**: the planner is
given the schema as **DDL only** (`CREATE TABLE …`) and so **guesses the values
of low-cardinality categorical text columns**, always plausibly and always wrong:

| Q | Axis | Guessed | Actual | Column |
|---|------|---------|--------|--------|
| 16 | retrieval | `kind = 'question'` | `'open_question'` | `facts.kind` |
| 17 | temporal | `kind = 'question'` | `'open_question'` | `facts.kind` |
| 20 | temporal | `role = 'doc-sync'` | `'sync'` | `episodes.role` |
| 21 | forgetting | `kind = 'tracker'` | `'tracker_row'` | `facts.kind` |
| 3 | temporal | `predicate = 'current_city'` | `'city'` | `facts.predicate` |
| 18 | temporal | read `SK-ASK-011` as an `agent_id` | it is an `entities.canonical_name`, linked via `entity_facts` | — |

Q3/16/17/20/21 are pure value-guessing; Q18 is a relationship-comprehension
gap. **`PlanRequest.schema` is a single string** (`packages/llm/src/types.ts`)
and the product feeds it `db.schemaText` — DDL only (`orchestrate.ts:232`), the
same DDL-only shape the eval's `introspectSchema` produces (`tools/eval/src/runner.ts:359`).
Neither ever shows the planner a single stored value. A real dogfood agent's
`/v1/ask` hits the **exact** same wall — so this is a real product gap, not an
eval artifact.

## Why it was NOT a run-156 daily lever (the rejected shortcuts)

The faithful fix is **query-time value-linking** — sample each low-cardinality
text column's distinct values into the schema string, the textbook NL→SQL move
(DIN-SQL / DAIL-SQL / CodeS all inject column value examples; BIRD ships them).
Two shortcuts were considered and **rejected**:

- **Static vocabulary hint keyed on `isAgentMemoryV1Db`** (bake the repo-ops
  pack's `kind`/`role` values into the plan context). Rejected: the vocabulary
  is **pack-defined, not preset-defined** — a stranger's `agent_memory_v1` DB
  and the D-05 founder-ops pack use different `kind` values, so a static
  repo-ops hint would **actively mislead** every non-repo-ops memory DB. It
  also amounts to teaching-to-the-eval-fixture.
- **Improve only the eval's `introspectSchema`.** Rejected: measures a
  capability the product doesn't ship ⇒ metric-gaming.

Both fail P5/faithfulness; the honest fix touches the product hot path and
carries a perf decision, so it is a sequenced slice, not a one-run daily patch.

## Scorecard number it moves

`SK-QUAL-023` **temporal EX** (the scorecard memory-quality eval row / dogfood
criterion 4): ops 0/4 → target green. Q3/16/17/20/21 are the directly-addressable misses; Q18 needs the
relationship-hint half (Steps 2). Re-measured by the fast (~3 min) memory-eval
CI dispatch on the slice branch — no baseline overwrite (`SK-QUAL-023` is a
measurement, never canonical).

## Read first

- `docs/features/ask-pipeline/FEATURE.md` — the `/v1/ask` plan path this extends
- `docs/features/db-adapter/FEATURE.md` — where an introspection/sample query lands
- `docs/features/schema-widening/FEATURE.md` — `schemaText` / `schema_hash`
  lifecycle; a value-sample bundle must not silently churn the plan-cache key
- `docs/performance.md` — the free-tier budget the sampling must stay inside

## Mechanism (the design decision this slice must settle)

1. **Where the values come from.** Two candidates, decide in Step 1:
   - `pg_stats.most_common_vals` — a **free catalog read**, zero table scan,
     but null until `ANALYZE` has run on the (freshly-synced, small) DB ⇒
     unreliable exactly when the dogfood corpus is new.
   - Bounded `SELECT DISTINCT col … LIMIT k` per low-cardinality text column —
     always populated, but a seq scan on an unindexed `kind`/`role`; must be
     bounded (skip columns `pg_stats.n_distinct` flags high-cardinality; cap
     `k`; only on cache-miss). SQLite eval mirror uses plain `DISTINCT` (tiny
     deterministic fixtures).
   The two paths must agree so the eval stays faithful to prod.
2. **What is injected.** Append to the schema string, per low-cardinality text
   column: `-- <col> values: 'a', 'b', 'c'` (≤ k). Optionally a one-line
   relationship note for the link table (`entity_facts` joins facts↔entities)
   to close Q18.
3. **Caching / cost.** Only on plan cache-miss; wrap the sample query in a
   `nlqdb.schema.sample` OTel span (GLOBAL-014); the sampled bundle must be
   part of nothing that keys the plan cache unless deterministic.

## Steps

1. Decide the value source (Step-1 above); record it as an `SK-ASK-*` (or fold
   into `SK-QUAL-023`) with the perf rationale.
2. Product: build the sampler in `db-adapter` / `ask/build-deps.ts`; append the
   value comments to `planSchema` in `orchestrate.ts` on the cache-miss branch.
   Add the OTel span. Keep legacy (null-`schemaText`) rows working.
3. Eval: mirror the sampler in `runner.ts::introspectSchema` (SQLite `DISTINCT`)
   so the measured context matches prod — same mechanism, not a richer one.
4. Re-measure: dispatch `quality-eval-memory.yml` on the slice branch; read the
   per-axis temporal EX + mismatch diagnostic. Δ ≥ 0 keeps; Δ < 0 reverts.
5. Tests: sampler bounds (high-cardinality column skipped); comment format;
   legacy-row fallback.

## Done when

- [ ] Value comments reach the planner in prod (cache-miss) and in the eval, same mechanism.
- [ ] Bounded + OTel-spanned; free-tier budget unbroken; plan-cache key stable.
- [ ] memory-eval temporal EX re-measured up (target ops 0/4 → green); no axis regresses.
- [ ] Engine INDEX tracker + status ticked; scorecard memory-quality (`SK-QUAL-023`) row / criterion 4 updated.

## Rollback

Stop appending the value comments (one guard in `orchestrate.ts`); `schemaText`
and the plan cache are untouched. Pure additive context — no data or schema change.
