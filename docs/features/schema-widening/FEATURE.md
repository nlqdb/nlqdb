---
name: schema-widening
description: Schema evolution — the logical schema is inferred from inserts and reads and evolves in both directions as typed, previewed, versioned operations; `schema_hash` is the version.
when-to-load:
  globs:
    - apps/api/src/db-registry.ts
    - apps/api/src/ask/orchestrate.ts
    - apps/api/src/ask/extend.ts
    - apps/api/src/ask/types.ts
    - packages/db/**
  topics: [schema, schema_hash, evolution, widening, inference, fingerprint, plan-cache]
---

# Feature: Schema Evolution

**One-liner:** The logical schema is inferred from inserts and reads and evolves in both directions (add / drop / rename / retype / index) as typed, previewed, versioned operations the engine generates — never a user-authored migration. `schema_hash` is the version.
**Status:** partial — `schema_hash` plumbed end-to-end; KPI-1 instrument live (`SK-SCHEMA-010`, null at N=0). Phase A steps 1–6 built AND wired: steps 3–4 compiler + allow-list; step 2 extend prompt/`extendSchema`; step 5 `buildWidenBatch` + `executeWidenBatch`; step 6 D1 CAS (`SK-SCHEMA-011`); step 1 COMPOSE `ask/extend.ts::extendOnWrite` + **hot-path wire** — `orchestrate.ts` Defense A falls through / Defense B absorbs a hosted write to an unobserved table, `buildAskDeps` lazily injects the wire (WASM off the cold-start graph, SK-ASK-024). Step 9 (E2E extend walk) **verified against real Postgres** (run 206, `widen-walk.integration.test.ts`, gated on `NEON_TEST_BRANCH_URL`): a first-insert to an unobserved field and to an unobserved table both land + read back on a live Neon branch, and a doomed write rolls the widen back (SK-SCHEMA-008). Remaining (`SK-SCHEMA-008`): trace parity (7) + the dogfood-workload live numerator (8, blocked on `SK-HDC-021` session-only create). Phase B: `SK-SCHEMA-009`.
**Owners (code):** `apps/api/src/ask/extend.ts`, `apps/api/src/db-registry.ts`, `apps/api/src/ask/orchestrate.ts`, `apps/api/src/ask/types.ts`, `apps/api/src/ask/plan-cache.ts`, `packages/db/**`
**Cross-refs:** docs/architecture.md §0.1 (on-ramp inversion bullets), §9 row "Schema mismatch" (line 936) · docs/phase-plan.md §1 (plan cache key — Phase 0 deliverable) · docs/performance.md §2.1 stage 4 / §2.2 stage 4 (hash compute budget — 1 ms p50 / 5 ms p99; folded into the parent span, no dedicated `nlqdb.ask.hash`) · [GLOBAL-004](../../decisions/GLOBAL-004-logical-schema-evolves.md) · [GLOBAL-006](../../decisions/GLOBAL-006-plan-cache-content-addressing.md)

## Touchpoints — read this feature before editing

- `apps/api/src/ask/extend.ts` — `extendOnWrite` compose; wired from `orchestrate.ts` Defense B via the `extendWrite` dep.
- `apps/api/src/db-registry.ts` — reads `schema_hash`; `rewriteWidenedSchema` CAS-writes it.
- `apps/api/src/ask/orchestrate.ts` — guards `/v1/ask` on `db.schemaHash != null`; Defense A/B absorb a hosted write to an unobserved table via `deps.extendWrite`.
- `apps/api/src/ask/build-deps.ts` — wires `extendWrite` (owner `buildPgClient` + lazily-imported DDL validator; SK-ASK-024).
- `apps/api/src/ask/types.ts` — `DbRecord.schemaHash: string | null` and `CachedPlan.schemaHash: string`.
- `apps/api/src/ask/plan-cache.ts` — keys cached plans by `(schemaHash, queryHash)`.

## Decisions

### SK-SCHEMA-001 — `schema_hash` is one stable string per DB; widening rewrites it

- **Decision:** Each DB has exactly one `schema_hash` at any moment, stored as a string on D1's `databases` row (column `schema_hash`, surfaced as `DbRecord.schemaHash` in TS). When the schema widens, the row is updated in place; there is no branching, no `schema_hash_v2`, no parallel pointers.
- **Core value:** Bullet-proof, Simple
- **Why:** A single stable identifier is what makes plan-cache reads exact-match safe (`GLOBAL-006`). Versioning/branching schema hashes would either invalidate the entire cache on every widen (slow) or force the cache to track multiple hashes per DB (combinatorial explosion of keys). The single-hash design is the precondition for "no cache invalidation" being a real promise.
- **Consequence in code:** `DbRecord.schemaHash` is `string | null` — `null` only on a brand-new DB before any field has been observed. After the first widen, it is non-null and stays non-null. `CachedPlan.schemaHash` is `string` (no nullable) because no plan can be cached without a schema. Anyone tempted to add `schema_hash_v2` should replace this decision with a new `SK-SCHEMA-NNN` instead.
- **Alternatives rejected:** versioned hashes (`v1.<hash>` — loses content-addressed simplicity); per-table hash list (fragments the cache key, multiplies entries).

### SK-SCHEMA-002 — Storage: single D1 column, single Worker write path

- **Decision:** `schema_hash` lives in D1's `databases.schema_hash` column. It is read by `db-registry.ts` and (when the observation pipeline lands) written by the same path that runs `ALTER TABLE ADD COLUMN ... NULL`. KV is not used: KV's eventual consistency would let plan-cache reads see a `schema_hash` that the writer thinks is current but isn't.
- **Core value:** Bullet-proof, Simple
- **Why:** D1 gives us a single linearised write surface per DB row; reads on the same Worker see writes immediately. KV would require either a versioned-write-and-poll pattern or accepting stale reads — both worse than just hitting D1 once per request (currently bundled into the existing `db-registry` query).
- **Consequence in code:** `db-registry.ts` selects `schema_hash` alongside the other DB fields in one query. New code paths that need to read or write the hash must go through `db-registry` (not bypass to KV / Workers Secret Store / env vars). Multi-Worker coordination on widening (if it becomes an issue) gets solved with a transactional update + retry, not with caching.
- **Alternatives rejected:** KV cache in front of D1 (eventual consistency lets the cached `schema_hash` disagree with the actual Postgres columns); Postgres-side storage per tenant schema (scatters the truth across N schemas; D1 is already the cross-tenant control plane).

### SK-SCHEMA-005 — Plan-cache reads survive widening unchanged

- **Decision:** When `schema_hash` widens (a new column is added), entries already in the plan cache for the previous `schema_hash` are NOT migrated, NOT invalidated, NOT touched. They remain valid for any request that still resolves to the previous hash; new requests use the new hash and get a fresh `(schema_hash, query_hash)` cache slot.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** This is the payoff of `GLOBAL-006` — the cache key is content-addressed; a hash change naturally evicts the old entry by missing on lookup. We never need to enumerate or rewrite cache entries. Cloudflare KV's 30-day TTL (`apps/api/src/ask/plan-cache.ts` `PLAN_CACHE_TTL_SECONDS`) handles eventual cleanup of orphaned old-hash entries without operator action.
- **Consequence in code:** `plan-cache.ts` has no widen-aware code paths and never should. Widening writes one D1 row; the cache catches up the next request. PRs that add cache-walk-on-widen logic should be rejected.
- **Alternatives rejected:** eagerly migrate cache entries to the new hash (expensive scan; the hash change auto-evicts on miss); TTL aligned to widen frequency (couples KV TTL to schema dynamics, fragile).

### SK-SCHEMA-006 — Empty-DB first query: explicit `schema_unavailable` until the observation pipeline lands

- **Decision:** Until the post-Phase-0 observation pipeline lands, an `/v1/ask` request against a DB with `schemaHash == null` returns the error `schema_unavailable` (`apps/api/src/ask/orchestrate.ts` line 116–119). This is the documented Phase 0 behaviour — Phase 0 testing requires a fixture row in D1's `databases` table and a schema seeded directly on Neon (`docs/phase-plan.md §1`).
- **Core value:** Bullet-proof, Honest latency
- **Why:** The implicit-create path (goal-with-no-dbId triggers schema inference + provisioner) ships in Phase 1 §4 as the "hosted db.create" slice — it requires the typed-plan validator and Neon-provisioner described in DESIGN §3.6. Bolting a partial inference into Phase 0 would create a code path that diverges from the typed-plan model and would have to be rewritten.
- **Consequence in code:** `orchestrate.ts` returns `{ status: "schema_unavailable" }` on null hash; do not change this to "infer on the fly" without landing the typed-plan path. When the observation pipeline lands, this branch becomes the bootstrap entry point; the SK-IDs gain a follow-up.
- **Alternatives rejected:**
  - Inline schema inference in Phase 0 — duplicates Phase 1's typed-plan work; throws away when the real path lands.
  - Treat null `schema_hash` as a sentinel "match-anything" hash — silently caches plans against the wrong assumption.

### SK-SCHEMA-008 — First insert creates columns; types widen, never narrow

- **Decision:** When `/v1/ask` orchestrates a write (`kind=write`) and the typed plan references a field the current `schema_hash` does not yet observe, the path is: (1) the typed-plan compiler emits an `ADD COLUMN <name> <type> NULL` ahead of the `INSERT`; (2) the row containing the new field is inserted; (3) the observation pipeline (when it lands, see `SK-SCHEMA-006` open question) recomputes `schema_hash` and writes the new value to D1's `databases.schema_hash`. The widen and the insert are in the same transaction; either both land or both roll back. Types are widened only — never narrowed without an explicit `nlq new` (`SK-SCHEMA-007`).
- **Core value:** Goal-first, Bullet-proof
- **Why:** This is the operational mechanism that lets the goal-first inversion (`docs/architecture.md §0.1`) work for writes. A user who says *"add an order: alice, latte, $5.50"* against a DB whose schema doesn't yet have a `total` column should not see a "schema mismatch" error — the column should appear, the row should land. The only way to make that bullet-proof is to bind the widen to the insert in one transaction so an error mid-way doesn't leave half-applied state. Phase 0 short-circuits this by requiring a fixture row + manually-seeded schema (`SK-SCHEMA-006`); Phase 1's hosted-db-create + write path is what wires the full mechanism.
- **Consequence in code:** The write orchestrator (`apps/api/src/ask/orchestrate.ts` write branch, post-Phase-0) wraps `ADD COLUMN` + `INSERT` in a single transaction via the Neon HTTP transactional API. The typed-plan compiler (`apps/api/src/db-create/compile-ddl.ts` already exists for create; an analogous `compile-write-ddl.ts` covers the widen-on-write case) is the only path that emits `ALTER TABLE ADD COLUMN`. Direct LLM-emitted DDL on this path is rejected by the `sql-validate.ts` allow-list (`SK-SQLAL-002` rejects `ALTER`); the widen happens via the same typed-plan path that the create flow uses. PRs that introduce a write code path emitting `ADD COLUMN` without a transaction wrapper will be rejected.
- **Alternatives rejected:** reject unknown-field writes → "schema mismatch" (defeats the goal-first promise, `docs/architecture.md §0.1`; a two-step ceremony per first-write); add the column outside the transaction then insert (a window where the column exists with no rows, and a mid-way failure leaves schema/data inconsistent); type narrowing on widen (silently invalidates cached plans bound to the old type — a retype is a previewed proposal, `SK-SCHEMA-009`).

---

### SK-SCHEMA-009 — Schema evolution is a first-class typed, previewed, versioned operation generated by the engine

- **Decision:** Every logical schema change — `add_column`, `drop_column`, `rename_column`, `retype_column`, `create_table`, plus the physical `create_index` / `drop_index` — is a **typed operation the engine generates** from inserts, reads and workload statistics, never a user-authored migration. Add-on-write applies inline (`SK-SCHEMA-008`); every other operation lands as a proposal with a before/after diff (`GLOBAL-023`) and applies in **one click**, with the inverse recorded before apply so undo is one click too. Each logical apply rewrites `schema_hash` (the version); index operations never do. A field that vanished from every write and read is a **versioned narrowing event**: dependent cached plans evict by miss and re-plan; it is a hard-stop only while an active read still references the field.
- **Core value:** Goal-first, Bullet-proof, Simple
- **Why:** The product promise is no data modeling by the developer (`GLOBAL-041`). Widen-only forced `nlq new` on every real schema break and a "vanished field" error on every out-of-band change — both are the modeling chore the bet removes. Making the operation typed keeps the LLM out of DDL (`GLOBAL-037`: JSON plan in, deterministic compiler out) and makes preview + undo mechanical.
- **Consequence in code:** One typed union `SchemaOp` compiled by one deterministic DDL compiler (`compile-write-ddl.ts`, mirroring `compile-ddl.ts`) is the only emitter of evolution DDL; `sql-validate-ddl.ts` accepts exactly what it emits. Proposals live in the optimizer's proposal table with reasoning, impact and inverse (`SK-MIGRATE-003`); apply runs under `SK-HDC-010` timeouts with an `Idempotency-Key` (`GLOBAL-005`) and an OTel span (`GLOBAL-014`), then rewrites `schema_text` / `schema_hash` in D1. No `apps/api/src/migrations/` for user DBs, ever. KPI 2 (`GLOBAL-041`) counts every absorbed change vs every error / fresh DB.
- **Alternatives rejected:** widen-only + `nlq new` for breaks (the prior `SK-SCHEMA-003/004/007` — the chore the bet removes); user-authored migration files (couples current schema to change-history, puts modeling back on the developer); silent in-place evolution without preview (a rename/drop nobody saw is a data-loss incident; the diff + undo is what makes acting safe).

### SK-SCHEMA-010 — KPI-1 instrument: two non-saturating per-DB extend counters

- **Decision:** The `GLOBAL-041` headline KPI 1 (first-insert inference rate) is instrumented by two non-saturating counters on D1's `databases` row — `asks_extend_ok` (numerator) and `asks_extend_failed` (denominator less numerator) — the `SK-GTM-011` counter shape reused for the engine. The orchestrator flags an ask as extend-needed (`OrchestrateOutcome.extendNeeded`) when a **write** plan references an **unobserved table** — caught pre-flight (`checkSchemaTables`, Defense A) or at exec (`42P01`, Defense B; an orphaned tenant schema — `3F000` or its `SK-ASK-019` message-matched fallback — is a control-plane fault widen-on-write cannot absorb, so it is excluded). `apps/api/src/index.ts` `bumpAskCounters` bumps `asks_extend_ok` when such a write is absorbed inline and `asks_extend_failed` when it is rejected, folded into the same fire-and-forget UPDATE as the other ask counters, stranger-walker-excluded. `computeGtmMetrics` surfaces `engine.firstInsertInferenceRate = extendOk / (extendOk + extendFailed)` (null at N = 0). The numerator stays 0 until Phase A's `kind=extend` routing lands ([`GLOBAL-041` Phase A](../../decisions/GLOBAL-041-autonomous-dba.md) steps 1-6): the rate then climbs off its honest floor with no further instrument change.
- **Core value:** Bullet-proof, Honest latency
- **Why:** "No change without a number" makes the KPI the precondition for the lever it measures — the instrument exists before the path so its effect is measurable on day one. Scoping the v1 denominator to **writes referencing an unseen table** (not reads, which are planning misses; column-level `42703` adds join it with the Phase A routing) keeps it well-defined — a table that doesn't exist is the unambiguous "first insert creates the shape" case. A saturating counter (`first10_*`, `SK-GTM-011`) would freeze the denominator and lie about the rate.
- **Consequence in code:** `extendNeeded` is set only for the write case. Migration `0035` adds both columns (`DEFAULT 0`). When Phase A adds the `kind=extend` success path it sets `extendNeeded` on the ok outcome (on the committed hop only — never the `SK-TRUST-001` preview hop, which would double-count) — the only change needed for `asks_extend_ok` to start counting. Column-level extend demand (`42703` on a write) joins the denominator when the Phase A router classifies it; until then it is out of scope, not miscounted.
- **Alternatives rejected:** reusing `first10_ok/asks` (saturates at 10, no extend/read split); counting all `schema_mismatch` incl. reads (pollutes the denominator with hallucinations widen-on-write never absorbs); a separate D1 UPDATE per extend event (a round-trip for a counter that rides the ask-completion write for free).

### SK-SCHEMA-011 — After a widen commits, `schema_hash` is `fingerprintSchema` over the new `schema_text`

- **Decision:** When a widen-on-write transaction commits (`SK-SCHEMA-008`, step 5), step 6 catches the persisted schema up so the next `/v1/ask` plans against the widened shape. `widen-provision.ts::widenedSchema` sets the new `schema_text` = old DDL with the widen's `ADD COLUMN` / `CREATE TABLE` appended (`compile-write-ddl.ts` is the single deterministic emitter, so re-compiling reproduces the statements the transaction ran) and the new `schema_hash` = `fingerprintSchema(newSchemaText)` — **the rule the BYO render path already uses** (`schema-fingerprint.ts`). `db-registry.ts::rewriteWidenedSchema` writes both via a compare-and-swap `UPDATE … WHERE schema_hash = <observed>` on the same single D1 surface `resolveDb` reads (`SK-SCHEMA-002`).
- **Core value:** Simple, Bullet-proof
- **Why:** The widen path never holds the original `SchemaPlan`, so it can't reproduce the create-time hash; the DDL text is what D1 already stores and what the BYO path fingerprints, so hashing it needs no new state and any DDL change moves the hash — all `SK-SCHEMA-001` asks of the version. The CAS resolves the multi-Worker race: a concurrent widen that moved the hash first makes the write a no-op and the loser re-observes; widening is monotonic, so a lost CAS costs one observation cycle, never data loss.
- **Consequence in code:** `widenedSchema` is pure (unit-tested, no D1); `rewriteWidenedSchema` returns `{ updated }` so the routing wire-in (step 1) knows whether to re-read. Old cache entries evict by miss (`SK-SCHEMA-005`). A create-then-widen DB and a directly-created one with the same logical schema can hold different hashes (plan-JSON vs DDL-text fingerprint) — a cross-DB cache-sharing cost only, accepted rather than re-hashing every live create-time entry.
- **Alternatives rejected:** re-derive the `SchemaPlan` JSON to re-hash (state the widen path doesn't keep); last-write-wins `UPDATE` with no CAS (a lost update persists a hash whose columns another widen replaced).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-041** — Autonomous DBA; this feature is Phase A (widen-on-write) and the logical half of Phase B.
- **GLOBAL-004** — The logical schema is inferred and evolves in both directions; physical layout reshapes freely.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.

## Open questions / known unknowns

- **Hash construction after a widen — decided (`SK-SCHEMA-011`):** `fingerprintSchema(newSchemaText)`, the same rule the BYO render path uses. Create-time keeps FNV-1a over `JSON.stringify(plan)` (`build-deps.ts::defaultSchemaHash`); the divergence is accepted (cache-sharing only, never correctness).
- **Multi-Worker write race — decided (`SK-SCHEMA-011`):** the step-6 D1 write is a compare-and-swap `UPDATE … WHERE schema_hash = <observed>`; overlapping widens converge, the loser re-observes. Widening is monotonic, so a lost CAS costs one observation cycle, never data loss.
- **Field-type evolution — decided:** a retype is a versioned proposal (`SK-SCHEMA-009`); an out-of-band type change seen by introspection is absorbed as a narrowing event, hard-stop only while an active read still binds the old type.
- **BYO Postgres edge cases — accept as-is, widen forward** (resolved per `GLOBAL-033`, goal-first → never refuse the user's DB). A user-managed DB doesn't go through the typed-plan compiler, so widening is observation-only: baseline whatever schema they have, only add fields. **Parked until** the Phase 4 BYO-connect slice; shape is locked.
