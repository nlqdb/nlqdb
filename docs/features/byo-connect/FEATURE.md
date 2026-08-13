---
name: byo-connect
description: The end-to-end BYO-database connect verb — POST /v1/db/connect — that turns the landed connect-path primitives into a live, queryable BYO Postgres / ClickHouse.
when-to-load:
  globs:
    - apps/api/src/db-connect/**
    - apps/api/src/ask/build-deps.ts
    - packages/db/src/clickhouse-byo.ts
    - packages/db/src/postgres-supabase-mgmt.ts
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
`multi-engine-adapter` carried. **Supabase** connects via a
one-click **OAuth** button and runs over the **Management-API HTTPS transport**
(`read_only:true`, `SK-DBCONN-003`) — introspection + every query go through
`POST /v1/projects/{ref}/database/query`, not a socket, because postgres.js over
Workers sockets (`SK-DBCONN-002`) hangs ~18s against the Supavisor pooler in
production (Open question (g)). A **pasted** non-Neon Postgres DSN still uses the
`SK-DBCONN-002` socket path (same known risk). Open gaps (ClickHouse SQL dialect,
validator, TOCTOU residual, socket reachability, token-refresh concurrency)
tracked under *Open questions* below.
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

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-DBCONN-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-DBCONN-001**](decisions/SK-DBCONN-001-connect-verb-end-to-end.md) — `POST /v1/db/connect` end-to-end: route + standalone orchestrator + `clickhouse-byo` exec + query-time engine dispatch + sealed-blob storage.
- [**SK-DBCONN-002**](decisions/SK-DBCONN-002-byo-postgres-driver-postgres-js.md) — BYO Postgres runs on postgres.js over Workers `connect()` sockets, not the Neon HTTP driver (fixes `introspection_failed` for any non-Neon Postgres; supersedes the implicit Neon-HTTP-for-BYO in SK-DBCONN-001). **Field-failed for Supabase** — the pooler hangs ~18s on Workers (see SK-DBCONN-003 + Open question (g)); still the code path for a pasted non-Neon DSN.
- [**SK-DBCONN-003**](decisions/SK-DBCONN-003-oauth-supabase-mgmt-api-connect.md) — Supabase connects via OAuth + the Management-API HTTPS transport (`read_only:true`), not a socket DSN; `connectSupabaseMgmt` orchestrator, sealed OAuth token in `db_oauth_grants`, mgmt sentinel + query-time dispatch. Supersedes SK-DBCONN-002 for the Supabase path.

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
  `guardEgressHostResolved` inside `buildClickhouseByoQuery`, and the BYO-PG
  runner (`runByoPgQuery` in `apps/api/src/ask/build-deps.ts`) re-resolves +
  re-classifies the host before opening the socket (postgres.js connects lazily,
  so the re-guard runs before any dial), failing closed on a private/reserved
  verdict. This is the industry-standard TOCTOU mitigation for server-side
  fetches — *re-validate the resolved IP immediately before use* (OWASP SSRF
  guidance). A **residual sub-TTL window** remains: neither adapter pins the
  resolved IP into the underlying transport. **Full closure** is IP-pinning —
  dial the validated IP while keeping the hostname for TLS/`Host`. The Workers
  `connect()` primitive the BYO-PG path now rides (`SK-DBCONN-002`) *can* dial an
  `ip:port` directly, so pinning is feasible in principle, but postgres.js builds
  its own socket from the URL host and exposes no hook to override the dialled
  address, and the ClickHouse `fetch` path can't pin at all — so pinning stays
  deferred, not adopted. **Accepted for BYO**: the user supplied their own host,
  so the only reachable target is their own infrastructure (self-attack).
  **Revisit trigger stands**: if a non-BYO outbound path is ever added, the target
  is no longer user-owned and IP-pinning becomes load-bearing.
- **(d) `connection_secret_ref` kept NOT NULL via the `__byo_blob__` sentinel — Resolved (additive design).**
  The sentinel keeps the migration additive (one nullable column, no constraint
  relaxation). Conditional follow-up only: if a future schema rev makes the column
  nullable, the sentinel read-path in `db-registry.ts` must be retired in the same
  change.
- **(e) OAuth surface parity N/A (`SK-DBCONN-003`) — Resolved (tracked N/A).**
  `/start`+`/callback` are a browser-redirect flow; SDK/CLI/MCP have no consent
  browser, so OAuth is N/A there and paste (`connection_url`) stays — the same
  reasoned N/A class as `<nlq-data>` for the connect verb (`GLOBAL-003`). A future
  `nlq db connect --oauth` via local loopback is a separate capability, not a gap.
- **(f) Query-time as the Management-API admin, guarded only by `read_only:true`
  (`SK-DBCONN-003`) — Resolved: a connected Supabase DB is read-only, permanently
  (not "MVP").** "Question your database" must never let the planner write to a
  user's production DB, so every mgmt query runs in a `read_only:true` transaction
  and the leading-verb allowlist rejects non-reads before execution — two
  independent guards. No role is created in the user's DB (simpler, less invasive —
  `P5`), which is *more* honest than the original "we create a read-only role"
  copy: nlqdb creates nothing. Writes are **out of scope**, not a gap. **Revisit
  trigger (only if writes are ever a product decision):** a distinct, explicitly
  confirmed write path wrapping the statement in `SET LOCAL ROLE` + a provisioned
  RO role — a separate feature, never the default.
- **(g) postgres.js over Workers sockets hangs against the Supabase pooler
  (`SK-DBCONN-002`) — Resolved: decision + shipped mitigation.** Confirmed in prod
  (Cloudflare logs, 2026-08-12: ~18.7s hang → 502). Two-part resolution: (1)
  **Decision** — a non-Neon managed Postgres is connected via **OAuth / the
  Management-API transport** (Supabase today), which is the supported path; a
  *pasted* non-Neon Postgres DSN over the Workers socket is **best-effort**, not a
  supported guarantee. (2) **Mitigation shipped** — `introspectPostgres` now takes
  `{ sequential }`, and the socket path (`connect.ts`) sets it, so the three reads
  run one-at-a-time instead of `Promise.all`-pipelining onto a still-connecting
  socket (the leading hang cause); the mgmt HTTP path keeps the concurrent default.
  **Residual (folded into the decision, not a standing question):** live-verify
  against a real non-Neon *pasted* Postgres is the only trigger to reopen — if the
  serial read still hangs, move paste-Postgres onto a WS-proxy / Hyperdrive path.
- **(h) OAuth refresh-token rotation race under concurrency (`SK-DBCONN-003`) —
  Resolved: covered by Supabase's refresh-token reuse interval.** `grant-store`
  refreshes + reseals + persists last-write-wins. Supabase issues **single-use
  refresh tokens with a ~10-second reuse interval** (auth-server behavior,
  P2-checked 2026-08 — [Supabase sessions docs](https://supabase.com/docs/guides/auth/sessions)):
  a refresh token can be exchanged more than once inside that window, so two
  concurrent refreshes both succeed and neither is stranded — exactly the window our
  last-write-wins persist can open. No single-flight needed at any realistic connect
  QPS. **Revisit trigger:** if the management-OAuth issuer ever enforces strict
  single-use *and* "needs reconnect" churn appears on an active mgmt DB →
  single-flight the refresh (KV lock) or cache the access token.
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
