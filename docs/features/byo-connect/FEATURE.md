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

- **(a) ClickHouse SQL is validated by the Postgres read/write validator — Decided: no per-grammar CH parser; keep the dialect-agnostic allowlist load-bearing, make the PG AST parse engine-aware (2026-07-08).**
  Correction first: the read/write validator (`sql-validate.ts`, applied
  upstream to CH per `build-deps.ts:119`) is **`node-sql-parser`-based**, not
  `libpg_query` (that's the DDL sibling `sql-validate-ddl.ts`) — it parses with
  `database: "PostgreSQL"` (`sql-validate.ts:274`). Research (P2, 2026-07-08):
  `node-sql-parser` (v5.4.0) ships **no ClickHouse dialect** (PG/MySQL/BigQuery/
  Redshift/Snowflake/… only), so there is no config that makes it parse CH; the
  JS ClickHouse parsers that exist (`dt-sql-parser`, `clickhouse-ast-parser`) are
  ANTLR4-generated and bust the Workers/`GLOBAL-013` bundle budget. So a
  `sql-validate-clickhouse.ts` per-grammar validator is **rejected** — the false
  `parse_failed` risk is real (valid CH-only grammar — `LIMIT n BY`, parametric
  aggregates like `quantile(0.5)(x)`, `ARRAY JOIN`, `WITH ROLLUP` — fails the PG
  parse), but the security-load-bearing guard is the **engine-agnostic
  leading-verb allowlist** (`ALLOWED_LEADING` / `LEADING_VERB_REJECT`, which run
  *before* the AST parse and are dialect-independent) plus the multi-statement
  reject — exactly the `SK-MULTIENG-004` "allowlist is load-bearing since CH
  `readonly=1` doesn't block DDL" posture. The PG-dialect AST embedded-verb walk
  is best-effort defense-in-depth that cannot reliably run on CH grammar anyway.
  **Scoped fix (non-blocking correctness follow-up, not a new open question):**
  thread `engine` into `validateSql` so a PG-dialect `parse_failed` is **not
  authoritative for CH** — enforce the leading-verb allowlist + multi-statement
  guard on the raw string, and keep the embedded-verb walk only when the parse
  succeeds. Needs a live-CH query test before it ships (no CH fixture in the unit
  env this run), so it lands in a dedicated PR with a CH read/write test, not a
  daily doc run. **Revisit trigger:** an observed CH-only false-reject in the
  wild, or managed-Tinybird landing its Pipe/table allowlist (`SK-MULTIENG-004`),
  whichever first.
- **(b) The planner emits Postgres-flavored SQL for a ClickHouse DB — Decided: dialect-aware prompting (extend the existing `Dialect:` parameter to `clickhouse`), not a transpile layer; ships coupled with (a)'s engine-aware `validateSql` (2026-07-09).**
  Diagnosis (code, 2026-07-09): the planner is *already* dialect-parameterized —
  `PLAN_SYSTEM` says "translate … for the named dialect" + "Emit SQL valid for
  the named dialect" and the few-shot exemplars carry a `Dialect:` line
  (`packages/llm/src/prompts.ts`, `SK-LLM-018`/`SK-LLM-026`). The gap is upstream:
  `PlanRequest.dialect` is typed `"postgres" | "sqlite"` (`types.ts:88`) and
  `orchestrate.ts` **hardcodes `dialect: "postgres"`** at both plan sites
  (`:242` initial, `:414` exec-repair), so a ClickHouse-BYO DB is told it is
  Postgres and emits PG-flavored SQL. `db.engine` is already in scope in the same
  function (`orchestrate.ts:544`). Research (P2, 2026-07-09): the two options are
  (1) **dialect-aware prompting** — name the target dialect in the prompt, the
  standard for LLM text-to-SQL and exactly the existing `Dialect:` mechanism; and
  (2) **generate-then-transpile** (SQLGlot / ANTLR). (2) is **rejected** on the
  same `GLOBAL-013` Workers-bundle constraint that killed the per-grammar CH
  parser in (a) — no in-Worker JS transpiler fits the budget. So (1) is decided:
  extend the existing parameterization, don't add a compile layer.
  **Coupling with (a) is load-bearing:** emitting CH-only grammar (`LIMIT n BY`,
  `quantile(0.5)(x)`, `ARRAY JOIN`) requires `validateSql` to stop treating a
  PG-dialect `parse_failed` as authoritative for CH — (a)'s scoped fix. Ship (b)
  without (a) and the validator would reject the very CH SQL (b) produces. So the
  **scoped code follow-up lands as one PR with (a):** add `"clickhouse"` to
  `PlanRequest.dialect`; map `db.engine → dialect` at the two `orchestrate.ts`
  plan sites (replacing the hardcoded `"postgres"`); add a CH-syntax exemplar to
  `PLAN_SYSTEM`; ship alongside (a)'s engine-aware `validateSql` + a live-CH
  read/write fixture (no CH fixture in the unit env, per (a)). Not a security gap —
  a correctness gap. **Revisit trigger:** managed-Tinybird landing
  (`SK-MULTIENG-004`) or an observed CH-BYO mis-compile in the wild, whichever first.
- **(c) DNS-rebind TOCTOU between connect-time guard and query-time use — Decided: re-resolve-before-use on both engines; sub-TTL residual accepted for the BYO threat model (2026-07-08).**
  `validateByoConnection` resolves-and-rechecks at connect time
  (`GLOBAL-035`), but a name resolved safe then can re-point to a private
  address before a later query. Mitigated by a **query-time egress re-guard**
  before each exec on **both** engines: the ClickHouse adapter re-runs
  `guardEgressHostResolved` inside `buildClickhouseByoQuery`
  (`packages/db/src/clickhouse-byo.ts:107`), and the BYO-PG runner
  (`runByoPgQuery` in `apps/api/src/ask/build-deps.ts:280`) re-resolves +
  re-classifies the host before issuing the query, failing closed on a
  private/reserved verdict. This is the industry-standard TOCTOU mitigation for
  server-side fetches — *re-validate the resolved IP immediately before use*
  (OWASP SSRF guidance; the ragflow/thingsboard/postiz 2025–26 fixes take the
  same shape). A **residual sub-TTL window** remains (an attacker controlling
  DNS with a TTL shorter than the re-guard→fetch gap; neither adapter can pin
  the resolved IP into the underlying `fetch`). **Full closure** is IP-pinning
  at the connection layer — dial the validated IP with the hostname in the
  `Host` header, or route egress through a pinning proxy (Stripe's Smokescreen)
  — which neither `neon()` nor Workers `fetch` exposes today. **Accepted for
  BYO**: the user supplied their own host, so the only reachable target is their
  own infrastructure (self-attack). **Revisit trigger stands**: if a non-BYO
  outbound path is ever added, the target is no longer user-owned and IP-pinning
  becomes load-bearing.
- **(d) `connection_secret_ref` kept NOT NULL via the `__byo_blob__` sentinel — Resolved (additive design).**
  The sentinel keeps the migration additive (one nullable column, no constraint
  relaxation). Conditional follow-up only: if a future schema rev makes the column
  nullable, the sentinel read-path in `db-registry.ts` must be retired in the same
  change.
- **KEK rotation for the BYO blob — Resolved (2026-07-09), see
  [`GLOBAL-031`](../../decisions/GLOBAL-031-byo-secret-envelope.md).**
  The procedure is now scoped there for the shared envelope (BYO blob +
  BYOLLM keys alike): the KEK version travels *in* the envelope (prefix
  bump `nbe1.` → `nbe2.<v>.`), **not** a `key_version` D1 column; a
  two-KEK overlap window (`BYO_SECRET_KEK` active + `BYO_SECRET_KEK_PREV`
  retiring) lets `openSecret` pick by version while `sealSecret` always
  seals under the active one; re-wrap is lazy-on-write + one operator
  sweep (decrypt-then-reseal, no stored DEK). Implementation ships when a
  rotation is first scheduled (`GLOBAL-033`); executing one needs prod key
  material (runbook + `blocked-by-human.md`).
