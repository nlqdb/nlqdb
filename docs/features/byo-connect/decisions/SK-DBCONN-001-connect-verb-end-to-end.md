# SK-DBCONN-001 — `POST /v1/db/connect` end-to-end: route + standalone orchestrator + `clickhouse-byo` exec + query-time engine dispatch + sealed-blob storage

- **Decision:** `POST /v1/db/connect { engine, connection_url, name? }`
  (signed-in only) is the single verb that turns the landed connect-path
  primitives into a live, queryable BYO database. The route handler
  (inline in `apps/api/src/index.ts`) is a thin shell over a **standalone
  orchestrator** (`apps/api/src/db-connect/connect.ts`) that runs one fixed
  pipeline for both engines:
  1. `validateByoConnection(engine, connection_url, createDohResolver())`
     ([`SK-DB-013`](../../db-adapter/decisions/SK-DB-013-byo-connect-validation-pipeline.md))
     — parse-then-egress-resolve-recheck, fail-loud
     ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)) before
     any I/O; returns the engine-tagged parsed connection;
  2. introspect — `introspectPostgres`
     ([`SK-DB-014`](../../db-adapter/decisions/SK-DB-014-byo-postgres-introspection.md))
     or `introspectClickhouse`
     ([`SK-MULTIENG-007`](../../multi-engine-adapter/decisions/SK-MULTIENG-007-byo-clickhouse-introspection.md));
  3. render — `renderByoPostgresSchema`
     ([`SK-DB-015`](../../db-adapter/decisions/SK-DB-015-byo-postgres-schema-render.md))
     (the ClickHouse render is its parallel) → `{ schema_text, schema_hash }`;
  4. **seal** — AES-GCM the full `connection_url` via `secret-envelope.ts`
     ([`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md), context
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
  Surface parity per [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md):
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
