# SK-DBCONN-003 — Supabase "Connect" via OAuth + the Management-API HTTPS transport (read-only), not a socket DSN

- **Decision:** A Supabase database is connected through a provider **OAuth**
  handshake (`GET /v1/db/connect/oauth/supabase/{start,callback,projects,select}`;
  RFC 9700: PKCE `S256` + one-time TTL'd `state` in KV + exact-match
  `redirect_uri`; `requirePrincipal` on `start`/`projects`/`select`, the callback
  trusts the KV state), and both connect-time introspection **and** every
  `/v1/ask` query run over the Supabase **Management API**
  (`POST /v1/projects/{ref}/database/query`, `read_only:true`) via
  `packages/db/src/postgres-supabase-mgmt.ts` (`openSupabaseMgmtPostgres`),
  **not** a Postgres socket. The connect-time core is its own orchestrator,
  `connectSupabaseMgmt` (not `connectByoDb`): it reuses the shared
  `introspectPostgres` + `renderByoPostgresSchema` (one introspection logic,
  `GLOBAL-017`) and the shared `mintUniqueDbId`, but the durable credential is the
  sealed **OAuth token** (access+refresh, AAD `dboauth:<dbId>`) in a new additive
  `db_oauth_grants` table — **not** a DSN. The `databases` row carries the
  `SUPABASE_MGMT_BLOB_SENTINEL` in `connection_blob`, and query-time
  (`ask/build-deps.ts`) dispatches on that sentinel to a runner that loads the
  token (refreshing it when expiring), then runs the already-validated SQL
  read-only over HTTPS. **No read-only role is created in the user's database** —
  `read_only:true` is the engine-enforced guard, so nlqdb writes nothing to a
  connected Supabase DB. Paste stays the fallback on the one connect verb.
- **Core value:** Bullet-proof, Effortless UX, Goal-first, Seamless auth
- **Why:** `SK-DBCONN-002` (postgres.js over Workers `connect()` sockets) was
  meant to make the Supabase pooler reachable, but **in production it does not
  work**: Cloudflare Workers logs show `POST /v1/db/connect` against a Supabase
  Supavisor pooler hanging ~18.7s then 502-ing — the documented postgres.js-on-
  workerd socket/TLS hang class (cloudflare/workers-sdk#6179; node-postgres#3144).
  The same transport backs every `/v1/ask` BYO-PG query, so a "connected" Supabase
  DB could never be queried either. Cloudflare's own Workers→Supabase guidance
  routes through Hyperdrive, never raw sockets, for this reason — and Hyperdrive is
  a provisioned per-DB resource that doesn't fit an arbitrary-BYO connect at $0
  (`GLOBAL-013`). The Management-API `database/query` endpoint runs the SQL
  server-side inside Supabase over plain HTTPS, authorised by the OAuth token (no
  DB password, no socket), and is proven working against the target project. OAuth
  as a *front-end to the pipeline* — approve on the provider, no credential typed —
  is the effortless, least-trust connect the product promises; making it a handshake
  helper to the one verb (not a second data verb) holds `GLOBAL-017`.
- **Consequence in code:** New `packages/db/src/postgres-supabase-mgmt.ts`
  (`openSupabaseMgmtPostgres`, `GLOBAL-021`); new `apps/api/src/db-connect/`
  modules — `connect-supabase-mgmt.ts`, `register-helpers.ts` (shared
  `makeSlug`/`mintUniqueDbId`, extracted from `connect.ts` so paste + mgmt can't
  drift), and `oauth/` (`supabase-oauth.ts` token client, `supabase-projects.ts`,
  `pkce.ts`, `grant-store.ts`, `routes.ts`). New migration
  `0030_db_oauth_grants.sql` (additive; `provider_role` NULL for the mgmt
  transport). `ask/build-deps.ts` gains a `runSupabaseMgmt` dispatch branch keyed
  on `SUPABASE_MGMT_BLOB_SENTINEL`. Provider REST calls emit OTel spans
  (`GLOBAL-014`); no token/URL in any span/log (`GLOBAL-012`). Web: `SK-WEB-030`.
  Secrets: `SUPABASE_OAUTH_CLIENT_ID`/`_SECRET`. Surface parity (`GLOBAL-003`):
  OAuth is a **tracked N/A** on SDK/CLI/MCP/elements (browser-redirect only); paste
  stays on all of them. Reviewers reject: query-time that isn't `read_only:true`; a
  callback trusted without a matching KV `state`; a token stored unsealed or under
  the `dbconn:` context; a mgmt row without the sentinel.
- **Alternatives rejected:**
  - **Resolve OAuth to a pooler DSN + reuse `connectByoDb` over the socket** (the
    original signed-off draft, and the "reuse-the-one-pipeline" ideal). Depends on
    `SK-DBCONN-002` working; it does not (the ~18s hang above). Replaced by
    founder decision 2026-08-12 — the "one socket pipeline" premise is false on
    Workers, so the mgmt-API transport is adopted for Supabase and this draft
    clause is retired.
  - **Create a read-only role via `database/query`, then run queries as it.** The
    Management API executes as the project admin regardless; running as the role
    needs `SET LOCAL ROLE` wrapping, and `read_only:true` already blocks writes
    engine-side. Creating no object in the user's DB is simpler *and* less invasive
    (`P5`); role-based defense-in-depth is a tracked follow-up, not a blocker.
  - **Store the OAuth token in `connection_blob`.** Conflates the query credential
    with the lifecycle credential and muddies AAD; the separate `db_oauth_grants`
    row (absence = "paste-connected") is cleaner and additive.
  - **Hyperdrive per BYO DB.** A provisioned Cloudflare resource per database + a
    CF-API dependency + config-count limits — the heaviest option and not
    $0-clean (`GLOBAL-013`) for arbitrary BYO.
- **Source:** Cloudflare Workers Observability logs (prod `nlqdb-api`,
  2026-08-12: Supabase connect 502 at ~18.7s wall on the postgres.js transport) ·
  Supabase "Run a query" (`POST /v1/projects/{ref}/database/query`, `read_only`) ·
  Supabase "Build an OAuth integration" (authorize/token, HTTP Basic, PKCE) ·
  [RFC 9700](https://datatracker.ietf.org/doc/rfc9700/) · [RFC 7636](https://datatracker.ietf.org/doc/rfc7636/) ·
  extends `SK-DBCONN-001` · supersedes `SK-DBCONN-002` **for the Supabase path**
  (the socket transport remains the code for a pasted non-Neon Postgres DSN, whose
  reachability on Workers is now a known risk — see Open question (g)).
