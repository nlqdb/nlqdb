---
name: multi-engine-adapter
description: Phase 3: db-adapters for engines beyond Postgres (Mongo, Redis, ClickHouse, …).
when-to-load:
  globs:
    - packages/db/**
  topics: [multi-engine, phase-3, adapters]
---

# Feature: Multi Engine Adapter

**One-liner:** Phase 3: db-adapters for engines beyond Postgres (Mongo, Redis, ClickHouse, …).
**Status:** planned (Phase 3)
**Owners (code):** `packages/db/**`
**Cross-refs:** docs/architecture.md §10 §2.1 (Execution layer + per-engine adapters) · docs/architecture.md §10 §2.3 (engine selection heuristics — the per-engine target list) · docs/architecture.md §11 (alternative technologies — verdicts per engine) · docs/architecture.md §10 §6 (Phase 3 — Redis as second engine, DuckDB as third) · docs/architecture.md (multi-engine references throughout)

## Touchpoints — read this skill before editing

- `packages/db/**`

## Decisions

_No decisions are firm yet — multi-engine-adapter is Phase 3 and the
open questions below must be answered before code lands. The skill
exists now so the `SK-MULTIENG-NNN` ID prefix is reserved and
`_index.md` is comprehensive (per `docs/skill-conventions.md §6`)._

## Phase 2 engine architecture

The Phase 2 engine continuously reads the query log and picks — and changes — the backend without downtime.

```
                    ┌─────────────────────────┐
  user query ──►    │  Query Planner (LLM +   │ ──► engine-specific executor
                    │  learned router)        │        │
                    └────────────┬────────────┘        │
                                 │                     ▼
                                 ▼               ┌────────────────────────┐
                         ┌───────────────┐       │  Engines (per-db):     │
                         │ Query Log     │◄──────│  PG │ Mongo │ Redis │  │
                         │ (append-only) │       │  DuckDB │ pgvector │  │
                         └──────┬────────┘       └──────────┬─────────────┘
                                │                           │
                                ▼                           │
                      ┌──────────────────┐                  │
                      │ Workload Analyzer│ ─── decision ──► Migration Orchestrator
                      │ (background)     │                  │
                      └──────────────────┘                  ▼
                                                     ┌───────────────┐
                                                     │ Shadow + Cutover│
                                                     └───────────────┘
```

### Query Planner
- Given NL query + current engine + schema snapshot, emits a typed plan.
- Hybrid: cached template router (fast path for repeat-structure queries) + LLM fallback (cold path).
- Returns a *confidence score*; low confidence triggers inline clarification chips.
- Plans are content-addressed and cached per-schema-hash.

### Execution layer
- One adapter per engine. Common `Executor` interface: `execute(plan) -> stream<row>`.
- We own the connection pool per user-DB. PgBouncer-style, but ours.

### Query Log (workload fingerprint)
- Every query writes: fingerprint, latency, rows scanned, rows returned, engine used, plan shape (point-get / range / agg / join / doc-traversal / full-text / vector / graph-walk).
- Fingerprints are anonymized; the *shape* is stored, not the data.
- Storage: hot in Postgres, cold in ClickHouse.

### Workload Analyzer
- Runs every N minutes per DB.
- Classifies the workload distribution into a vector over engine affinities.
- Emits a recommendation: `{ current: pg, recommended: redis+pg, confidence: 0.87, reason: "92% of queries in last 24h are point-lookups by primary key with <1KB values" }`.
- Never auto-migrates on its own decision alone — requires (a) confidence > threshold, (b) sustained over a window (hours, not minutes), (c) projected cost/latency win > threshold.

### Migration Orchestrator
- **Shadow-writes** to the new engine while reads stay on the old one.
- Backfill in parallel; throttled against current load.
- **Dual-read verification** — a sample of production reads runs on both engines and we compare results. Any divergence blocks cutover and pages.
- **Atomic cutover** via a per-db routing pointer. Rollback is a pointer flip.
- The user sees a single subtle line in their trace: `engine: postgres → redis (migrated 2h ago)`. Nothing more, unless they ask.

### Backup & restore
- Continuous WAL-style backup per engine to object storage (R2 primary — cheapest egress; S3 secondary).
- Point-in-time restore to any second in last 7 days on free tier, 30 days on paid.
- Restore is a natural-language action too: "restore orders to yesterday 3pm."

### Engine selection heuristics (starting point, will be learned)

| Workload signature | Engine |
|---|---|
| Majority writes + point reads by id, small values | Redis (persistence on) |
| Relational joins, constraints, strong consistency | Postgres |
| Document-shaped, variable schema, deep nesting | Mongo *or* Postgres JSONB (prefer JSONB unless nesting > 4 levels and access is by nested path) |
| Analytics, scans, aggregations over millions of rows | DuckDB (embedded) or ClickHouse (managed, at scale) |
| Semantic search, embeddings | pgvector (default) → Qdrant (if corpus > ~10M vectors) |
| Time-series append-heavy | TimescaleDB extension on PG |
| Full-text search heavy | PG `tsvector` default → Typesense at scale |
| Graph traversals (>3 hops common) | Postgres recursive CTE default → Neo4j only if truly graph-native workload |

**Principle:** default to Postgres + extensions. Only move off Postgres when the evidence is overwhelming.

### Multi-tenancy & isolation
- **Phase 2a (early):** Postgres schema-per-DB on shared clusters. Row-level-security off, we rely on connection-level scoping.
- **Phase 2b (scale):** tier-based tenancy — free + hobby share clusters; pro+ get dedicated compute (Neon branches, Fly Machines, or our own k8s). The user never sees this shift.
- **Noisy neighbor mitigation:** per-DB query timeouts, per-DB memory caps, per-DB connection caps, all enforced at the proxy.

### Phase 2 exit criteria
- Auto-migration between at least PG ↔ Redis and PG ↔ DuckDB running in prod with zero user-visible downtime across 100+ migrations.
- Workload Analyzer's decisions beat a human DBA on a held-out benchmark (we'll build it).
- p99 query latency under the *current* engine is within 1.3× of hand-written queries against that engine directly.
- Backups: verified restore drill passes weekly.

---

The shape of the feature is sketched above and in `docs/architecture.md §10 §2.2`:
**one adapter per engine; common `Executor` interface
`execute(plan) -> stream<row>`; we own the connection pool per
user-DB.** The engine target list (`docs/architecture.md §10 §2.3`) and the
verdict-per-engine table (`docs/architecture.md §11`) constrain the choice
space, but per-engine decisions are still open.

The current single-engine adapter lives in `packages/db/` and ships
Phase 0 Postgres via Neon (see the `db-adapter` skill,
`SK-DB-NNN`). Phase 3 extends — does not replace — that contract.

## Open questions / known unknowns

These must be resolved before the first non-Postgres adapter ships.
Each one becomes one or more `SK-MULTIENG-NNN` decisions when answered.

### The common `Executor` contract

- **Interface shape.** `docs/architecture.md §10 §2.2` names `execute(plan) ->
  stream<row>`. Concrete TypeScript signature, error shape, and
  cancellation semantics (`AbortSignal`?) are TBD.
- **Plan format.** Each engine has a different native query language
  (SQL, Mongo aggregation, Redis commands). Is the `plan` an
  engine-specific document handed to the adapter, or an engine-
  agnostic IR the adapter compiles? `docs/architecture.md §10 §3` notes
  "Structured tool-use with the target engine's grammar as a
  constrained decode where possible (grammars for SQL exist; for
  Mongo aggregation we hand-roll)" — implies engine-specific. Pin it.
- **Streaming semantics.** Do all engines return `stream<row>`, or
  do some return materialized result sets (Redis MGET, e.g.)? How
  does the executor present a unified streaming surface over both?
- **Schema introspection contract.** What does `describe()` return
  per engine, and how does that feed the schema-fingerprint used by
  `GLOBAL-004` (schemas only widen)?
- **Health / readiness.** How does the orchestrator probe an
  adapter's readiness (cold connection pool, scale-to-zero engines
  warming up)?

### Per-engine adapters

The Phase 3 target set per `docs/architecture.md §10 §2.3` and `docs/architecture.md §11`:

#### Redis (Upstash) — Phase 3 second engine

- **Decision:** Redis is the second engine after Postgres
  (`docs/architecture.md §10 §6`).
- Why Upstash specifically: HTTP API (no persistent conns, serverless-
  friendly) per `docs/architecture.md §11`. Other Redis options (Redis Cloud /
  ElastiCache) explicitly rejected as "needs persistent conns; bad
  fit for serverless."
- **Open:** persistence settings (RDB? AOF?), eviction policy
  (per-DB? per-key?), command allowlist (Redis has destructive
  commands like FLUSHDB that the validator must reject).
- **Open:** Redis is schema-less; how does `GLOBAL-004` (schemas only
  widen) translate? Treat each key prefix as a "table"?

#### DuckDB — Phase 3 third engine, analytics workload

- **Decision:** DuckDB embedded for analytic workloads
  (`docs/architecture.md §11`: "We run it as a sidecar for analytic workloads
  on a user's PG data via the `postgres_scanner` extension").
- **Open:** is DuckDB a true target engine (data lives in DuckDB), or
  a query-time accelerator (data lives in PG, DuckDB scans on
  demand)? `docs/architecture.md §11` suggests the latter; `docs/architecture.md §10 §2.3`
  ("Analytics, scans, aggregations over millions of rows | DuckDB
  (embedded) or ClickHouse (managed, at scale)") suggests the
  former. Pin it.
- **Open:** Where does DuckDB run? Embedded in the API Worker
  (Workers don't permit native binaries), or in a sidecar service?
  Implies a Fly.io sidecar, which costs us money — interaction with
  `GLOBAL-013` (Workers free-tier bundle ≤ 3 MiB) and free-tier $0
  budget needs explicit reasoning.

#### ClickHouse Cloud — Phase 3 analytics-at-scale

- **Decision:** ClickHouse for analytics that outgrow DuckDB
  (`docs/architecture.md §11`: "✅ Phase 2 analytics-at-scale | Solid API.").
  Re-classified as Phase 3 in `docs/architecture.md §10 §6`.
- **Open:** When does the Workload Analyzer recommend DuckDB vs.
  ClickHouse? `docs/architecture.md §10 §2.3` mentions "DuckDB (embedded) or
  ClickHouse (managed, at scale)" — what's the row-count / QPS
  threshold for the handoff?

#### MongoDB Atlas — verdict ⚠️, prefer JSONB unless we must

- **Decision direction:** `docs/architecture.md §11` is hesitant ("Free tier
  is tiny. Prefer JSONB on PG unless we must"). `docs/architecture.md §10 §2.3`
  says "Document-shaped, variable schema, deep nesting | Mongo *or*
  Postgres JSONB (prefer JSONB unless nesting > 4 levels and access
  is by nested path)".
- **Open:** Is Mongo an adapter target at all in Phase 3, or do we
  ship "JSONB-on-Postgres" as the document story and defer Mongo to
  Phase 4+? Consensus signal needed before adapter work begins.

#### pgvector — Phase 3 default vector engine

- **Decision direction:** `docs/architecture.md §11`: "✅ default vector |
  Keeps us in PG." Already used for table-card embeddings on schema
  inference (`docs/architecture.md §3.6.2`).
- **Open:** Is pgvector a *separate adapter* in the multi-engine
  contract, or does the Postgres adapter advertise vector capability
  via a feature flag? Cleaner to keep one PG adapter; simpler routing
  to fan it out.

#### TimescaleDB — Phase 3 time-series default

- **Decision direction:** `docs/architecture.md §11`: "✅ time-series default
  | PG extension — no new engine."
- **Open:** Same question as pgvector — extension on the existing PG
  adapter, or its own adapter? `docs/architecture.md §11` strongly hints
  "extension," not new engine.

#### Typesense / Meilisearch — Phase 3+ optional search

- **Decision direction:** `docs/architecture.md §11` lists both as "✅ optional
  search | API-first." `docs/architecture.md §10 §2.3` ("Full-text search heavy")
  routes to "PG `tsvector` default → Typesense at scale."
- **Open:** Threshold for the `tsvector → Typesense` cutover; whether
  Meilisearch is ever a target.

#### Engines explicitly rejected

For the record (don't relitigate without evidence):

- **MongoDB Atlas** — Free tier is tiny; prefer JSONB unless we must.
- **Redis Cloud / ElastiCache** — Needs persistent conns; bad fit
  for serverless.
- **FaunaDB** — Vendor lock and pricing opacity.
- **PlanetScale** — Post-Vitess-changes; revisit later.
- **Neo4j Aura** — Only if workload is truly graph-native.
- **CockroachDB** — Phase 3 only; great at scale, expensive early.

### Cross-cutting

- **Validator parity per engine.** `GLOBAL-015` (power-user escape
  hatch) requires raw Mongo / connection-string queries to work. Per-
  engine validator paths (analogous to `apps/api/src/ask/sql-
  validate.ts`) need to ship with each adapter — see the
  `sql-allowlist` skill.
- **OTel attribute parity per engine.** `GLOBAL-014` requires every
  external call wrapped in a span with canonical attributes from
  `docs/performance.md §3`. Per-engine attribute mapping (Redis
  command, Mongo aggregation pipeline depth, ClickHouse query id) is
  TBD.
- **Connection pool ownership.** `docs/architecture.md §10 §2.2`: "We own the
  connection pool per user-DB. PgBouncer-style, but ours — see §6."
  Each engine has different connection semantics — Postgres has
  long-lived connections + transactions; Redis (HTTP via Upstash)
  has none; DuckDB is in-process. The per-engine pool model is open.
- **Schema-widening mapping per engine.** `GLOBAL-004` was specified
  for Postgres semantics; per-engine widening rules (a Mongo doc that
  gains a nested field; a Redis hash that gains a key) are TBD.
  Coordinate with `SK-SCHEMA-NNN` once that skill is populated.
- **Plan-cache key per engine.** `GLOBAL-006` keys plans by
  `(schema_hash, query_hash)`. After multi-engine adapters land, do
  we add an `engine` dimension, or does `query_hash` already capture
  engine choice via the structured plan? See `SK-PLAN-NNN`.
- **Cost ceilings per engine.** `GLOBAL-013` ($0/month free tier).
  Some engines (ClickHouse, dedicated DuckDB sidecar, Mongo Atlas
  past free tier) have non-zero floor cost. How is that gated against
  free-tier eligibility?

## Phase-3 entry checklist (provisional)

Ahead of the first SK-MULTIENG decision, these need to land:

1. The Phase 0/1/2 Postgres adapter (`SK-DB-NNN`) is stable and the
   common contract it embodies has been documented.
2. The `Executor` interface is named, written, and tested against
   the Postgres adapter as a single-engine reference implementation.
3. `docs/architecture.md §10 §2.5` Phase 2 exit gate is met (ties the
   engine-migration skill to this one — they ship together in
   Phase 3).
4. Per-engine validator paths (`sql-allowlist` parity) are scoped.

## Source pointers

- `docs/architecture.md §10 §2.1` — architecture (per-engine executors fan-out)
- `docs/architecture.md §10 §2.2` — Execution layer subsection (`Executor`
  interface, per-DB connection pool)
- `docs/architecture.md §10 §2.3` — engine selection heuristics
- `docs/architecture.md §11` — alternative technologies, per-engine verdict
- `docs/architecture.md §10 §6` — Phase 3 slice list
- `packages/db/AGENTS.md` and the `db-adapter` skill (when
  populated) — current single-engine adapter contract
