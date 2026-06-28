---
name: multi-engine-adapter
description: Adapters beyond Postgres — Phase 3 expansion to ClickHouse via Tinybird (next), with Redis / D1 evaluated and deferred.
when-to-load:
  globs:
    - packages/db/**
  topics: [multi-engine, phase-3, adapters]
---

# Feature: Multi Engine Adapter

**One-liner:** Adapters beyond Postgres — Phase 3 expansion to ClickHouse via Tinybird (next), with Redis / D1 evaluated and deferred.
**Status:** decisions firm (`SK-MULTIENG-001..007`); managed ClickHouse/Tinybird adapter pending. `SK-MULTIENG-005` promotes BYO ClickHouse from Phase 4+ to active. **BYO ClickHouse: connect route + query path implemented** — the connect-path primitives (parser `SK-MULTIENG-006`, egress guard `GLOBAL-035`, `system.columns` introspection `SK-MULTIENG-007`) are now composed behind `POST /v1/db/connect`, with the `clickhouse-byo.ts` HTTP exec adapter + query-time engine dispatch, in `SK-DBCONN-001` ([`byo-connect/FEATURE.md`](../byo-connect/FEATURE.md)).
**Owners (code):** `packages/db/**`
**Cross-refs:** `db-adapter/FEATURE.md` (PG adapter; `SK-DB-009/010` evolve the contract) · `engine-migration/FEATURE.md` (auto-migration decoupled, `SK-MULTIENG-002`) · `docs/phase-plan.md` §11

## Touchpoints — read this feature before editing

- `packages/db/**` — adapter implementations
- `apps/api/src/db-create/orchestrate.ts` — engine classifier hook (`SK-DB-010`)
- `apps/api/src/db-registry.ts` — engine resolved per `DbRecord`
- `packages/llm/src/prompts.ts` — engine-classifier prompt embeds the `SK-MULTIENG-002` table verbatim

## Decisions

### SK-MULTIENG-001 — Executor contract: engine-tagged plan + `AsyncIterable<Row>` result

- **Decision:** Shared executor signature is `execute(plan, signal?: AbortSignal): EngineResult` where `plan` is a discriminated union by `engine` and `EngineResult = AsyncIterable<Row> & { meta: EngineMeta }` with `Row = Record<string, unknown>`. Every adapter projects its native result shape into row-shape; engine-specific extras (column schema, command tag, batch count, Pipe id) travel on `meta`. Streams use the standard Workers `ReadableStream` underneath.
- **Core value:** Simple, Bullet-proof
- **Why:** Substrait/Calcite IR is overkill for an LLM that emits the engine's native grammar via constrained decoding (cf. Drizzle, Prisma v7, Vanna 2.0 — one runner per engine). ADBC-shaped row streaming gives one renderer in `<nlq-data>` and one summariser in the pipeline; per-engine quirks stay in `meta`. `AbortSignal` is the standard Workers cancellation primitive.
- **Consequence in code:** `packages/db/src/types.ts` exports `EnginePlan = PgPlan | ChPlan | …` and `EngineResult`. Each adapter file owns its own narrow plan/meta types. The executor never inspects `meta`; only the rendering layer does. PG adapter's underlying call shape (`SK-DB-001`'s `execute(sql, params)`) is preserved — only the public entry-point widens.
- **Alternatives rejected:**
  - Substrait/Calcite IR — heavy JVM-shaped abstraction tax for a small engine target list.
  - Discriminated `EngineResult` union — pushes engine-narrowing onto every consumer.
  - Per-adapter Result types — fragments the renderer/summariser surface; same downside × N engines.

### SK-MULTIENG-002 — ClickHouse via Tinybird is the second engine; engine-fit table is the planner's source of truth

- **Decision:** The first non-Postgres adapter is ClickHouse fronted by **Tinybird Free Forever** (10 GB storage, 1 k reads/day, no card; writes don't count). Other engines are evaluated below but deferred until concrete demand. **The table below is the canonical engine-fit source: when the engine-classifier prompt lands in `packages/llm/src/prompts.ts`, it embeds this table — engine names appear lowercased there to match the wire `Engine` literal.** Adding a new engine = (a) add a row, (b) ship an adapter, (c) update the classifier prompt — exactly three edits.

  | Engine | Strong fit | Avoid when | Free-tier ceiling |
  |---|---|---|---|
  | **Postgres** (Neon) | OLTP ≤ 500 GB; relational joins / FK / ACID; mixed read+write; tables ≤ ~200 M rows; default for "tracker / app data" goals | aggregation over 100 M+ events; pure append-only analytics; sub-ms KV | 0.5 GB / project (shared across schemas) |
  | **ClickHouse** (Tinybird) | analytics, time-series, append-heavy; aggregations over millions–billions of events; high-cardinality dimensions; real-time dashboards; 10–100× PG on `GROUP BY` | row-by-row OLTP updates; small mixed read/write; FK-enforced relational | 10 GB + 1 k reads/day; writes don't count |
  | **SQLite** (Cloudflare D1, *deferred*) | read-heavy (>90 %) per-tenant DBs; thousands of small isolated DBs; edge-local sub-ms reads; content/catalog | sustained writes (≥ 100 wps cap); cross-tenant joins | 50 k DBs / account × 10 GB each |
  | **Redis** (Upstash, *deferred*) | counters / rate-limit / session / leaderboard / cache; sub-ms KV at 50 k+ ops/s | tabular natural-language queries; analytical aggregates; relational joins | 500 k commands / month |

  Engines outside this table (Mongo Atlas, ClickHouse Cloud direct, DynamoDB, …) are not on the roadmap; reopen via a new SK block if a concrete use-case forces the question.
- **Core value:** Free, Simple, Effortless UX
- **Why:** Tinybird is the only managed-ClickHouse with an actual free-forever tier and no card (matches `GLOBAL-013`); its materialised-view + Pipe primitives are exactly what `SK-MULTIENG-003` (physical reshape) operates on. Shipping one new engine first keeps the operational surface (validator, pool model, OTel mapping, anon-mode posture) tight. The table is the canonical source so the planner prompt and human reviewers reference one place.
- **Consequence in code:** `packages/db/src/clickhouse-tinybird.ts` ships with `createTinybirdAdapter({ token, workspace })`. The classifier in `apps/api/src/db-create/` infers engine from goal text using the table; explicit override via `engine?` on `db.create` (per `SK-DB-010`). Auto-migration between engines is decoupled — multi-DB ships engine fixed at create time; engine-migration is a separate Phase-3 deliverable (`engine-migration/FEATURE.md`).
- **Alternatives rejected:**
  - Redis as second engine — chat-with-data pitch is awkward over KV; defer until concrete leaderboards/counters use-case lands.
  - D1 as second engine — strong for many-small-DBs but adds a SQL dialect (SQLite ≠ PG) without solving the analytics gap; defer to anonymous-mode-at-scale.
  - DuckDB as embedded engine — DuckDB-Wasm is 9.7 MB (blows `GLOBAL-013`'s 3 MB ceiling); DuckDB-as-Container needs Workers Paid; Tinybird already covers analytics on $0.
  - Multiple engines in one PR — combinatorial validator/OTel/pool work; staged is safer.

### SK-MULTIENG-003 — Logical schema widens; physical layout reshapes (per-engine)

- **Decision:** `GLOBAL-004` is the rule: logical schema (fields a query references) widens monotonically; physical layout (tables, indexes, materialised views, engine) reshapes under the planner without bumping `schema_hash`. Per-engine application:
  - **Postgres** — physical reshape = `ALTER TABLE ADD COLUMN NULL` only (`SK-DB-008`); index changes are physical. Re-clustering / partitioning is out-of-band.
  - **ClickHouse via Tinybird** — physical reshape = create new Pipes / materialised views per workload signature; old plans hit either the base table or a Pipe transparently. The workload analyser writes a new Pipe; cached plans retain their `schema_hash`.
  - **D1** (when added) — physical reshape limited to `ADD COLUMN`; SQLite has no materialised views.
  - **Redis** (when added) — schemaless; "logical schema" = the set of key prefixes the planner has emitted commands against.
- **Core value:** Bullet-proof, Simple, Effortless UX
- **Why:** This is the "architecture is hidden" thesis (`docs/architecture.md` §0): the user writes English; physical shape changes nightly without breaking cached plans. Bumping `schema_hash` on physical reshape would cache-invalidate every Pipe creation; that defeats the workload-analyser thesis.
- **Consequence in code:** `db.describe()` returns logical schema only (field names + types). Physical state (which Pipe, which index, which engine) is on `meta` and is never input to `schema_hash`. The workload analyser (Phase 3, see `engine-migration/FEATURE.md`) is the only writer of physical reshapes.
- **Alternatives rejected:**
  - Per-engine `schema_hash` rules — fragments `GLOBAL-004`; harder to audit.
  - Bump on Pipe creation — every analyser tick invalidates the cache.
  - Surface physical state to the user — violates `architecture.md §0` ("architecture is hidden").

### SK-MULTIENG-004 — Per-engine validator path, OTel attributes, and anon-mode posture

**Body:** [`decisions/SK-MULTIENG-004-per-engine-validator-otel-anon.md`](./decisions/SK-MULTIENG-004-per-engine-validator-otel-anon.md).
Each adapter ships a sibling validator + OTel attribute mapping; anon-mode
(`GLOBAL-007`) is opt-in per engine. Validators are per-grammar (PG `libpg_query`;
ClickHouse/Tinybird Pipe + table allowlist; Redis command allowlist). OTel: every
span is `db.query` with the canonical `db.system` per engine — `postgresql` /
`redis` / `mongodb`, and `other_sql` for ClickHouse (no canonical semconv value).
Anon-mode launches sign-in-only on the first non-PG engine; the global anon cap
deflects abuse until per-prefix isolation is hardened. New-adapter PR template:
`<engine>/{adapter,validator,otel-attrs}.ts` + an engine-fit-table row
(`SK-MULTIENG-002`) + a one-line classifier-prompt edit.

### SK-MULTIENG-005 — BYO ClickHouse promoted from Phase 4+ to active development; same `registerByoDb` path as BYO Postgres

**Body:** [`decisions/SK-MULTIENG-005-byo-clickhouse-promoted.md`](./decisions/SK-MULTIENG-005-byo-clickhouse-promoted.md).
BYO ClickHouse ships active, not Phase 4+; the `phase-plan.md §7`
P6-persona-inbound gate is superseded. **Now wired end-to-end** — the
`clickhouse-byo.ts` HTTP exec adapter, the `/v1/db/connect` composition, and
query-time engine dispatch land in `SK-DBCONN-001`
([`byo-connect/FEATURE.md`](../byo-connect/FEATURE.md)). Same `registerByoDb` path as
[`SK-DB-011`](../db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md),
with two engine-specific differences: native HTTP (no Hyperdrive / TCP
socket — Workers `fetch` directly) and `system.columns` introspection
instead of `pg_catalog`. The validator allowlist (`SK-MULTIENG-004`) is
the load-bearing DDL guard since ClickHouse `readonly = 1` doesn't block
DDL. Managed Tinybird (`SK-MULTIENG-002`) unaffected — `engine:
"clickhouse"` now picks managed-Tinybird vs. BYO at connect time.

### SK-MULTIENG-006 — BYO ClickHouse connection URL: validate at the wire boundary, store sealed, display redacted (HTTP interface)

**Body:** [`decisions/SK-MULTIENG-006-byo-clickhouse-connection-url.md`](./decisions/SK-MULTIENG-006-byo-clickhouse-connection-url.md).
One pure module — `packages/db/src/clickhouse-connection-url.ts` — parses +
validates a user-supplied ClickHouse HTTP-interface `connection_url` (scheme
∈ `http:` / `https:`, single host; database from `?database=`, default
`default`) and fails loud per `GLOBAL-012`. Two ClickHouse-shaped rejections
keep a mis-paste from connecting wrong: a **client DSN scheme**
(`clickhouse://` / `clickhousedb://` / `tcp://` …) is rejected with a pointer
to the plain HTTP endpoint, and a **database-bearing path with no `?database=`**
(a clickhouse-connect / SQLAlchemy DSN like `…/mydb`) rather than silently
connecting to `default`. The `redacted` form
(`https://user@host:port/?database=db`) is **rebuilt from an allowlist of safe
parts**, so the password (userinfo *or* a `?password=` query param) and every
other query setting are structurally absent; the full URL rides the
`GLOBAL-031` seal (context `dbconn:<dbId>`). The deliberate ClickHouse parallel
of `SK-DB-012` (`SK-DB-002` parallel-adapter pattern), shipped ahead of its
`connect.ts` / `introspect-clickhouse.ts` callers; internal primitive, so no
`GLOBAL-003` obligation of its own.

### SK-MULTIENG-007 — BYO ClickHouse connect-time schema introspection: two fixed `system.*` queries into a faithful read-model

**Body:** [`decisions/SK-MULTIENG-007-byo-clickhouse-introspection.md`](./decisions/SK-MULTIENG-007-byo-clickhouse-introspection.md).
One pure-seam module — `packages/db/src/introspect-clickhouse.ts` —
`introspectClickhouse(query, database)` reads a live BYO ClickHouse schema into a
faithful read-model via two fixed `system.*` queries (`system.tables` for the
authoritative table list + effective `primary_key` expression, `system.columns`
for verbatim column types), run concurrently, never one-per-table. The
ClickHouse parallel of Postgres `SK-DB-014`, not a generalisation: ClickHouse has
no foreign keys (none in the read-model), its primary key is an expression
(surfaced verbatim from `system.tables`, never reconstructed from a column-order
guess), and nullability lives in the type (`Nullable(T)`, derived from the
outermost wrapper — `Array(Nullable(...))` stays non-nullable). Views /
materialized views / temp tables are excluded in SQL. One `db.introspect` span
(`db.system=other_sql` per `SK-MULTIENG-004`, `GLOBAL-014`), fail-loud on a query
error (`GLOBAL-012`). Internal primitive shipped ahead of its `clickhouse-byo.ts`
/ `registerByoDb` callers, so no `GLOBAL-003` obligation of its own.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../decisions.md). Features reference by ID; bodies are not duplicated here.

- **GLOBAL-003** — New capabilities ship to all surfaces in one PR. *In this feature:* SDK/CLI/MCP all carry `engine` per `SK-DB-010`.
- **GLOBAL-004** — Logical schemas widen; physical layout reshapes freely. *In this feature:* `SK-MULTIENG-003` lists per-engine application.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`. *In this feature:* `schema_hash` is engine-specific via per-adapter introspection (`SK-MULTIENG-003`); no `engine` dimension on the cache key.
- **GLOBAL-012** — Errors are one sentence with the next action. *In this feature:* `parseClickhouseUrl` (`SK-MULTIENG-006`) and `guardEgressHost` (`GLOBAL-035`) reject an unusable BYO host at the wire boundary with a one-sentence next action, never echoing the secret.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle. *In this feature:* gates the engine list (`SK-MULTIENG-002`); the `clickhouse-connection-url.ts` + `egress-guard.ts` primitives are zero-dependency (WHATWG `URL` only), so add no measurable bundle weight.
- **GLOBAL-014** — OTel span on every external call. *In this feature:* `SK-MULTIENG-004` pins per-engine attributes.
- **GLOBAL-015** — Power-user escape hatch. *In this feature:* `SK-DB-010` `engine?` override; `SK-MULTIENG-004` raw-SQL/command escape hatches per engine.
- **GLOBAL-017** — One way to do each thing. *In this feature:* no new endpoints; `engine` is a field on existing `db.create`, never a new path.
- **GLOBAL-020** — No "pick a region" in the first 60 s. *In this feature:* engine defaults to classifier inference; explicit field is power-user-only.
- **GLOBAL-021** — Each external system has one canonical owning module. *In this feature:* `packages/db/` owns the ClickHouse engine, so the BYO connection-URL shape (`SK-MULTIENG-006`) and egress guard (`GLOBAL-035`) live there, not in the route handler.
- **GLOBAL-031** — One AES-256-GCM at-rest envelope + one Workers-held KEK for every BYO secret. *In this feature:* the BYO ClickHouse connection URL (`SK-MULTIENG-005`) is sealed by `apps/api/src/secret-envelope.ts` (context `dbconn:<dbId>`), identical to BYO Postgres — only the native-HTTP transport and `system.columns` introspection differ. The redacted display form (the only representation allowed off the seal) is produced by `parseClickhouseUrl` (`SK-MULTIENG-006`).
- **GLOBAL-035** — One egress guard for every BYO outbound connection host. *In this feature:* BYO ClickHouse needs it most — the Worker `fetch()`es the user host directly (no Hyperdrive proxy), so `guardEgressHost` (`packages/db/src/egress-guard.ts`) runs on the parsed `host` before the first `fetch`, after `parseClickhouseUrl` (shape-only, `SK-MULTIENG-006`). The resolve-then-recheck for a `needsDnsRecheck` name is the egress open question below.

## Phase 3 architecture (reference)

The workload analyser + migration orchestrator are owned by [`engine-migration/FEATURE.md`](../engine-migration/FEATURE.md): query log feeds the analyser, which emits per-DB recommendations (Pipe creation, or cross-engine migration); the orchestrator shadow-writes, dual-reads, and atomic-cuts-over via a per-DB routing pointer. Multi-DB (this feature) is decoupled — engine is fixed at `db.create` time.

### Multi-tenancy & isolation
- **Free / Hobby:** shared infra per engine (Neon shared branch via `SK-DB-007`; one Tinybird workspace with per-DB table-prefix scoping).
- **Pro+:** dedicated branch / workspace per tenant (deferred until paid tier exists).
- **Noisy-neighbour:** per-DB query timeout, memory cap, connection cap — per-engine implementation; common shape lives in the adapter.

## Open questions / known unknowns

- **Per-prefix anon isolation on Tinybird — Parked until anon-on-Tinybird is asked for.** Sign-in-only at adapter launch; the per-prefix validator that enables anon-mode (`GLOBAL-007` parity) and its table-prefix scoping schema land only when a user wants anonymous Tinybird DBs — not on spec (`GLOBAL-033`, speculative-scope).
- **Rate-limit dimensions — let-through-then-error** (resolved per `GLOBAL-033`, Simple/reuse + non-destructive read → bias to availability). A free-tier user can hit Tinybird's 1 k reads/day before our per-account limiter; we don't pre-emptively model each engine's quota — the adapter surfaces the provider 429 as our structured envelope (`GLOBAL-012`) and the existing limiter stays the single throttle.
- **Egress / SSRF guard on the BYO ClickHouse host (`GLOBAL-035`).** Landed: `guardEgressHost` + `guardEgressHostResolved` (fail-closed), `createDohResolver` (`doh-resolver.ts`), the shared composition `validateByoConnection` (`SK-DB-013`), and now the `connect.ts` ClickHouse-branch wiring (`SK-DBCONN-001`). **Residual:** the resolve→connect/query TOCTOU sub-TTL window — mitigated by a query-time egress re-guard, documented in [`byo-connect/FEATURE.md`](../byo-connect/FEATURE.md) Open question (c).
- **Cross-engine `nlq run` semantics — Resolved** (`GLOBAL-033`, Simple → one way): single `{db, sql}` payload — no discriminated shape, no engine tag on the wire. The DB record already carries the engine (`db-registry`), so the server dispatches the raw string to PG SQL / Tinybird Pipe SQL / (later) Redis by the DB's engine.

## Phase-3 entry checklist

1. PG adapter (`SK-DB-001..008`) stable; tests cover the `Engine` tag on the existing path.
2. `EnginePlan` / `EngineResult` types land in `types.ts` (`SK-DB-009`); PG adapter migrates onto them with no behaviour change.
3. `engine?` field threads through SDK / CLI / MCP / classifier (`SK-DB-010`, `GLOBAL-003`).
4. Tinybird adapter ships with validator, OTel attrs, sign-in-only anon posture.
5. Engine-classifier prompt in `packages/llm/src/prompts.ts` embeds the `SK-MULTIENG-002` table.

## Source pointers

- `docs/phase-plan.md` — Phase 3 slices; `docs/architecture.md §11` — engine verdict table
- [`db-adapter/FEATURE.md`](../db-adapter/FEATURE.md) — single-engine adapter (`SK-DB-001..008`); multi-engine via `SK-DB-009..010`
- [`engine-migration/FEATURE.md`](../engine-migration/FEATURE.md) — workload analyser + migration orchestrator (decoupled)
