# SK-MULTIENG-007 — BYO ClickHouse connect-time schema introspection: two fixed `system.*` queries into a faithful read-model

Parent feature: [`multi-engine-adapter/FEATURE.md`](../FEATURE.md). The
ClickHouse parallel of [`SK-DB-014`](../../db-adapter/decisions/SK-DB-014-byo-postgres-introspection.md):
the connect-path step *after* validation
([`SK-DB-013`](../../db-adapter/decisions/SK-DB-013-byo-connect-validation-pipeline.md),
the shared `validateByoConnection` with its `engine: "clickhouse"` branch) and
*before* sealing ([`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md)).
Once a BYO ClickHouse connection is validated and the caller has a live query
function, this turns the user's existing ClickHouse schema into the description
`/v1/ask` plans against. Pins the `system.columns` introspection clause of
[`SK-MULTIENG-005`](./SK-MULTIENG-005-byo-clickhouse-promoted.md)
([`architecture.md §3.6.7`](../../../architecture.md#367-byo-postgres-phase-4-decided-shape)).

- **Decision:** One module, `packages/db/src/introspect-clickhouse.ts`, exposes
  `introspectClickhouse(query, database)` — given a `ClickhouseQueryFn` injected
  seam (the ClickHouse parallel of `SK-DB-006`'s `PostgresQueryFn`; named params
  bound server-side via `{name:Type}`, not positional) bound to a BYO connection
  and a target database, it reads the *live* schema into a faithful read-model
  (`IntrospectedClickhouseSchema`: tables with position-ordered columns
  `{ name, type, nullable }` + the `primaryKey` expression). It runs **two fixed
  `system.*` queries regardless of table count** — `system.tables` (authoritative
  table list + effective `primary_key`) and `system.columns` (every column's
  name + verbatim type) — run concurrently (`Promise.all`), never
  one-query-per-table. The `database` is always a bound `{database:String}`
  server-side parameter, never interpolated. Three ClickHouse-specific shapes the
  Postgres reader has no analogue for: **(1) no foreign keys** — ClickHouse has
  none, so the read-model carries no FK field rather than an always-empty one;
  **(2) the primary key is an expression, not a column list** —
  `system.tables.primary_key` reports it verbatim (`toYYYYMM(event_date),
  user_id`), and a ClickHouse key need not be column-position-ordered, so
  reconstructing an ordered column list from `is_in_primary_key` would be wrong;
  **(3) nullability is in the type** (`Nullable(T)`), not a flag column, so
  `nullable` is derived from the *outermost* type wrapper — one
  `LowCardinality(...)` is unwrapped first (`LowCardinality(Nullable(String))`
  is nullable) but an inner `Nullable(` is ignored (`Array(Nullable(String))` is
  a non-nullable array of nullable elements). The full type string is kept
  verbatim for the planner. Scope is the logical queryable table: views /
  materialized views (engine names all contain `View`) and temporary tables are
  excluded in SQL (`engine NOT LIKE '%View%' AND is_temporary = 0`), so a view
  never leaks back as a table, and a column whose table isn't in that
  authoritative set is dropped on assembly. Emits **one** `db.introspect` span
  for the whole connect-time read
  ([`GLOBAL-014`](../../../decisions/GLOBAL-014-otel-on-external-calls.md)) —
  `db.system=other_sql` per [`SK-MULTIENG-004`](../FEATURE.md#sk-multieng-004),
  not one per query — recording into `nlqdb.db.duration_ms{operation=introspect}`
  (the same operation label as the Postgres reader; the engine shows on the
  span's `db.system`, not the metric label, so the cardinality budget is
  unchanged), and throws fail-loud
  ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)) on a
  query failure so the caller surfaces a connect error and never seals.
- **Core value:** Bullet-proof, Fast, Simple
- **Why:** BYO ClickHouse needs the same faithful "table names, columns + types"
  description every other engine gives the planner — except the schema already
  exists, so it is *read* from `system.*`, not authored. The two failure modes
  that make naïve ClickHouse introspection wrong are worth designing out once:
  **(1) fan-out** — a query-per-table loop turns a 200-table connect into 200
  round-trips on the Workers free tier ([`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md));
  two fixed queries keep it flat. **(2) lying about ClickHouse semantics** —
  forcing the Postgres `IntrospectedSchema` (column-list PK + foreign keys) onto
  ClickHouse would invent FKs it doesn't have and misorder an expression key;
  surfacing the `primary_key` expression verbatim and dropping FK is both
  faithful and simpler. A single `db.introspect` span (not per-query) keeps
  connect-time observability honest without spamming the trace. It is an internal
  primitive shipped ahead of its `clickhouse-byo.ts` adapter + `registerByoDb`
  callers — the same primitive-ahead-of-callers rhythm as `SK-MULTIENG-006`,
  `SK-DB-012/013/014`, and `secret-envelope.ts` — so it carries no
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  surface-parity obligation of its own; that lands with `/v1/db/connect`
  (`SK-MULTIENG-005`).
- **Consequence in code:** `packages/db/src/introspect-clickhouse.ts` exports
  `introspectClickhouse`, the `ClickhouseQueryFn` seam, and the
  `IntrospectedClickhouseSchema` / `IntrospectedClickhouseTable` /
  `IntrospectedClickhouseColumn` types, all re-exported from `@nlqdb/db`. It
  reuses the `other_sql` `db.system` constant from
  `clickhouse-tinybird/otel-attrs.ts` rather than re-declaring it. `registerByoDb`
  (the open caller) calls it after `validateByoConnection` succeeds on the
  `clickhouse` branch and the connection is opened, renders the read-model into
  the `schema_text`/`schema_hash` it seals + writes to D1, and surfaces a thrown
  introspection error as the connect 4xx/5xx. Tests in
  `packages/db/test/introspect-clickhouse.test.ts` pin column position-ordering +
  verbatim types, the PK-expression passthrough, the outermost-wrapper
  nullability rule (incl. `Array(Nullable(...))` staying non-nullable), the
  view/temp-table exclusion guard, the drop of columns whose table isn't in the
  authoritative set, the empty-schema shape, deterministic table ordering, the
  bound-parameter (never interpolated) contract, and the single-span /
  `db.system=other_sql` / `operation=introspect` observability contract.
- **Alternatives rejected:**
  - **Reuse the Postgres `IntrospectedSchema` shape.** It encodes a column-list
    primary key + foreign keys — both wrong for ClickHouse (expression keys, no
    FKs). A faithful read-model uses ClickHouse-specific types, the same way
    `SK-MULTIENG-006` is a parallel of `SK-DB-012`, not a generalisation.
  - **Reconstruct an ordered PK column list from `is_in_primary_key`.**
    `system.columns` flags membership but not key order, and a ClickHouse key can
    be column-position-disordered or an expression — the reconstruction is
    silently wrong. The `system.tables.primary_key` expression is what ClickHouse
    itself reports.
  - **Substring `Nullable(` for the nullable flag.** Marks
    `Array(Nullable(String))` nullable when the array column is never NULL.
    Outermost-wrapper detection (unwrap one `LowCardinality`) matches ClickHouse
    semantics.
  - **One query per table.** Linear round-trips; a wide schema blows the
    connect-time budget on the free tier. Two fixed queries are flat in table
    count.
  - **One span per query.** Two spans per connect is trace spam for one logical
    operation; one `db.introspect` span with its own duration metric is the
    honest unit (same posture as `SK-DB-014`).
- **Source:** canonical here · `SK-MULTIENG-005` (the BYO ClickHouse
  `/v1/db/connect` + `registerByoDb` shape this feeds) · `SK-MULTIENG-006` (the
  connection-URL parser before it) · `SK-DB-013` (the shared validation step) ·
  `SK-DB-014` (the Postgres parallel) · `SK-MULTIENG-004` (`db.system=other_sql`) ·
  `GLOBAL-014` (the span) · `GLOBAL-013` (free-tier round-trip budget).
