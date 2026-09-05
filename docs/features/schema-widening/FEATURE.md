---
name: schema-widening
description: Schema evolution — the logical schema is inferred from inserts and reads and evolves in both directions as typed, previewed, versioned operations; `schema_hash` is the version.
when-to-load:
  globs:
    - apps/api/src/db-registry.ts
    - apps/api/src/ask/orchestrate.ts
    - apps/api/src/ask/types.ts
    - packages/db/**
  topics: [schema, schema_hash, evolution, widening, inference, fingerprint, plan-cache]
---

# Feature: Schema Evolution

**One-liner:** The logical schema is inferred from inserts and reads and evolves in both directions (add / drop / rename / retype / index) as typed, previewed, versioned operations the engine generates — never a user-authored migration. `schema_hash` is the version.
**Status:** partial — `schema_hash` is plumbed end-to-end (D1 → registry → orchestrator → plan-cache key); the KPI-1 instrument is live (`SK-SCHEMA-010` — `asks_extend_ok`/`asks_extend_failed`, surfaced as `engine.firstInsertInferenceRate`, floor at 0 until the path lands); widen-on-write (`SK-SCHEMA-008`) is Phase A of `GLOBAL-041`, drop / rename / retype / index proposals (`SK-SCHEMA-009`) are Phase B.
**Owners (code):** `apps/api/src/db-registry.ts`, `apps/api/src/ask/orchestrate.ts`, `apps/api/src/ask/types.ts`, `apps/api/src/ask/plan-cache.ts`, `packages/db/**`
**Cross-refs:** docs/architecture.md §0.1 (on-ramp inversion bullets), §9 row "Schema mismatch" (line 936) · docs/phase-plan.md §1 (plan cache key — Phase 0 deliverable) · docs/performance.md §2.1 stage 4 / §2.2 stage 4 (hash compute budget — 1 ms p50 / 5 ms p99; folded into the parent span, no dedicated `nlqdb.ask.hash`) · [GLOBAL-004](../../decisions/GLOBAL-004-logical-schema-evolves.md) · [GLOBAL-006](../../decisions/GLOBAL-006-plan-cache-content-addressing.md)

## Touchpoints — read this feature before editing

- `apps/api/src/db-registry.ts` — reads `schema_hash` from D1's `databases` row.
- `apps/api/src/ask/orchestrate.ts` — guards `/v1/ask` on `db.schemaHash != null`.
- `apps/api/src/ask/types.ts` — `DbRecord.schemaHash: string | null` and `CachedPlan.schemaHash: string`.
- `apps/api/src/ask/plan-cache.ts` — keys cached plans by `(schemaHash, queryHash)`.
- `packages/db/**` — the place a future widening trigger would emit `ALTER TABLE ADD COLUMN`.

## Decisions

### SK-SCHEMA-001 — `schema_hash` is one stable string per DB; widening rewrites it

- **Decision:** Each DB has exactly one `schema_hash` at any moment, stored as a string on D1's `databases` row (column `schema_hash`, surfaced as `DbRecord.schemaHash` in TS). When the schema widens, the row is updated in place; there is no branching, no `schema_hash_v2`, no parallel pointers.
- **Core value:** Bullet-proof, Simple
- **Why:** A single stable identifier is what makes plan-cache reads exact-match safe (`GLOBAL-006`). Versioning/branching schema hashes would either invalidate the entire cache on every widen (slow) or force the cache to track multiple hashes per DB (combinatorial explosion of keys). The single-hash design is the precondition for "no cache invalidation" being a real promise.
- **Consequence in code:** `DbRecord.schemaHash` is `string | null` — `null` only on a brand-new DB before any field has been observed. After the first widen, it is non-null and stays non-null. `CachedPlan.schemaHash` is `string` (no nullable) because no plan can be cached without a schema. Anyone tempted to add `schema_hash_v2` should replace this decision with a new `SK-SCHEMA-NNN` instead.
- **Alternatives rejected:**
  - Versioned hashes (`v1.<hash>`) — buys nothing, loses content-addressed simplicity.
  - Per-table hash list — fragments the cache key, multiplies entries.

### SK-SCHEMA-002 — Storage: single D1 column, single Worker write path

- **Decision:** `schema_hash` lives in D1's `databases.schema_hash` column. It is read by `db-registry.ts` and (when the observation pipeline lands) written by the same path that runs `ALTER TABLE ADD COLUMN ... NULL`. KV is not used: KV's eventual consistency would let plan-cache reads see a `schema_hash` that the writer thinks is current but isn't.
- **Core value:** Bullet-proof, Simple
- **Why:** D1 gives us a single linearised write surface per DB row; reads on the same Worker see writes immediately. KV would require either a versioned-write-and-poll pattern or accepting stale reads — both worse than just hitting D1 once per request (currently bundled into the existing `db-registry` query).
- **Consequence in code:** `db-registry.ts` selects `schema_hash` alongside the other DB fields in one query. New code paths that need to read or write the hash must go through `db-registry` (not bypass to KV / Workers Secret Store / env vars). Multi-Worker coordination on widening (if it becomes an issue) gets solved with a transactional update + retry, not with caching.
- **Alternatives rejected:**
  - KV cache in front of D1 — eventual consistency creates a window where the `schema_hash` in cache disagrees with the columns that actually exist in Postgres.
  - Postgres-side storage (a `_nlqdb_schema_meta` table per tenant schema) — scatters the truth across N tenant schemas; D1 is already the cross-tenant control plane.

### SK-SCHEMA-005 — Plan-cache reads survive widening unchanged

- **Decision:** When `schema_hash` widens (a new column is added), entries already in the plan cache for the previous `schema_hash` are NOT migrated, NOT invalidated, NOT touched. They remain valid for any request that still resolves to the previous hash; new requests use the new hash and get a fresh `(schema_hash, query_hash)` cache slot.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** This is the payoff of `GLOBAL-006` — the cache key is content-addressed; a hash change naturally evicts the old entry by missing on lookup. We never need to enumerate or rewrite cache entries. Cloudflare KV's 30-day TTL (`apps/api/src/ask/plan-cache.ts` `PLAN_CACHE_TTL_SECONDS`) handles eventual cleanup of orphaned old-hash entries without operator action.
- **Consequence in code:** `plan-cache.ts` has no widen-aware code paths and never should. Widening writes one D1 row; the cache catches up the next request. PRs that add cache-walk-on-widen logic should be rejected.
- **Alternatives rejected:**
  - Eagerly migrate cache entries to the new hash — expensive scan; unnecessary because the hash change auto-evicts on miss.
  - Set explicit TTL aligned to widen frequency — couples KV TTL to schema dynamics, fragile.

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
- **Alternatives rejected:**
  - Reject writes that reference unknown fields → "schema mismatch" error — defeats the goal-first promise (`docs/architecture.md §0.1`); makes every first-write a two-step ceremony for the user.
  - Add the column outside the transaction, then insert separately — leaves a window where the column exists with no rows referencing it, and a failure mid-way leaves the schema inconsistent with the data the user thought they were writing.
  - Type narrowing on widen (e.g. user inserts `{ total: 5 }` then `{ total: "free" }`, narrow to `text`) — silently invalidates every cached plan that bound `total` as `numeric`. A retype is a previewed proposal (`SK-SCHEMA-009`), never a silent narrowing.

---

### SK-SCHEMA-009 — Schema evolution is a first-class typed, previewed, versioned operation generated by the engine

- **Decision:** Every logical schema change — `add_column`, `drop_column`, `rename_column`, `retype_column`, `create_table`, plus the physical `create_index` / `drop_index` — is a **typed operation the engine generates** from inserts, reads and workload statistics, never a user-authored migration. Add-on-write applies inline (`SK-SCHEMA-008`); every other operation lands as a proposal with a before/after diff (`GLOBAL-023`) and applies in **one click**, with the inverse recorded before apply so undo is one click too. Each logical apply rewrites `schema_hash` (the version); index operations never do. A field that vanished from every write and read is a **versioned narrowing event**: dependent cached plans evict by miss and re-plan; it is a hard-stop only while an active read still references the field.
- **Core value:** Goal-first, Bullet-proof, Simple
- **Why:** The product promise is no data modeling by the developer (`GLOBAL-041`). Widen-only forced `nlq new` on every real schema break and a "vanished field" error on every out-of-band change — both are the modeling chore the bet removes. Making the operation typed keeps the LLM out of DDL (`GLOBAL-037`: JSON plan in, deterministic compiler out) and makes preview + undo mechanical.
- **Consequence in code:** One typed union `SchemaOp` compiled by one deterministic DDL compiler (`compile-write-ddl.ts`, mirroring `compile-ddl.ts`) is the only emitter of evolution DDL; `sql-validate-ddl.ts` accepts exactly what it emits. Proposals live in the optimizer's proposal table with reasoning, impact and inverse (`SK-MIGRATE-003`); apply runs under `SK-HDC-010` timeouts with an `Idempotency-Key` (`GLOBAL-005`) and an OTel span (`GLOBAL-014`), then rewrites `schema_text` / `schema_hash` in D1. No `apps/api/src/migrations/` for user DBs, ever. KPI 2 (`GLOBAL-041`) counts every absorbed change vs every error / fresh DB.
- **Alternatives rejected:**
  - Widen-only + `nlq new` for breaks (the prior `SK-SCHEMA-003/004/007`) — the exact chore the bet removes.
  - User-authored migration files — couples "current schema" to "history of changes" and puts modeling back on the developer.
  - Silent in-place evolution without preview — a rename or drop nobody saw is a data-loss incident; the diff + undo is what makes acting safe.

### SK-SCHEMA-010 — KPI-1 instrument: two non-saturating per-DB extend counters

- **Decision:** The `GLOBAL-041` headline KPI 1 (first-insert inference rate) is instrumented by two non-saturating counters on D1's `databases` row — `asks_extend_ok` (numerator) and `asks_extend_failed` (denominator less numerator) — the `SK-GTM-011` counter shape reused for the engine. The orchestrator flags an ask as extend-needed (`OrchestrateOutcome.extendNeeded`) when a **write** plan references an **unobserved table** — caught pre-flight (`checkSchemaTables`, Defense A) or at exec (`42P01`, Defense B; a `3F000` orphaned tenant schema is a control-plane fault widen-on-write cannot absorb, so it is excluded). `apps/api/src/index.ts` `bumpAskCounters` bumps `asks_extend_ok` when such a write is absorbed inline and `asks_extend_failed` when it is rejected, folded into the same fire-and-forget UPDATE as the other ask counters, stranger-walker-excluded. `computeGtmMetrics` surfaces `engine.firstInsertInferenceRate = extendOk / (extendOk + extendFailed)` (null at N = 0). The numerator stays 0 until Phase A's `kind=extend` routing lands ([`pivot-autonomous-dba.md` §4](../../pivot-autonomous-dba.md) steps 1-6): the rate then climbs off its honest floor with no further instrument change.
- **Core value:** Bullet-proof, Honest latency
- **Why:** "No change without a number" (the `/daily` loop) makes the KPI the precondition for building the lever it measures — the instrument must exist before the widen-on-write path so the path's effect is measurable on day one. Scoping the v1 denominator to **writes referencing an unseen table** (not reads, which are planning misses, and not yet column-level `42703` adds, which land classified with the Phase A routing) keeps it well-defined: a table that doesn't exist is the unambiguous "first insert creates the shape" case. A saturating counter (the `first10_*` mistake, `SK-GTM-011`) would freeze the denominator and lie about the rate.
- **Consequence in code:** `extendNeeded` is set only for the write case. Migration `0035` adds both columns (`DEFAULT 0`). When Phase A adds the `kind=extend` success path it sets `extendNeeded` on the ok outcome (on the committed hop only — never the `SK-TRUST-001` preview hop, which would double-count) — the only change needed for `asks_extend_ok` to start counting. Column-level extend demand (`42703` on a write) joins the denominator when the Phase A router classifies it; until then it is out of scope, not miscounted.
- **Alternatives rejected:**
  - Reusing `first10_ok/asks` — saturates at 10 and carries no extend/read split; can't express the rate.
  - Counting all `schema_mismatch` (reads included) — pollutes the denominator with LLM hallucinations that widen-on-write would never absorb.
  - A separate D1 UPDATE per extend event — a second round-trip for a counter that rides the existing ask-completion write for free.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-041** — Autonomous DBA; this feature is Phase A (widen-on-write) and the logical half of Phase B.
- **GLOBAL-004** — The logical schema is inferred and evolves in both directions; physical layout reshapes freely.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.

## Open questions / known unknowns

- **Hash construction algorithm (plan-level, Phase 0/1)** — Decided: FNV-1a 32-bit over `JSON.stringify(plan)` (see `apps/api/src/db-create/build-deps.ts::defaultSchemaHash`). Non-cryptographic; stable across calls; 8 hex chars. When the *observation pipeline* lands and the hash must reflect observed-fields separately from the full plan, that hash function gets its own `SK-SCHEMA-NNN` decision (the trade-off: field-sorted-name vs type-aware widening still applies there).
- **Observation pipeline — push-based, parked until the typed-plan validator slice** (resolved per `GLOBAL-033`, Simple → one way / reuse what's built). The orchestrator currently rejects null-hash DBs (`SK-SCHEMA-006`). Widening rides the typed-plan compiler that already produces the plan (`docs/phase-plan.md §2` — the Phase 1 vehicle): the compiler emits the widen on the same path, rather than standing up a separate `information_schema` poller to pull-introspect. **Parked until** that slice lands — the only code path that can write observed fields into D1.
- **Field-type evolution — decided:** a retype is a versioned proposal (`SK-SCHEMA-009`); an out-of-band type change seen by introspection is absorbed as a narrowing event, hard-stop only while an active read still binds the old type.
- **BYO Postgres edge cases — accept as-is, widen forward** (resolved per `GLOBAL-033`, goal-first → never refuse the user's DB). A user-managed DB doesn't go through the typed-plan compiler, so widening is observation-only: we take whatever schema they have as the baseline and only add fields, never rejecting a DB for not fitting our model. **Parked until** the Phase 4 BYO-connect slice; shape is locked.
- **Multi-Worker write race** — Resolved shape per `GLOBAL-033` (bullet-proof → make the bad state unreachable, not caught): D1's single-writer semantics plus a transactional widen-only `UPDATE … WHERE schema_hash = <observed>` (compare-and-swap on the hash) makes overlapping widens converge — the loser re-reads and re-observes the union. Widening is monotonic (fields only added), so a lost update costs at most one extra observation cycle, never data loss. **Parked until** the observation-pipeline writer lands (the only code path that races); shape is locked, so the slice is wiring.
- **Cleanup of orphaned plan-cache entries** — Resolved per `GLOBAL-033` (P5 keep-simple + pin-a-number): accept KV's 30-day TTL (`SK-SCHEMA-005`); no per-DB entry cap. A cap adds a counter + eviction branch for a cost the TTL already bounds. Revisit only if KV-usage metrics show a high-churn DB's orphans approaching the free-tier ceiling.
