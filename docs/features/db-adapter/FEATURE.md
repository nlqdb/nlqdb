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
**Cross-refs:** docs/architecture.md §3.6.5–§3.6.7 (validator + tenancy + BYO) · docs/phase-plan.md §1 · docs/runbook.md §3/§6 · docs/performance.md §2.1 row 6 + §3.1 (`db.query` span) · governing GLOBALs below · `docs/features/hosted-db-create/FEATURE.md` (create-path consumer; SK-HDC-007 splits the provisioner into `provisionDb` / `registerByoDb` over this adapter)

## Touchpoints — read this feature before editing

- `packages/db/**` (the canonical adapter implementation)
- `apps/api/src/db-registry.ts` (adapter consumers — DB lookup keyed by `(id, tenant_id)`)
- `apps/api/src/ask/orchestrate.ts` (the only `/v1/ask` consumer of the adapter)

## Decisions

### SK-DB-001 — Minimal adapter contract: `engine` tag + `execute(sql, params)`

- **Decision:** The `DatabaseAdapter` interface in `packages/db/src/types.ts` exposes exactly two members: an `engine: Engine` tag (`"postgres"` today; `"clickhouse"` joins in Phase 3 per `SK-MULTIENG-002`) and `execute(sql: string, params?: unknown[]): Promise<QueryResult>` returning `{ rows, rowCount }`. No transaction handle, no streaming cursor, no per-connection state. `SK-DB-009` widens the *public* signature to `execute(plan, signal?)` returning `EngineResult` for multi-engine; the underlying call shape is preserved.
- **Core value:** Simple, Bullet-proof
- **Why:** The product is "natural-language databases" — never "natural-language Postgres" (per `types.ts` header). A narrow interface keeps the engine-agnostic promise honest. Streaming, transactions, prepared-statement reuse all add API surface that Phase 3 engines (ClickHouse, later Redis/D1) wouldn't share — adding them now forces a rewrite when Phase 3 lands.
- **Consequence in code:** Anything needing DB access takes a `DatabaseAdapter` and only calls `execute()`. Adding transaction handles or cursor APIs requires an explicit decision update + a Phase 3 migration plan. Per-engine extensions live in adapter-specific modules, not the shared interface.
- **Alternatives rejected:**
  - Mirror the `pg` driver API — leaks Postgres semantics into the contract; Redis adapter would have to fake half of it.
  - Add a `transaction()` method now — Workers + Neon HTTP don't support multi-statement transactions outside `WITH` CTEs anyway; would lie about what's possible.

### SK-DB-002 — Phase 0 ships one engine: Postgres via `@neondatabase/serverless`

- **Decision:** Phase 0 ships exactly one adapter — `createPostgresAdapter()` over `@neondatabase/serverless` HTTP. No `pg`, no `postgres-js`, no connection pooling middleware. Phase 3 widens to `clickhouse` (via Tinybird) per `SK-MULTIENG-002`; the seam is `Engine` plus a parallel `createXxxAdapter()`.
- **Core value:** Free, Simple, Bullet-proof
- **Why:** Workers don't keep TCP sockets warm across requests, so a pooled driver (`pg`) is dead weight on the free tier. Neon's HTTP driver round-trips per query but sidesteps the pool problem and fits the 3 MiB bundle ceiling (`GLOBAL-013`). One engine in Phase 0 means one set of failure modes to learn before adding more.
- **Consequence in code:** `@nlqdb/db` depends only on `@neondatabase/serverless` + `@opentelemetry/*`. CI fails any PR adding `pg` / `postgres` / `redis` to `packages/db/` without a Phase 3 plan (`docs/phase-plan.md §5`).
- **Alternatives rejected:**
  - `pg` with an external pooler (PgBouncer / Neon Pooler) — works but doubles the moving parts and the bundle weight; saves nothing in Phase 0.
  - Drizzle/Kysely on top — adds a query-builder layer; we emit raw SQL from the planner, the adapter just runs it.

### SK-DB-003 — No connection pool; one HTTP request per execute

- **Decision:** The Postgres adapter does not pool connections. Each `execute()` call invokes `@neondatabase/serverless`'s `sql.query(text, params)` — one HTTP fetch per query. The neon client is constructed per-adapter (per request) and discarded.
- **Core value:** Bullet-proof, Free
- **Why:** Workers reset the V8 isolate between (most) requests; long-lived TCP/TLS connections aren't a thing on the free plan. Faking a pool means either reconnecting every request (cancels the benefit) or holding state Workers won't reliably preserve (correctness hazard). HTTP-per-query also matches Neon's free-tier billing — no idle-connection cost.
- **Consequence in code:** `buildNeonQuery()` constructs `neon(connectionString, { fullResults: true })` lazily on first use. `connectionString` flows from the per-DB `connection_secret_ref` resolved against env (currently a single shared `DATABASE_URL` across the Phase 1 Neon branch). The `query` option override exists for tests; production passes a `connectionString`. Exception: the create-time provisioner batches via `sql.transaction([...])` per `SK-HDC-012`; SK-DB-003 still governs the read/write `/v1/ask` path, only the provisioner takes the batch shortcut.
- **Alternatives rejected:**
  - Module-scoped `neon(...)` cached across requests — works on Workers but creates cross-tenant blast radius if the connection string ever differs per request.
  - Durable-Object-backed pool — overkill, paid feature, adds latency to the hot path.

### SK-DB-004 — OTel `db.query` span on every execute (GLOBAL-014 instance)

- **Decision:** Every `execute()` call is wrapped in an OpenTelemetry span named `db.query` with attributes `db.system="postgresql"` and `db.operation=<verb>`. Latency is also recorded into the `nlqdb.db.duration_ms` histogram with the same `operation` label. Errors set the span to `ERROR` status and re-throw.
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** The DB call is one of two budget-defining stages of the `/v1/ask` hot path (`docs/performance.md` §2.1 — 100 ms p50 / 350 ms p99); without per-call spans we can't tell a slow query from a slow LLM. The §3.3 cardinality budget requires the operation label be bounded — why this layer derives it.
- **Consequence in code:** `createPostgresAdapter()` always wraps `query(...)` in `tracer.startActiveSpan("db.query", ...)`. Phase 3 engines emit the same span name + attribute keys (overriding `db.system`). PRs that bypass the span fail review per `GLOBAL-014`.
- **Alternatives rejected:**
  - Lift instrumentation up to the caller — caller doesn't have the SQL text, can't derive `db.operation` reliably.
  - Use the upstream `@opentelemetry/instrumentation-pg` — hooks into the `pg` client we don't use; Neon's HTTP driver isn't covered.

### SK-DB-005 — `db.operation` derived per OTel semconv: verb for DML, "VERB NOUN" for DDL

- **Decision:** The `db.operation` attribute is the first SQL keyword for DML/TCL/DCL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `BEGIN`, `COMMIT`, `GRANT`, …) and the `VERB NOUN` pair for DDL (`CREATE TABLE`, `DROP INDEX`, `ALTER TABLE`, `TRUNCATE TABLE`). DDL verbs are `CREATE / DROP / ALTER / TRUNCATE`.
- **Core value:** Honest latency, Simple
- **Why:** Mirrors the OTel `db.operation.name` semantic convention (and the official `@opentelemetry/instrumentation-pg`), so dashboards that already understand `db.operation` work without rewriting. Cardinality stays bounded — SQL keywords are finite (~30 verbs + ~10 DDL noun phrases), well within the §3.3 8 k series ceiling.
- **Consequence in code:** `detectOperation()` strips leading whitespace + line/block comments before tokenising, then matches the verb. New DDL verbs go in `DDL_VERBS`; CI cardinality assertions catch label drift.
- **Alternatives rejected:**
  - Send the full SQL as the operation — explodes cardinality; banned by `docs/performance.md §3.3`.
  - Send no operation label — breaks per-operation latency dashboards; `nlqdb.db.duration_ms{operation}` becomes a single bucket.

### SK-DB-006 — Test injection via `query` option, not module mocking

- **Decision:** `createPostgresAdapter()` accepts an optional `query: PostgresQueryFn` option. When provided, that function is used directly and `connectionString` is ignored. Tests pass a stub matching `(sql, params) => Promise<{ rows, rowCount? }>`; production code passes only `connectionString`.
- **Core value:** Bullet-proof, Simple
- **Why:** Module-level mocking (`vi.mock('@neondatabase/serverless')`) couples tests to import order and breaks when the adapter is built outside the mock's setup window. A constructor-injection seam keeps the adapter testable without touching the global module graph and makes the stub the narrowest possible shape.
- **Consequence in code:** `PostgresAdapterOptions` allows `query` and `connectionString` to be mutually optional, but `buildNeonQuery()` throws if neither resolves to a query function. Tests in `packages/db/test/postgres.test.ts` use this seam; never mock the neon module directly.
- **Alternatives rejected:**
  - Mock `@neondatabase/serverless` globally — order-fragile, bleeds across tests.
  - Force callers to pass an adapter factory — pushes complexity to every consumer for a benefit only tests need.

### SK-DB-007 — Schema-per-DB tenancy on a shared Neon branch (Phase 1 baseline)

- **Decision:** Phase 1 hosts every user database as a Postgres schema on a single shared Neon branch. The `connection_secret_ref` column on D1's `databases` table points to one Workers Secret holding the shared `DATABASE_URL`; isolation comes from `SET LOCAL search_path` + per-tenant Postgres role + RLS, not per-db secrets. Phase 2b moves Pro+ tiers to dedicated branches; Phase 4 adds BYO Postgres.
- **Core value:** Free, Bullet-proof
- **Why:** Neon Free is 0.5 GB total per project, scale-to-zero (`docs/runbook.md §9.1`); a branch per user is impractical at free-tier scale. Schema-per-DB hosts thousands of dbs on one branch with strong isolation via Postgres-native primitives. The same `connection_secret_ref` model already supports Phase 2b's branch-per-tier upgrade — only the provisioner adds a branch-create path.
- **Consequence in code:** `db-registry.ts` resolves a `DbRecord` keyed by `(id, tenant_id)` and returns the `connection_secret_ref` (currently the shared `DATABASE_URL` env var). Wrangler caps secret count per Worker, so per-user Workers Secrets don't scale; the pointer model does. Consumers `SET LOCAL search_path` before any query touching a tenant schema.
- **Alternatives rejected:**
  - Branch-per-DB on Neon Free — runs out of branch quota almost immediately.
  - Per-user Workers Secret — hard cap on Wrangler secret count; doesn't scale past ~hundreds of users.

### SK-DB-008 — Schema evolution is `ALTER TABLE ADD COLUMN ... NULL` only (no migrations)

- **Decision:** When the planner observes a new field, the schema widens via `ALTER TABLE ADD COLUMN <name> <type> NULL`. Columns are never dropped, narrowed, or reordered. No migrations tool; a true schema break means `nlq new` makes a fresh DB, the old one untouched (`docs/architecture.md` §12).
- **Core value:** Bullet-proof, Simple
- **Why:** "Schemas only widen" (`GLOBAL-004`) is the invariant that keeps the plan-cache stable (`GLOBAL-006`) — old plans stay valid against widened schemas because referenced fields still exist. ADD COLUMN NULL is the cheapest operation preserving it. A migrations tool invites branching schemas, forcing the plan-cache to either invalidate aggressively (slow) or branch keys (combinatorial explosion).
- **Consequence in code:** Consumers building DDL emit ADD COLUMN NULL only; DROP / RENAME / type changes are out-of-band and not exposed via `/v1/ask`. The schema-widening feature (`SK-SCHEMA-*`) owns the trigger + storage; this adapter just executes the resulting SQL.
- **Alternatives rejected:**
  - In-place migrations — defeats `GLOBAL-004`.
  - Versioned schemas (`v1.users`, `v2.users` schemas) — explodes the plan-cache key surface; `GLOBAL-004` rejects this explicitly.

### SK-DB-009 — Engine-tagged Plan + `AsyncIterable<Row>` result; `meta` for engine extras

**Body:** [`decisions/SK-DB-009-engine-tagged-result.md`](./decisions/SK-DB-009-engine-tagged-result.md).
Public adapter signature widens to `execute(plan, signal?): EngineResult`;
`plan` discriminated by `engine`, `EngineResult = AsyncIterable<Row> & { meta }`.
Each adapter projects native results into rows; engine extras travel
on `meta`. The PG adapter's underlying `(sql, params)` shape per
`SK-DB-001` is preserved; only the public type widens. Anchored by
`SK-MULTIENG-001`.

### SK-DB-010 — `engine?` on `db.create`: classifier-default with optional override

**Body:** [`decisions/SK-DB-010-engine-on-db-create.md`](./decisions/SK-DB-010-engine-on-db-create.md).
`db.create({ goal, engine? })` takes an optional `engine`; omitted ⇒ the
classifier infers it from `goal` (`SK-MULTIENG-002` table), explicit ⇒
overrides and skips the LLM call. Default fallback `"postgres"`. Surface
parity per `GLOBAL-003` (SDK / CLI `--engine=…` / MCP); the web embed
auto-binds. Satisfies `GLOBAL-020` (no config) + `GLOBAL-015` (escape hatch)
without a second endpoint (`GLOBAL-017`).

### SK-DB-011 — BYO Postgres promoted from Phase 4+ to active development

**Body:** [`decisions/SK-DB-011-byo-postgres-promoted.md`](./decisions/SK-DB-011-byo-postgres-promoted.md).
BYO Postgres ships active; the `phase-plan.md §7` signal-gate is
superseded. Shape unchanged from
[`architecture.md §3.6.7`](../../architecture.md#367-byo-postgres-phase-4-decided-shape):
`/v1/db/connect`, `provisionDb` vs `registerByoDb` split (already
done per `SK-HDC-007`), AES-GCM blob + Workers-held KEK,
validator/role/reject-list as defined there. Surface parity per
`GLOBAL-003`. KEK rotation = open sub-question.

### SK-DB-012 — BYO connection URL: validate at the wire boundary, store sealed, display redacted

**Body:** [`decisions/SK-DB-012-byo-connection-url-handling.md`](./decisions/SK-DB-012-byo-connection-url-handling.md).
One pure module — `packages/db/src/connection-url.ts` — parses + validates
a user-supplied Postgres `connection_url` (fail loud per `GLOBAL-012`) and
produces a password- and query-stripped `redacted` form
(`postgres://user@host:port/database`) that is the only representation
allowed on a span, log, CLI prompt, or SDK envelope; the full URL is sealed
verbatim (`GLOBAL-031`, context `dbconn:<dbId>`). Lives in `packages/db/`
per `GLOBAL-021` and ships ahead of its callers like `secret-envelope.ts`;
internal primitive, so no `GLOBAL-003` obligation of its own.

### SK-DB-013 — BYO connect-time validation pipeline: one composition of parse → egress resolve-recheck, shared by both engines

**Body:** [`decisions/SK-DB-013-byo-connect-validation-pipeline.md`](./decisions/SK-DB-013-byo-connect-validation-pipeline.md).
`packages/db/src/byo-connect.ts`'s `validateByoConnection(engine, rawUrl, resolve)`
is the single connect-time entry point both the BYO Postgres (`SK-DB-011`) and BYO
ClickHouse (`SK-MULTIENG-005`) branches call before sealing: it runs the URL parser
(`SK-DB-012` / `SK-MULTIENG-006`) then `guardEgressHostResolved` (`GLOBAL-035`, DoH
resolver injected) in a load-bearing parse-before-resolve order, returning the
engine-tagged parse or a fail-loud message. Pure + zero-dep, stops at validation
(no seal, no D1), ships ahead of its `connect.ts` callers; internal primitive.

### SK-DB-014 — BYO Postgres connect-time schema introspection

**Body:** [`decisions/SK-DB-014-byo-postgres-introspection.md`](./decisions/SK-DB-014-byo-postgres-introspection.md).
`packages/db/src/introspect-postgres.ts`'s `introspectPostgres(query, schema)` reads a live BYO
schema into a faithful read-model (ordered columns + `format_type` types + nullability, ordered
primary/foreign keys) via three fixed `pg_catalog` queries — not one-per-table; composite keys
stay ordinal-aligned via `unnest`, schema bound as `$1`. One `db.introspect` span (`GLOBAL-014`),
fail-loud (`GLOBAL-012`). The connect step after validation (`SK-DB-013`), before sealing
(`GLOBAL-031`); ships ahead of its `registerByoDb` caller, internal primitive.

### SK-DB-015 — BYO Postgres connect-time schema rendering: read-model → `schema_text` + `schema_hash`

**Body:** [`decisions/SK-DB-015-byo-postgres-schema-render.md`](./decisions/SK-DB-015-byo-postgres-schema-render.md).
`packages/db/src/render-byo-postgres.ts`'s `renderByoPostgresSchema(schema)` renders an
`IntrospectedSchema` (`SK-DB-014`) into `{ schemaText, schemaHash }` — schema-qualified `CREATE TABLE`
cards (verbatim `format_type` column types, `NOT NULL`, trailing `PRIMARY KEY`) + unnamed,
action-free `ALTER TABLE … ADD FOREIGN KEY` lines, the same DDL shape the hosted create path stores
so the planner prompt sees one schema shape. The companion `schema-fingerprint.ts`'s
`fingerprintSchema` is the one `schema_hash` function (FNV-1a, 8 hex) both the BYO path (over
`schema_text`) and the hosted path (over the `SchemaPlan` JSON, `build-deps.ts`) hash through.
Pure + zero-dep, deterministic; the connect step after introspection (`SK-DB-014`), before sealing
(`GLOBAL-031`); ships ahead of its `registerByoDb` caller, internal primitive.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-004** — Logical schemas widen; physical layout reshapes.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-015** — Power users always have an escape hatch.
- **GLOBAL-021** — Each external system has one canonical owning module.
  - *In this feature:* `packages/db/` owns the user-data engines; all
    `@neondatabase/serverless` imports live in `@nlqdb/db`. Documented
    exception: `apps/api/src/db-create/build-deps.ts` imports the Neon
    client for the control-plane provisioner (`SK-HDC-*`). Cloudflare D1 is
    a **separate** system owned by `packages/platform-db/` (the `D1Database`
    binding through `db-registry.ts` is platform-db consumer code).
- **GLOBAL-031** — One AES-256-GCM at-rest envelope + one Workers-held KEK for every BYO secret.
  - *In this feature:* the BYO Postgres `connection_url` (`SK-DB-011`) is sealed by `apps/api/src/secret-envelope.ts` (context `dbconn:<dbId>`) before the D1 row; `registerByoDb` reads it back via `openSecret`. The adapter still gets a plaintext DSN at execute time — the envelope is the storage boundary, not the adapter contract.
- **GLOBAL-035** — One egress guard for every BYO outbound connection host (the connect path applies it via `validateByoConnection`, `SK-DB-013`).

## Open questions / known unknowns

- **`engine?` surface parity gap (W3, GLOBAL-003)** — `SK-DB-010` lands `engine?` on the TS SDK, the HTTP API, and `<nlq-data>` (auto-bound). The Go CLI, MCP, and Rust/Ruby SDKs don't yet expose `db.create` (scaffolds), so per `GLOBAL-003`'s "tracked gap" clause they inherit `engine?` via a one-line addition when their `db.create` first lands.
- **Parked until the per-tenant adapter-wrapper slice:** role + RLS wiring. `SK-DB-007` describes the model but the adapter doesn't yet emit `SET LOCAL search_path` / `SET LOCAL ROLE`; consumers wrap calls themselves. A thin per-tenant wrapper closes that "forgot the SET LOCAL" risk.
- **Parked until the paid tier exists:** Phase 2b dedicated-branch upgrade — a `branch_id` column on `databases` + a provisioner branch-create path. Decision shape locked (DESIGN §3.6.6).
- **BYO Postgres `connect.ts` + `registerByoDb` wiring.** The connect primitives have all landed — validation (`validateByoConnection`, `SK-DB-013`), introspection (`introspectPostgres`, `SK-DB-014`), schema rendering (`renderByoPostgresSchema`, `SK-DB-015`), the egress DoH resolver (`createDohResolver`, `GLOBAL-035`). **Parked until** `connect.ts` + `registerByoDb` compose them (validate → open → introspect → render `schema_text`/`schema_hash` → seal per `GLOBAL-031` → D1 row) behind the `/v1/db/connect` verb + its `GLOBAL-003` surface set; shared with `multi-engine-adapter`.
- **Parked until the first prod BYO connection:** BYO Postgres KEK rotation. Envelope + KEK resolved by `SK-DB-011` / `GLOBAL-031`; the rotation procedure (unwrap + re-wrap, key-version column on `databases`) is not yet designed.
- **Statement timeout / cost cap.** Shape per `GLOBAL-033`: the adapter accepts `timeout_ms` / `max_rows` and the executor sets them. **Parked until** the statement-timeout slice lands; a resource-fairness gap, not a security one (the `pg_sleep` DoS is rejected upstream, `SK-SQLAL-008`).
