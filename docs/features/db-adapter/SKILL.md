---
name: db-adapter
description: Engine-agnostic DB interface; Phase 0 ships Postgres via Neon.
when-to-load:
  globs:
    - packages/db/**
    - apps/api/src/db-registry.ts
  topics: [db, adapter, postgres, neon, engine-agnostic]
---

# Feature: DB Adapter

**One-liner:** Engine-agnostic DB interface; Phase 0 ships Postgres via Neon.
**Status:** implemented (Phase 0 / Slice 3 — single Postgres adapter via Neon HTTP)
**Owners (code):** `packages/db/**`, `apps/api/src/db-registry.ts`
**Cross-refs:** docs/architecture.md §3.6.5–§3.6.7 (validator + tenancy + BYO) · docs/architecture.md §10 §3 (Phase 0 Neon adapter, line 438) · docs/runbook.md §3 (Neon account, §6 deploy state) · docs/performance.md §2.1 row 6 + §3.1 (`db.query` span) · GLOBAL-004, GLOBAL-014, GLOBAL-015 (see governing GLOBALs section) · `docs/features/hosted-db-create/SKILL.md` (Phase 1 create-path consumer; SK-HDC-007 splits the provisioner into `provisionDb` / `registerByoDb` over this adapter)

## Touchpoints — read this skill before editing

- `packages/db/**` (the canonical adapter implementation)
- `apps/api/src/db-registry.ts` (adapter consumers — DB lookup keyed by `(id, tenant_id)`)
- `apps/api/src/ask/orchestrate.ts` (the only `/v1/ask` consumer of the adapter)

## Decisions

### SK-DB-001 — Minimal adapter contract: `engine` tag + `execute(sql, params)`

- **Decision:** The `DatabaseAdapter` interface in `packages/db/src/types.ts` exposes exactly two members: an `engine: Engine` tag (`"postgres"` today, `"redis" | "duckdb"` reserved for Phase 3) and `execute(sql: string, params?: unknown[]): Promise<QueryResult>` returning `{ rows, rowCount }`. No transaction handle, no streaming cursor, no per-connection state.
- **Core value:** Simple, Bullet-proof
- **Why:** The framing of the product is "natural-language databases" — never "natural-language Postgres" (per `packages/db/src/types.ts` header). A narrow interface is the seam that keeps the engine-agnostic promise honest. Streaming, transactions, prepared-statement reuse all add API surface that Phase 3 engines (Redis, DuckDB) wouldn't share — adding them now would force a rewrite when Phase 3 lands.
- **Consequence in code:** Anything that needs DB access takes a `DatabaseAdapter` argument and only calls `execute()`. PRs that add transaction handles or cursor APIs to this interface require an explicit decision update + a Phase 3 migration plan. Per-engine extensions live in adapter-specific modules, not on the shared interface.
- **Alternatives rejected:**
  - Mirror the `pg` driver API — leaks Postgres semantics into the contract; Redis adapter would have to fake half of it.
  - Add a `transaction()` method now — Workers + Neon HTTP don't support multi-statement transactions outside `WITH` CTEs anyway; would lie about what's possible.

### SK-DB-002 — Phase 0 ships one engine: Postgres via `@neondatabase/serverless`

- **Decision:** Phase 0 ships exactly one adapter — `createPostgresAdapter()` over `@neondatabase/serverless` HTTP. No `pg`, no `postgres-js`, no connection pooling middleware. Phase 3 will widen to `redis` and/or `duckdb`; the seam is `Engine` plus a parallel `createXxxAdapter()`.
- **Core value:** Free, Simple, Bullet-proof
- **Why:** Workers don't keep TCP sockets warm across requests, so a connection-pooled driver (`pg`) is dead weight on the free tier. Neon's HTTP driver round-trips per query but sidesteps the pool problem entirely and runs on the Workers free plan within the 3 MiB bundle ceiling (`GLOBAL-013`). One engine in Phase 0 means one set of failure modes to learn before adding more.
- **Consequence in code:** `package.json` for `@nlqdb/db` only depends on `@neondatabase/serverless` + `@opentelemetry/*`. CI fails any PR that adds `pg` / `postgres` / `redis` to `packages/db/` without an accompanying Phase 3 plan (per `docs/architecture.md §10` §5 line 592 wording).
- **Alternatives rejected:**
  - `pg` with an external pooler (PgBouncer / Neon Pooler) — works but doubles the moving parts and the bundle weight; saves nothing in Phase 0.
  - Drizzle/Kysely on top — adds a query-builder layer; we emit raw SQL from the planner, the adapter just runs it.

### SK-DB-003 — No connection pool; one HTTP request per execute

- **Decision:** The Postgres adapter does not pool connections. Each `execute()` call invokes `@neondatabase/serverless`'s `sql.query(text, params)` — one HTTP fetch per query. The neon client is constructed per-adapter (per request) and discarded.
- **Core value:** Bullet-proof, Free
- **Why:** Cloudflare Workers reset the V8 isolate between (most) requests; long-lived TCP/TLS connections aren't a thing on the free plan. Pretending we have a pool would mean either reconnecting on every request (cancels the benefit) or holding state that Workers doesn't reliably preserve (correctness hazard). HTTP-per-query also matches Neon's free-tier billing model — no idle-connection cost.
- **Consequence in code:** `buildNeonQuery()` constructs `neon(connectionString, { fullResults: true })` lazily on first use. `connectionString` flows from the per-DB `connection_secret_ref` resolved against env (currently a single shared `DATABASE_URL` across the Phase 1 Neon branch). The `query` option override exists for tests; production callers always pass a `connectionString`.
- **Alternatives rejected:**
  - Module-scoped `neon(...)` cached across requests — works on Workers but creates cross-tenant blast radius if the connection string ever differs per request.
  - Durable-Object-backed pool — overkill, paid feature, adds latency to the hot path.

### SK-DB-004 — OTel `db.query` span on every execute (GLOBAL-014 instance)

- **Decision:** Every `execute()` call is wrapped in an OpenTelemetry span named `db.query` with attributes `db.system="postgresql"` and `db.operation=<verb>`. Latency is also recorded into the `nlqdb.db.duration_ms` histogram with the same `operation` label. Errors set the span to `ERROR` status and re-throw.
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** The DB call is one of the two budget-defining stages of the `/v1/ask` hot path (`docs/performance.md` §2.1 — 100 ms p50 / 350 ms p99). Without per-call spans we cannot answer "did the query slow down or did the LLM," and the cardinality budget (`docs/performance.md` §3.3) requires the operation label to be bounded — which is why this layer derives it.
- **Consequence in code:** `createPostgresAdapter()` in `packages/db/src/postgres.ts` always wraps `query(...)` in `tracer.startActiveSpan("db.query", ...)`. New engines added in Phase 3 must emit the same span name with the same attribute keys (override `db.system`). PRs that bypass the span fail review per `GLOBAL-014`.
- **Alternatives rejected:**
  - Lift instrumentation up to the caller — caller doesn't have the SQL text, can't derive `db.operation` reliably.
  - Use the upstream `@opentelemetry/instrumentation-pg` — hooks into the `pg` client we don't use; Neon's HTTP driver isn't covered.

### SK-DB-005 — `db.operation` derived per OTel semconv: verb for DML, "VERB NOUN" for DDL

- **Decision:** The `db.operation` attribute is the first SQL keyword for DML/TCL/DCL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `BEGIN`, `COMMIT`, `GRANT`, …) and the `VERB NOUN` pair for DDL (`CREATE TABLE`, `DROP INDEX`, `ALTER TABLE`, `TRUNCATE TABLE`). DDL verbs are `CREATE / DROP / ALTER / TRUNCATE`.
- **Core value:** Honest latency, Simple
- **Why:** This mirrors the OTel `db.operation.name` semantic convention (and the official `@opentelemetry/instrumentation-pg`). Pinning to the spec means dashboards/queries that already understand `db.operation` work for nlqdb without rewriting. Cardinality stays bounded — SQL keywords are a finite set (~30 verbs + ~10 DDL noun phrases), well within the `docs/performance.md §3.3` 8 k series ceiling.
- **Consequence in code:** `detectOperation()` in `packages/db/src/postgres.ts` strips leading whitespace + line/block comments before tokenising, then matches the verb. New DDL verbs (Phase 3 if any) must be added to `DDL_VERBS`. Cardinality assertions in CI catch label drift.
- **Alternatives rejected:**
  - Send the full SQL as the operation — explodes cardinality; banned by `docs/performance.md §3.3`.
  - Send no operation label — breaks per-operation latency dashboards; `nlqdb.db.duration_ms{operation}` becomes a single bucket.

### SK-DB-006 — Test injection via `query` option, not module mocking

- **Decision:** `createPostgresAdapter()` accepts an optional `query: PostgresQueryFn` option. When provided, that function is used directly and `connectionString` is ignored. Tests pass a stub matching `(sql, params) => Promise<{ rows, rowCount? }>`; production code passes only `connectionString`.
- **Core value:** Bullet-proof, Simple
- **Why:** Module-level mocking (`vi.mock('@neondatabase/serverless')`) couples tests to import order and breaks when the adapter is instantiated outside the mock's setup window. A constructor-injection seam keeps the adapter testable without touching the global module graph and makes the test stub the narrowest possible shape.
- **Consequence in code:** `PostgresAdapterOptions` allows `query` and `connectionString` to be mutually optional, but `buildNeonQuery()` throws if neither resolves to a query function. Tests in `packages/db/test/postgres.test.ts` use this seam; never mock the neon module directly.
- **Alternatives rejected:**
  - Mock `@neondatabase/serverless` globally — order-fragile, bleeds across tests.
  - Force callers to pass an adapter factory — pushes complexity to every consumer for a benefit only tests need.

### SK-DB-007 — Schema-per-DB tenancy on a shared Neon branch (Phase 1 baseline)

- **Decision:** Phase 1 hosts every user database as a Postgres schema on a single shared Neon branch. The `connection_secret_ref` column on D1's `databases` table points to one Workers Secret holding the shared `DATABASE_URL`; isolation comes from `SET LOCAL search_path` + per-tenant Postgres role + RLS, not per-db secrets. Phase 2b moves Pro+ tiers to dedicated branches; Phase 4 adds BYO Postgres.
- **Core value:** Free, Bullet-proof
- **Why:** Neon Free is 0.5 GB total per project, scale-to-zero (`docs/runbook.md §9.1`); spinning up a branch per user is impractical at free-tier scale. Schema-per-DB lets us host thousands of dbs on one branch and still get strong isolation through Postgres-native primitives. The same `connection_secret_ref` model already supports Phase 2b's branch-per-tier upgrade — only the provisioner gets a branch-create path added.
- **Consequence in code:** `db-registry.ts` resolves a `DbRecord` keyed by `(id, tenant_id)` and returns the `connection_secret_ref` (currently the shared `DATABASE_URL` env var). Wrangler caps secret count per Worker, so per-user secrets in Workers Secret Store don't scale; the pointer model does. Adapter consumers must `SET LOCAL search_path` before any query that touches a tenant schema.
- **Alternatives rejected:**
  - Branch-per-DB on Neon Free — runs out of branch quota almost immediately.
  - Per-user Workers Secret — hard cap on Wrangler secret count; doesn't scale past ~hundreds of users.

### SK-DB-008 — Schema evolution is `ALTER TABLE ADD COLUMN ... NULL` only (no migrations)

- **Decision:** When the planner observes a new field, the schema widens via `ALTER TABLE ADD COLUMN <name> <type> NULL`. Columns are never dropped, never narrowed, never reordered. There is no migrations tool; for a true schema break, `nlq new` makes a fresh DB and the old one is left untouched (per `docs/architecture.md` §12 line 978).
- **Core value:** Bullet-proof, Simple
- **Why:** "Schemas only widen" (`GLOBAL-004`) is the invariant that makes the plan-cache stable (`GLOBAL-006`) — old plans remain valid against widened schemas because referenced fields still exist. ADD COLUMN NULL is the cheapest Postgres operation that preserves the invariant. A migrations tool would invite branching schemas, which would force the plan-cache to either invalidate aggressively (slow) or branch keys (combinatorial explosion).
- **Consequence in code:** Adapter consumers building DDL must emit ADD COLUMN NULL only; DROP / RENAME / type changes are out-of-band manual operations and are not exposed via `/v1/ask`. The schema-widening skill (`SK-SCHEMA-*`) owns the trigger and storage; this adapter just executes the resulting SQL when called.
- **Alternatives rejected:**
  - In-place migrations — defeats `GLOBAL-004`.
  - Versioned schemas (`v1.users`, `v2.users` schemas) — explodes the plan-cache key surface; `GLOBAL-004` rejects this explicitly.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-004** — Schemas only widen.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-015** — Power users always have an escape hatch.

## Open questions / known unknowns

- **Per-tenant role + RLS wiring** — `SK-DB-007` describes the model but the adapter today does not yet emit `SET LOCAL search_path` / `SET LOCAL ROLE` before queries; consumers must wrap calls themselves. Centralising that on the adapter (or a thin per-tenant adapter wrapper) is open work — risk is forgetting the SET LOCAL on a new code path.
- **Phase 2b dedicated-branch upgrade** — needs a `branch_id` column on the `databases` row and a provisioner branch-create path. Decision shape locked (DESIGN §3.6.6); implementation deferred until paid tier exists.
- **Phase 3 multi-engine** — Redis and DuckDB adapters reuse `Engine` and `createXxxAdapter()`, but the `QueryResult` shape (rows + rowCount) leaks SQL semantics. Redis would need a different result shape (key/value, list, hash). Open: do we widen `QueryResult` to a discriminated union, or does each engine define its own result type and the consumer narrows? (See `multi-engine-adapter` skill.)
- **Phase 4 BYO Postgres** — `POST /v1/db/connect { connection_url, name? }` is the agreed shape (DESIGN §3.6.7). Open: per-db encrypted blob in D1 with a Workers-held KEK — KEK rotation procedure isn't designed yet.
- **Statement timeout / cost cap** — referenced as the executor's job (`SK-SQLAL-007`), but the adapter is the lowest layer with the actual query handle. Open: should the adapter accept a `timeout_ms` / `max_rows` option, or should the executor wrap?
- **Side-effecting Postgres functions** — `pg_sleep`, `dblink`, `lo_import`, `pg_read_file`, `COPY ... FROM PROGRAM` are not blocked at any layer today (cross-link to `sql-allowlist` Open Questions).
