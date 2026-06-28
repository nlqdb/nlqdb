---
name: byo-connect
description: The end-to-end BYO-database connect verb — POST /v1/db/connect — that turns the landed connect-path primitives into a live, queryable BYO Postgres / ClickHouse.
when-to-load:
  globs:
    - apps/api/src/db-connect/**
    - apps/api/src/ask/build-deps.ts
    - packages/db/src/clickhouse-byo.ts
  topics: [byo, connect, clickhouse, postgres, db-connect, sealed-blob]
---

# Feature: BYO Connect

**One-liner:** The end-to-end bring-your-own-database connect verb —
`POST /v1/db/connect` — that composes the landed connect-path primitives
(`SK-DB-012..015`, `SK-MULTIENG-005..007`, `GLOBAL-031`, `GLOBAL-035`) into a
live, queryable BYO Postgres / ClickHouse, plus the query-time engine dispatch
that runs the user's own engine on the `/v1/ask` path.
**Status:** connect route + query path implemented (`SK-DBCONN-001`) — replaces
the "primitives landed, `connect.ts` wiring remains" gap that `db-adapter` and
`multi-engine-adapter` carried. Open gaps (ClickHouse SQL dialect, validator,
TOCTOU residual) tracked under *Open questions* below.
**Owners (code):** `apps/api/src/db-connect/connect.ts` (orchestrator) +
the `POST /v1/db/connect` route handler in `apps/api/src/index.ts`,
`packages/db/src/clickhouse-byo.ts`, `apps/api/src/ask/build-deps.ts`
(`dispatchExec` engine dispatch), `apps/api/migrations/*_byo_connection_blob.sql`
**Cross-refs:** [`db-adapter/FEATURE.md`](../db-adapter/FEATURE.md)
(`SK-DB-011` BYO Postgres, `SK-DB-013` validation pipeline, `SK-DB-014`
introspection, `SK-DB-015` schema render) · [`multi-engine-adapter/FEATURE.md`](../multi-engine-adapter/FEATURE.md)
(`SK-MULTIENG-005` BYO ClickHouse, `SK-MULTIENG-006` URL parser,
`SK-MULTIENG-007` introspection) · [`web-app/FEATURE.md`](../web-app/FEATURE.md)
(`SK-WEB-019` `/app/connect` page, `SK-WEB-018` Door B) · GLOBALs below.

## Touchpoints — read this feature doc before editing

- `apps/api/src/db-connect/connect.ts` — the standalone `POST /v1/db/connect` orchestrator (route handler is inline in `apps/api/src/index.ts`)
- `packages/db/src/clickhouse-byo.ts` — the BYO ClickHouse HTTP exec adapter
- `apps/api/src/ask/build-deps.ts` — query-time engine dispatch (`dispatchExec`: PG hosted / PG BYO / ClickHouse-BYO)

## Decisions

### SK-DBCONN-001 — `POST /v1/db/connect` end-to-end: route + standalone orchestrator + `clickhouse-byo` exec + query-time engine dispatch + sealed-blob storage

- **Decision:** `POST /v1/db/connect { engine, connection_url, name? }`
  (signed-in only) is the single verb that turns the landed connect-path
  primitives into a live, queryable BYO database. The route handler
  (inline in `apps/api/src/index.ts`) is a thin shell over a **standalone
  orchestrator** (`apps/api/src/db-connect/connect.ts`) that runs one fixed
  pipeline for both engines:
  1. `validateByoConnection(engine, connection_url, createDohResolver())`
     ([`SK-DB-013`](../db-adapter/decisions/SK-DB-013-byo-connect-validation-pipeline.md))
     — parse-then-egress-resolve-recheck, fail-loud
     ([`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md)) before
     any I/O; returns the engine-tagged parsed connection;
  2. introspect — `introspectPostgres`
     ([`SK-DB-014`](../db-adapter/decisions/SK-DB-014-byo-postgres-introspection.md))
     or `introspectClickhouse`
     ([`SK-MULTIENG-007`](../multi-engine-adapter/decisions/SK-MULTIENG-007-byo-clickhouse-introspection.md));
  3. render — `renderByoPostgresSchema`
     ([`SK-DB-015`](../db-adapter/decisions/SK-DB-015-byo-postgres-schema-render.md))
     (the ClickHouse render is its parallel) → `{ schema_text, schema_hash }`;
  4. **seal** — AES-GCM the full `connection_url` via `secret-envelope.ts`
     ([`GLOBAL-031`](../../decisions/GLOBAL-031-byo-secret-envelope.md), context
     `dbconn:<dbId>`), store the ciphertext in a new
     **`databases.connection_blob`** column; persist `parsed.redacted` for the
     connection pill;
  5. mint a `pk_live_<dbId>` per-DB key and return `{ dbId, schema_text,
     pk_live, redacted }`.
  **BYO rows keep `connection_secret_ref` NOT NULL** by writing a sentinel
  `connection_secret_ref = "__byo_blob__"` — the registry reads the blob
  instead of an env secret when it sees the sentinel, so the migration is
  purely additive (one new nullable column, no relaxed constraint). A new
  **`packages/db/src/clickhouse-byo.ts`** exec adapter runs ClickHouse over its
  native HTTP interface (Workers `fetch`, no TCP socket — per `SK-MULTIENG-005`)
  with one `db.query` span (`db.system=other_sql`, `SK-MULTIENG-004`).
  **Query-time engine dispatch** (`dispatchExec` in
  `apps/api/src/ask/build-deps.ts`) reads the `DbRecord.engine` (+ presence of a
  sealed `connectionBlob`) and routes the compiled SQL to the hosted-PG, BYO-PG,
  or `clickhouse-byo` runner — the same dispatch-by-DB-engine the cross-engine
  `nlq run` semantics already assume (`multi-engine-adapter` Open questions).
  Surface parity per [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md):
  SDK `client.databases.connect`, CLI `nlq db connect`, MCP
  `nlqdb_connect_database` ship the same PR; **elements is documented N/A** — a
  credential-connect verb has the wrong trust model for a `pk_live`-scoped
  embed (the embed holds a read-scoped key, never a connection credential).

- **Core value:** Open source, Effortless UX, Bullet-proof, Goal-first

- **Why:** Every BYO "Next" across `db-adapter` and `multi-engine-adapter`
  named the same missing step — *compose the landed primitives behind the
  `/v1/db/connect` verb.* The primitives were built pure and tested ahead of
  callers precisely so this composition is the only remaining wiring; doing it
  as **one standalone orchestrator** (not branching logic smeared across the
  route handler) keeps the parse→introspect→render→seal→store ordering in one
  auditable place for both engines, the same reason `validateByoConnection`
  itself is one composed primitive. Reusing `connection_secret_ref` with a
  `__byo_blob__` sentinel keeps the D1 migration additive — no constraint
  relaxation, no backfill — which matters because D1 migrations on the free
  tier are forward-only. ClickHouse over native HTTP (not a driver) is the only
  Workers-compatible transport (`GLOBAL-013`, `SK-MULTIENG-005`). Query-time
  dispatch by the DB's recorded engine is the seam that makes "question your
  ClickHouse" actually run on ClickHouse rather than silently hitting Postgres.
  Elements is N/A by trust model, not by oversight: the embed is a public-page
  artifact holding a read-scoped `pk_live`; handing it a connect verb would put
  a credential-accepting endpoint behind a key designed to be pasted into HTML.

- **Consequence in code:** New `apps/api/src/db-connect/connect.ts`
  (orchestrator) + the `POST /v1/db/connect` route handler inline in
  `apps/api/src/index.ts`, and `packages/db/src/clickhouse-byo.ts` (HTTP exec).
  New `databases.connection_blob` column via an additive migration;
  `db-registry.ts` returns the blob when `connection_secret_ref === "__byo_blob__"`
  and `dispatchExec` (`ask/build-deps.ts`) opens it (`secret-envelope.ts`) to a
  plaintext DSN at execute time and dispatches on `DbRecord.engine`. The connect handler
  returns the `GLOBAL-012` message as the 4xx body on any pipeline failure,
  never echoing the URL. SDK/CLI/MCP carry the verb in the same PR; the
  `<nlq-data>` element does **not** (N/A, recorded under Open questions per
  `GLOBAL-003`'s tracked-gap clause). The reused **Postgres-dialect**
  `sql-validate.ts` runs on the ClickHouse path for now (see Open questions (a)).

- **Alternatives rejected:**
  - **Branch the pipeline inside the route handler per engine.** Two copies of
    the ordering drift (the failure mode `SK-DB-013` already rejected one layer
    down); a single orchestrator keeps the safe ordering the only ordering.
  - **A second `/v1/db/connect/clickhouse` endpoint.** Violates `GLOBAL-017`
    (one way to do each thing); `engine` is a field, not a path.
  - **Relax `connection_secret_ref` to NULL for BYO rows.** A non-additive D1
    migration (constraint change + interpretation fork); the `__byo_blob__`
    sentinel is the cheaper, forward-only edit.
  - **Use a ClickHouse driver / TCP socket.** No warm sockets on Workers free
    tier (`SK-DB-003`, `GLOBAL-013`); native HTTP `fetch` is the only fit.
  - **Ship the connect verb to `<nlq-data>` for parity.** Wrong trust model — a
    credential-connect verb behind a read-scoped public-embed key; recorded N/A.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL;
index in [`docs/decisions.md`](../../decisions.md)). The list below names the
rules that constrain this feature; any feature-local commentary is nested under
the rule.

- **GLOBAL-003** — New capabilities ship to all surfaces in one PR.
  - *In this feature:* `/v1/db/connect` ships to SDK (`client.databases.connect`),
    CLI (`nlq db connect`), and MCP (`nlqdb_connect_database`) in the same PR;
    `<nlq-data>` is **N/A** (wrong trust model — a credential-connect verb does
    not belong behind a read-scoped public-embed key) and is recorded as a
    tracked gap, not a TODO.
- **GLOBAL-012** — Errors are one sentence with the next action.
  - *In this feature:* the connect handler returns `validateByoConnection`'s
    one-sentence message verbatim as the 4xx body, never echoing the URL.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle.
  - *In this feature:* `clickhouse-byo.ts` uses Workers `fetch` only (no driver);
    the BYO DB runs on the user's own bill, no per-tenant infra cost.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* introspection emits `db.introspect`; the
    `clickhouse-byo` exec emits `db.query` (`db.system=other_sql`).
- **GLOBAL-017** — One way to do each thing.
  - *In this feature:* `engine` is a field on the one connect verb, never a
    per-engine endpoint.
- **GLOBAL-031** — One AES-256-GCM at-rest envelope + one Workers-held KEK for
  every BYO secret.
  - *In this feature:* the `connection_url` is sealed (context `dbconn:<dbId>`,
    owner-AAD-bound) into `databases.connection_blob`; only `parsed.redacted`
    lives unsealed (the connection pill). The adapter gets a plaintext DSN at
    execute time — the envelope is the storage boundary, not the adapter
    contract.
- **GLOBAL-035** — One egress guard for every BYO outbound connection host.
  - *In this feature:* applied at connect time via `validateByoConnection`
    (`SK-DB-013`); see Open question (c) for the query-time re-guard.

## Open questions / known unknowns

- **(a) ClickHouse SQL is validated by the Postgres-dialect validator for now —
  false `parse_failed` risk.** `sql-validate.ts` is `libpg_query`-based; run on
  ClickHouse SQL it can reject valid ClickHouse grammar as `parse_failed`.
  Accepted as a known gap at launch (the validator allowlist per `SK-MULTIENG-004`
  is the load-bearing destructive-verb guard regardless). **Follow-up:** a
  `sql-validate-clickhouse.ts` per-grammar validator (the `SK-MULTIENG-004`
  per-engine-validator obligation).
- **(b) The planner emits Postgres-flavored SQL.** Correct ClickHouse SQL
  generation (engine-aware planner prompt / compile layer) is a separate
  follow-up; until it lands, ClickHouse-BYO queries that need ClickHouse-only
  syntax may be mis-compiled. Not a security gap — a correctness gap.
- **(c) DNS-rebind TOCTOU between connect-time guard and query-time use.**
  `validateByoConnection` resolves-and-rechecks at connect time
  (`GLOBAL-035`), but a name resolved safe then can re-point to a private
  address before a later query. Mitigated by a **query-time egress re-guard**
  before each exec on **both** engines: the ClickHouse adapter re-runs
  `guardEgressHostResolved` inside `buildClickhouseByoQuery`, and the BYO-PG
  runner (`runByoPgQuery` in `ask/build-deps.ts`) re-resolves + re-classifies
  the host before issuing the query. A **residual sub-TTL window** remains
  (an attacker controlling DNS with a TTL shorter than the re-guard→connect
  gap; neither adapter can pin the resolved IP into the underlying `fetch`).
  Acceptable for BYO (the user supplied their own host); revisit if a non-BYO
  outbound path is added.
- **(d) `connection_secret_ref` kept NOT NULL via the `__byo_blob__` sentinel.**
  The sentinel keeps the migration additive (one nullable column, no constraint
  relaxation). If a future schema rev makes the column nullable, the sentinel
  read-path in `db-registry.ts` must be retired in the same change.
- **KEK rotation for the BYO blob** — inherited from `SK-DB-011` /
  `GLOBAL-031`; the unwrap+re-wrap procedure + key-version column is still
  unscoped.
