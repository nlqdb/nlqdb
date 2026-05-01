---
name: schema-widening
description: Schemas only widen — `schema_hash` is monotonically extended, never branched.
when-to-load:
  globs:
    - apps/api/src/db-registry.ts
    - apps/api/src/ask/orchestrate.ts
    - apps/api/src/ask/types.ts
    - packages/db/**
  topics: [schema, schema_hash, widening, fingerprint, plan-cache]
---

# Feature: Schema Widening

**One-liner:** Schemas only widen — `schema_hash` is monotonically extended, never branched.
**Status:** partial — `schema_hash` is plumbed end-to-end (D1 → registry → orchestrator → plan-cache key), but the observed-fields collector and widening trigger ship post-Phase-0 (see Open Questions).
**Owners (code):** `apps/api/src/db-registry.ts`, `apps/api/src/ask/orchestrate.ts`, `apps/api/src/ask/types.ts`, `apps/api/src/ask/plan-cache.ts`, `packages/db/**`
**Cross-refs:** docs/design.md §0.1 (on-ramp inversion bullets), §9 row "Schema mismatch" (line 936), §12 line 978 (no migrations tool) · docs/implementation.md §3 line 424 (plan cache key) · docs/decisions.md#GLOBAL-004 · #GLOBAL-006

## Touchpoints — read this skill before editing

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
- **Consequence in code:** `DbRecord.schemaHash` is `string | null` — `null` only on a brand-new DB before any field has been observed. After the first widen, it is non-null and stays non-null. `CachedPlan.schemaHash` is `string` (no nullable) because no plan can be cached without a schema. Anyone tempted to add `schema_hash_v2` should add an `SK-SCHEMA-NNN` superseding decision instead.
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

### SK-SCHEMA-003 — Widen via `ALTER TABLE ADD COLUMN ... NULL` only

- **Decision:** The widening primitive is `ALTER TABLE <table> ADD COLUMN <name> <type> NULL`. New columns are nullable so existing rows remain valid; we never `DROP COLUMN`, never `ALTER COLUMN TYPE`, never `RENAME`. This is the only DDL emitted on the widen path.
- **Core value:** Bullet-proof, Free
- **Why:** ADD COLUMN NULL on Postgres is metadata-only (no table rewrite) since PG 11 — it's safe and fast even on large tables on Neon Free. Any other DDL invalidates the "old plans still work" property: dropping a column means an old plan referring to it now fails; renaming forces every cached plan to be replanned. Both break `GLOBAL-006`.
- **Consequence in code:** The widening writer (when implemented) emits ADD COLUMN only. `sql-validate.ts` already rejects `ALTER` from the read/write path (`SK-SQLAL-002`); the widen path is a separate caller that uses the typed-plan compiler (DESIGN §3.6.2), not `validateSql`. PRs introducing DROP / RENAME on this path will be rejected — schema breaks go through `nlq new` (`SK-SCHEMA-007`).
- **Alternatives rejected:**
  - Allow column type widening (e.g. `int` → `bigint`) — breaks the "old plans still work" property when any cached plan binds the old type to a parameter.
  - Allow column rename — every cached plan referencing the old name fails; would force cache invalidation on rename.

### SK-SCHEMA-004 — Vanished field is a hard-stop, not a normal branch

- **Decision:** If an observed field disappears (column dropped out-of-band, schema corrupted, BYO-Postgres user altered their DB), the request fails hard with an actionable error per `GLOBAL-012`. We do NOT branch the plan-cache to a "minus-this-field" hash and re-plan; we do NOT silently fall back.
- **Core value:** Bullet-proof, Honest latency
- **Why:** `GLOBAL-004` is "schemas only widen" — a vanished field violates the invariant the cache depends on, so the safe response is to surface it instead of papering over. Replanning silently would hide the schema drift from the operator and produce inconsistent results across cached/uncached paths.
- **Consequence in code:** When the observation pipeline detects a vanished field (post-Phase-0), it MUST refuse to compute a new `schema_hash`. The request returns an error code naming the vanished field (one sentence + next action per `GLOBAL-012`). Operators investigate; users get pointed at `nlq new` for a clean DB.
- **Alternatives rejected:**
  - Auto-replan on vanish — silently produces different results than the cached plan would; correctness regression.
  - Mark the column "removed" in our schema record but keep the hash — invents a state that Postgres doesn't have.

### SK-SCHEMA-005 — Plan-cache reads survive widening unchanged

- **Decision:** When `schema_hash` widens (a new column is added), entries already in the plan cache for the previous `schema_hash` are NOT migrated, NOT invalidated, NOT touched. They remain valid for any request that still resolves to the previous hash; new requests use the new hash and get a fresh `(schema_hash, query_hash)` cache slot.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** This is the payoff of `GLOBAL-006` — the cache key is content-addressed; a hash change naturally evicts the old entry by missing on lookup. We never need to enumerate or rewrite cache entries. Cloudflare KV's 30-day TTL (`apps/api/src/ask/plan-cache.ts` `PLAN_CACHE_TTL_SECONDS`) handles eventual cleanup of orphaned old-hash entries without operator action.
- **Consequence in code:** `plan-cache.ts` has no widen-aware code paths and never should. Widening writes one D1 row; the cache catches up the next request. PRs that add cache-walk-on-widen logic should be rejected.
- **Alternatives rejected:**
  - Eagerly migrate cache entries to the new hash — expensive scan; unnecessary because the hash change auto-evicts on miss.
  - Set explicit TTL aligned to widen frequency — couples KV TTL to schema dynamics, fragile.

### SK-SCHEMA-006 — Empty-DB first query: explicit `schema_unavailable` until the observation pipeline lands

- **Decision:** Until the post-Phase-0 observation pipeline lands, an `/v1/ask` request against a DB with `schemaHash == null` returns the error `schema_unavailable` (`apps/api/src/ask/orchestrate.ts` line 116–119). This is the documented Phase 0 behaviour — Phase 0 testing requires a fixture row in D1's `databases` table and a schema seeded directly on Neon (`docs/implementation.md` §3 line 461–463).
- **Core value:** Bullet-proof, Honest latency
- **Why:** The implicit-create path (goal-with-no-dbId triggers schema inference + provisioner) ships in Phase 1 §4 as the "hosted db.create" slice — it requires the typed-plan validator and Neon-provisioner described in DESIGN §3.6. Bolting a partial inference into Phase 0 would create a code path that diverges from the typed-plan model and would have to be rewritten.
- **Consequence in code:** `orchestrate.ts` returns `{ status: "schema_unavailable" }` on null hash; do not change this to "infer on the fly" without landing the typed-plan path. When the observation pipeline lands, this branch becomes the bootstrap entry point; the SK-IDs gain a follow-up.
- **Alternatives rejected:**
  - Inline schema inference in Phase 0 — duplicates Phase 1's typed-plan work; throws away when the real path lands.
  - Treat null `schema_hash` as a sentinel "match-anything" hash — silently caches plans against the wrong assumption.

### SK-SCHEMA-007 — No migrations tool; schema break = fresh DB

- **Decision:** nlqdb does not ship a migrations tool (`docs/design.md` §12 line 978). For a true schema break (incompatible field type, dropped column required), the user runs `nlq new` to materialise a fresh DB; the old DB stays untouched and queryable until the user retires it.
- **Core value:** Simple, Goal-first
- **Why:** Migrations are the source of half the production bugs in conventional ORMs — they couple "current schema" to "history of schema changes" and force every running plan to be aware of which version it's against. Forcing a fresh DB instead is monotonically simpler: the old plans keep working against the old DB, the new DB starts widening from empty. The trade is operational ("two DBs") for engineering ("zero migration code path") and the engineering side wins decisively.
- **Consequence in code:** No `apps/api/src/migrations/` directory exists or should exist. Operators encountering a "we need to drop this column" requirement should be pointed at `nlq new`. CLI / web flows that "rename a field" must do so by widening (add new name, keep old) — never by replacing.
- **Alternatives rejected:**
  - Schema-mate-style migration files in the repo — invites the version-coupling problem we are explicitly avoiding.
  - In-place ALTER COLUMN — see `SK-SCHEMA-003`; breaks `GLOBAL-006`.

### GLOBAL-004 — Schemas only widen

- **Decision:** Once a column or field is observed in a query plan, it
  stays in the schema fingerprint. Schemas grow; they don't shrink. The
  `schema_hash` is monotonically widened, never branched on a "schema
  mismatch" path.
- **Core value:** Bullet-proof, Simple
- **Why:** Branching on schema mismatch creates a combinatorial explosion
  of plan-cache keys, and every replanning is a chance to regress.
  Widening is monotonic and safe — old plans remain valid against
  widened schemas because the fields they reference still exist.
- **Consequence in code:** `schema_hash` is computed over observed-fields
  sorted by name; adding fields is append-only. `plan-cache` keys remain
  valid across widening; replanning is only triggered when an observed
  field disappears (which we treat as a hard-stop event, not a normal
  branch).
- **Alternatives rejected:**
  - Versioned schemas — more keys, more plans, more bugs.
  - Re-plan on any schema change — breaks `GLOBAL-006` (content-addressed
    cache).
- **Source:** docs/decisions.md#GLOBAL-004

### GLOBAL-006 — Plans content-addressed by `(schema_hash, query_hash)`

- **Decision:** A query plan's cache key is the pair
  `(schema_hash, query_hash)`. There is no time-based invalidation, no
  "cache version," no manual flush. If the inputs match, the plan
  matches.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** Cache invalidation is the second-hardest problem in
  computer science; we side-step it by making every cache key
  derive entirely from the inputs that determine the output. Combined
  with `GLOBAL-004`, this guarantees plans are stable under benign
  schema growth.
- **Consequence in code:** `plan-cache` writes are keyed by
  `(schema_hash, query_hash)`; reads are exact-match only. Anything
  that wants to "force a new plan" must change `query_hash` (e.g., a
  pin or a hint), not invalidate the cache. LLM-generated plans are
  the only writers; humans pinning a plan write to the same store.
- **Alternatives rejected:**
  - TTL-based caches — wastes the 99% case where the inputs are
    unchanged, plus introduces flakiness around the boundary.
  - Versioned plans tied to schema versions — would force
    `GLOBAL-004` to branch.
- **Source:** docs/decisions.md#GLOBAL-006

## Open questions / known unknowns

- **Hash construction algorithm.** GLOBAL-004's Consequence specifies "computed over observed-fields sorted by name; append-only." The exact algorithm (SHA-256 over `JSON.stringify(sortedFields)` vs a custom canonical form, with or without per-field type) is not yet pinned in code. When the observation pipeline lands, this becomes a load-bearing decision and gets a new SK-SCHEMA-NNN. Surfacing here per P1 — do not silently choose without surfacing the trade-offs (hash stability vs type-aware widening).
- **Observation pipeline** — the orchestrator currently rejects null-hash DBs (`SK-SCHEMA-006`). The pipeline that watches Postgres `information_schema` (or the typed-plan compiler) and writes new fields into D1 is post-Phase-0. Decisions still TBD: is observation push-based (planner emits widen) or pull-based (introspect on first query against an empty DB)? See `docs/implementation.md` §3 line 441–446 — the typed-plan validator + Neon-provisioner is the agreed Phase 1 §4 vehicle.
- **Field-type evolution.** When the observation pipeline lands, what happens if an existing column's underlying Postgres type changes (e.g. operator runs `ALTER COLUMN TYPE` out of band)? `SK-SCHEMA-004` says vanished = hard-stop; type-change is unspecified. Provisional answer: also hard-stop, treat as breaking change → `nlq new`.
- **BYO Postgres edge cases (Phase 4).** A user-managed DB doesn't go through the typed-plan compiler, so widening is observation-only. Open: do we accept the schema as-is (whatever they have) and only widen forward, or do we refuse to operate against BYO DBs whose existing schema doesn't fit our model?
- **Multi-Worker write race.** Two concurrent observers on different Workers might both decide to widen with overlapping fields. D1 single-writer semantics + a transactional update should handle this, but the exact compare-and-swap pattern needs to be specified before the writer lands.
- **Cleanup of orphaned plan-cache entries.** `SK-SCHEMA-005` argues KV's 30-day TTL handles this implicitly; a high-churn DB could leave many orphaned entries on the way. Open: do we want a cap on entries-per-DB, or accept the TTL behaviour?
