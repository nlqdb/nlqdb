# SK-DB-014 — BYO Postgres connect-time schema introspection: three fixed `pg_catalog` queries into a faithful read-model

Parent feature: [`db-adapter/FEATURE.md`](../FEATURE.md). The connect-path step
*after* validation ([`SK-DB-013`](./SK-DB-013-byo-connect-validation-pipeline.md))
and *before* sealing ([`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md),
[`apps/api/src/secret-envelope.ts`](../../../../apps/api/src/secret-envelope.ts)):
once a connection is validated and the caller has a live query function, this
turns the user's existing schema into the description `/v1/ask` plans against.
Pins the introspection clause of the decided BYO shape
([`architecture.md §3.6.7`](../../../architecture.md#367-byo-postgres-phase-4-decided-shape),
[`SK-DB-011`](./SK-DB-011-byo-postgres-promoted.md)).

- **Decision:** One module, `packages/db/src/introspect-postgres.ts`, exposes
  `introspectPostgres(query, schema)` — given the `SK-DB-006` injected query
  seam bound to a BYO connection and a target schema, it reads the *live*
  schema into a faithful read-model (`IntrospectedSchema`: tables with ordered
  columns `{ name, type, nullable }` + ordered `primaryKey`, plus
  `foreignKeys`). It runs **three fixed `pg_catalog` queries regardless of
  table count** — columns, primary keys, foreign keys — run concurrently
  (`Promise.all`), never one-query-per-table. All three read only `pg_catalog`
  (one visibility model: exactly what the connecting role can see) and the
  schema is always a bound `$1` parameter, never interpolated. Column types are
  the `format_type(atttypid, atttypmod)` rendering (`character varying(255)`,
  `numeric(10,2)`, `text[]`, enum names) — not `information_schema.columns`,
  which flattens those to `ARRAY` / `USER-DEFINED`. Composite primary/foreign
  keys keep correct column order via `unnest(...) WITH ORDINALITY` over the
  `smallint[]` `conkey`/`confkey` catalog arrays. Scope is ordinary +
  partitioned tables (`relkind IN ('r','p')`) — the literal "existing table" of
  the decided shape; views are a later explicit decision, not a silent
  inclusion. Emits **one** `db.introspect` span for the whole connect-time read
  ([`GLOBAL-014`](../../../decisions/GLOBAL-014-otel-on-external-calls.md)) —
  not one per query — recording into `nlqdb.db.duration_ms{operation=introspect}`,
  and throws fail-loud ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md))
  on a query failure so the caller surfaces a connect error and never seals.
- **Core value:** Bullet-proof, Fast, Simple
- **Why:** BYO Postgres needs the same faithful "table names, columns + types,
  foreign keys" description the hosted create path gets from its compiled DDL
  (`orchestrate.ts` step 5) — except the schema already exists, so it is *read*,
  not authored. The two failure modes that make naïve introspection wrong are
  worth designing out once: (1) **fan-out** — a loop that issues one query per
  table turns a 200-table connect into 200 round-trips on the Workers free tier
  (`GLOBAL-013`); three fixed queries keep it at three regardless of size. (2)
  **lossy / cartesian metadata** — `information_schema` flattens real types to
  `ARRAY`/`USER-DEFINED` (the planner then can't tell `text[]` from `jsonb`),
  and its kcu↔ccu join cartesian-products composite foreign keys; reading
  `pg_catalog` with `format_type` + ordinal-aligned `unnest` is both faithful
  and composite-correct. A single `db.introspect` span (not per-query) keeps
  connect-time observability honest without spamming the trace. It is an
  internal primitive shipped ahead of its `registerByoDb` caller — the same
  pure-primitive-ahead-of-callers rhythm as `SK-DB-012`, `SK-DB-013`, and
  `secret-envelope.ts` — so it carries no
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  surface-parity obligation of its own; that lands with `/v1/db/connect`
  (`SK-DB-011`).
- **Consequence in code:** `packages/db/src/introspect-postgres.ts` exports
  `introspectPostgres` and the `IntrospectedSchema` / `IntrospectedTable` /
  `IntrospectedColumn` / `IntrospectedForeignKey` types, all re-exported from
  `@nlqdb/db`. `registerByoDb` (the open caller) calls it after
  `validateByoConnection` succeeds and the connection is opened, renders the
  read-model into the `schema_text`/`schema_hash` it seals + writes to D1, and
  surfaces a thrown introspection error as the connect 4xx/5xx. Tests in
  `packages/db/test/introspect-postgres.test.ts` pin column/PK ordering, the
  composite-FK grouping, the empty-schema shape, the bound-parameter (never
  interpolated) contract, and the single-span / `operation=introspect`
  observability contract. A future `introspect-clickhouse.ts` is the
  `SK-MULTIENG` parallel (`system.columns`), not a generalisation of this
  Postgres-specific catalog reader.
- **Alternatives rejected:**
  - **`information_schema` for everything.** Loses faithful types
    (`ARRAY`/`USER-DEFINED` instead of `text[]`/the enum name) and
    cartesian-products composite foreign keys via the kcu↔ccu join — both
    silently wrong for the planner. `pg_catalog` + `format_type` + ordinal
    `unnest` is faithful and correct.
  - **One query per table (table-card loop).** Linear round-trips; a wide
    schema blows the connect-time budget on the free tier. Three fixed queries
    are flat in table count.
  - **`pg_dump` / DDL text.** The decided shape rejects it
    (`architecture.md §3.6.7`); the planner wants a structured read-model, not
    DDL to re-parse, and `pg_dump` isn't reachable over the HTTP driver anyway.
  - **One span per query.** Three spans per connect is trace spam for a single
    logical operation; one `db.introspect` span with its own duration metric is
    the honest unit.
  - **Reuse the create-path `SchemaPlan` Zod types as the result.** Those encode
    the *restricted* create-time contract (lower_snake_case identifiers, a
    closed `ColumnType` enum); a real user schema legitimately violates both, so
    a faithful read-model uses its own permissive types.
- **Source:** canonical here · `SK-DB-011` (the `/v1/db/connect` +
  `registerByoDb` shape this feeds) · `SK-DB-013` (the validation step before
  it) · `SK-DB-006` (the injected query seam) · `GLOBAL-014` (the span) ·
  `GLOBAL-013` (free-tier round-trip budget) · `architecture.md §3.6.7` (the
  decided BYO introspection clause).
