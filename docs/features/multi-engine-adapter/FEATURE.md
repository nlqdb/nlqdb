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
**Status:** decisions firm (`SK-MULTIENG-001..004`); ClickHouse/Tinybird adapter implementation pending.
**Owners (code):** `packages/db/**`
**Cross-refs:** `db-adapter/FEATURE.md` (Phase 0 PG adapter; `SK-DB-009/010` evolve the contract for multi-engine) · `engine-migration/FEATURE.md` (auto-migration is decoupled — see `SK-MULTIENG-002` *Consequence*) · `docs/architecture.md §10` (Phase plan, §11 engine verdict)

## Touchpoints — read this skill before editing

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

- **Decision:** The first non-Postgres adapter is ClickHouse fronted by **Tinybird Free Forever** (10 GB storage, 1 k reads/day, no card; writes don't count). Other engines are evaluated below but deferred until concrete demand. **The table below is the canonical engine-fit source: when the engine-classifier prompt lands in `packages/llm/src/prompts.ts`, it must embed this table verbatim.** Adding a new engine = (a) add a row, (b) ship an adapter, (c) update the classifier prompt — exactly three edits.

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

- **Decision:** Each adapter ships a sibling validator and OTel attribute mapping. Anon-mode (`GLOBAL-007`) is opt-in per engine.
  - **Validators:** PG = `libpg_query` (existing `sql-validate.ts`). Tinybird/ClickHouse = Pipe-name + table-name allowlist + dialect parse for raw-SQL escape hatch (`sqlglot`-equivalent). Redis (when shipped) = command allowlist (verbs are a finite set). Mongo (if ever) = `mongodb-js/stage-validator`. Each adapter's validator lives at `packages/db/src/<engine>/validator.ts`.
  - **OTel:** every span = `db.query`. Canonical `db.system` per engine — `postgresql`, `redis`, `mongodb` (stable in semconv v1.27+); ClickHouse lacks a canonical value, emit `other_sql`. Required attributes per engine: PG = `db.namespace, db.operation.name, db.query.text`; Redis = `db.operation.name`; Mongo = `db.collection.name, db.operation.name, db.namespace` (no `db.query.text` — privacy convention).
  - **Anon-mode:** PG path keeps schema-per-anon. Tinybird launches **sign-in-only** — the global anon rate-limit (`anon-global-cap.ts`) gates anon traffic away from non-PG engines until per-prefix isolation is hardened. Adding anon-mode on an engine = a follow-up SK block, not part of the adapter-launch slice.
- **Core value:** Bullet-proof, Honest latency
- **Why:** OSS validators exist where they exist; hand-rolling allowlists is bounded only for engines with finite verb sets. Per-engine OTel attributes are a `GLOBAL-014` parity requirement; canonical `db.system` values are in the spec for the engines that have them. Anon-mode parity is engine-by-engine work; gating Tinybird sign-in-only at launch keeps the multi-tenant prefix isolation off the critical path.
- **Consequence in code:** New adapter PR template = `<engine>/{adapter,validator,otel-attrs}.ts` + an entry in the engine-fit table (`SK-MULTIENG-002`) + a one-line classifier-prompt edit (`packages/llm/src/prompts.ts`). Anon-mode wiring on a new engine is its own follow-up PR.
- **Alternatives rejected:**
  - Universal validator — engines have incommensurable grammars; one parser cannot cover them.
  - Lift OTel up out of the adapter — caller doesn't have the engine-native operation; cardinality risk.
  - Block all anon traffic on first non-PG engine — overkill; the global cap already deflects abuse.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../decisions.md). Skills reference by ID; bodies are not duplicated here.

- **GLOBAL-003** — New capabilities ship to all surfaces in one PR. *In this skill:* SDK/CLI/MCP all carry `engine` per `SK-DB-010`.
- **GLOBAL-004** — Logical schemas widen; physical layout reshapes freely. *In this skill:* `SK-MULTIENG-003` lists per-engine application.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`. *In this skill:* `schema_hash` is engine-specific via per-adapter introspection (`SK-MULTIENG-003`); no `engine` dimension added to the cache key.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle. *In this skill:* gates the engine list in `SK-MULTIENG-002`.
- **GLOBAL-014** — OTel span on every external call. *In this skill:* `SK-MULTIENG-004` pins per-engine attributes.
- **GLOBAL-015** — Power-user escape hatch. *In this skill:* `SK-DB-010` `engine?` override; `SK-MULTIENG-004` raw-SQL/command escape hatches per engine.
- **GLOBAL-017** — One way to do each thing. *In this skill:* no new endpoints; `engine` is a field on existing `db.create`, never a new path.
- **GLOBAL-020** — No "pick a region" in the first 60 s. *In this skill:* engine defaults to classifier inference; explicit field is power-user-only.

## Phase 3 architecture (reference)

The workload analyser + migration orchestrator are owned by [`engine-migration/FEATURE.md`](../engine-migration/FEATURE.md). High-level: query log feeds the analyser; the analyser emits per-DB recommendations (Pipe creation inside an engine, or cross-engine migration); the orchestrator shadow-writes, dual-reads, and atomic-cuts-over via a per-DB routing pointer. Multi-DB (this skill) is decoupled — engine is fixed at `db.create` time; the analyser is a separate Phase-3 deliverable.

### Multi-tenancy & isolation
- **Free / Hobby:** shared infra per engine (Neon shared branch via `SK-DB-007`; one Tinybird workspace with per-DB table-prefix scoping).
- **Pro+:** dedicated branch / workspace per tenant (deferred until paid tier exists).
- **Noisy-neighbour:** per-DB query timeout, memory cap, connection cap — per-engine implementation; common shape lives in the adapter.

## Open questions / known unknowns

These are the genuinely open items remaining after `SK-MULTIENG-001..004`. Each becomes a follow-up SK when answered.

- **Connection-pool ownership for Tinybird.** Tinybird's HTTP API has no pool concept (matches Workers); confirm the adapter holds no client state across requests once `createTinybirdAdapter()` is wired.
- **Per-prefix anon isolation on Tinybird.** Sign-in-only at adapter launch; the per-prefix validator that enables anon-mode (`GLOBAL-007` parity) is its own follow-up — schema for table-prefix scoping is undecided.
- **Statement timeout / cost cap.** Adapter is the lowest layer with the actual handle. Whether the adapter accepts `timeout_ms`/`max_rows` or the executor wraps remains open across all engines (cross-link to `db-adapter` open questions).
- **Rate-limit dimensions.** Free-tier user hits Tinybird's 1 k reads/day before they hit our per-account rate limit; pre-emptive throttling vs. let-through-then-error is undecided.
- **Cross-engine `nlq run` semantics.** Power-user `nlq run` (`GLOBAL-015`) exists on PG today as raw SQL. Equivalent for ClickHouse via Tinybird = raw Pipe SQL; for Redis (later) = raw command. Mapping is per-engine but the surface is single — open whether the SDK accepts a discriminated `run` payload or a string + engine tag.

## Phase-3 entry checklist

1. PG adapter (`SK-DB-001..008`) is stable; tests cover the `Engine` tag on the existing path.
2. `EnginePlan` / `EngineResult` types land in `packages/db/src/types.ts` per `SK-DB-009`; PG adapter migrates onto them with no behaviour change.
3. `engine?` field threads through SDK / CLI / MCP / classifier per `SK-DB-010` and `GLOBAL-003`.
4. Tinybird adapter ships with validator, OTel attrs, sign-in-only anon posture.
5. Engine-classifier prompt block in `packages/llm/src/prompts.ts` embeds the `SK-MULTIENG-002` engine-fit table verbatim.

## Source pointers

- `docs/architecture.md §10 §6` — Phase 3 slice list
- `docs/architecture.md §11` — engine verdict table
- [`db-adapter/FEATURE.md`](../db-adapter/FEATURE.md) — single-engine adapter reference (`SK-DB-001..008`); evolution to multi-engine via `SK-DB-009..010`
- [`engine-migration/FEATURE.md`](../engine-migration/FEATURE.md) — workload analyser + migration orchestrator (decoupled deliverable)
