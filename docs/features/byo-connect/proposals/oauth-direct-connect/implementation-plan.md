# Implementation plan — OAuth-first connect

Phased so an implementation agent can execute the agent-buildable work immediately and
the founder-gated blockers are isolated and explicit. **Recommended first provider: Neon**
(research.md §5 — genuine OAuth, reachable today over the existing Worker pipeline, deepest
fit; the only blocker is a partner OAuth client the founder already wants).

## Legend
- 🟢 **agent-buildable** — no human secret/registration needed to write + unit-test.
- 🔴 **FOUNDER-GATED** — needs a human to register an app / partner / set a secret.

---

## Phase 0 — Decision sign-off (blocking, P1)

- 🔴 Founder signs off `sk-decision-draft.md` (this changes documented UX per **SK-WEB-019**
  and extends **SK-DBCONN-001** — a **P1** item). Land the SK decisions *before* code
  (P3: decisions in canonical home first).

## Phase 1 — OAuth scaffolding, provider-agnostic (🟢 agent-buildable)

Buildable and unit-testable with **stub** providers; no real client needed yet.

1. 🟢 `GET /v1/db/connect/oauth/:provider/start` + `/callback` route handlers
   (`apps/api/src/index.ts` or a new `apps/api/src/db-connect/oauth.ts`), `requirePrincipal`
   on `/start`. PKCE (`S256`) + `state` in KV (`oauth_connect:<state>`, TTL 600s, one-time).
2. 🟢 Config plumbing: read `<PROVIDER>_OAUTH_CLIENT_ID`/`_SECRET` from env; absent ⇒ 503 on
   `/start` (same shape as KEK gate). Add to `env.d.ts` + `wrangler` vars (values later).
3. 🟢 `resolveProviderConnection` interface + a **fake provider** for tests that returns a
   known DSN, proving the callback → `connectByoDb` composition end-to-end without a network.
4. 🟢 Callback → existing `connectByoDb(deps, …)` wiring (reuse `buildConnectByoDeps`), then
   302 to `/app/connect?connected=<dbId>` / `?error=<code>` (GLOBAL-012 mapping).
5. 🟢 OTel spans on token exchange + resolver (GLOBAL-014); no URL/token in spans.
6. 🟢 Tests: state/PKCE round-trip, CSRF/expiry reject, denied-error mapping, fake-provider
   happy path lands a registered DB via the real pipeline.

## Phase 2 — Neon provider resolver (🟢 build / 🔴 secret to run)

1. 🟢 `resolveNeonConnection(token, projectId?)`:
   `GET /projects` → `POST /projects/{id}/branches/{branch}/roles` (RO role, capture returned
   password) → `GET /projects/{id}/connection_uri?database_name=&role_name=&pooled=true` →
   assemble DSN. Read-only GRANTs applied to the role.
2. 🟢 Multi-project handling: if >1 project, callback renders a project picker (or MVP:
   default to single, reconnect for more).
3. 🟢 Web: `/app/connect` provider-button row (primary) + paste demoted to `<details>`
   (see ux-design.md); "Connect Neon" → `/start`; disabled+paste-fallback when unconfigured.
   `db.connected` event gains `{ method, provider }`.
4. 🟢 Unit tests with mocked Neon REST (fixtures for list/create-role/connection_uri).
5. 🔴 **FOUNDER:** obtain Neon **partner OAuth `client_id` + `client_secret`** (Neon only
   grants OAuth to commercial partners — [acquisition-channels row 20](../../../home/user/nlqdb/docs/research/acquisition-channels.md));
   set them as Worker secrets; register the `redirect_uri` (`https://<api-origin>/v1/db/connect/oauth/neon/callback`)
   with Neon. **Until this lands, the Neon button ships disabled and paste is the path.**
6. 🟢 E2E once secrets exist: real Neon consent → connected DB (P6 requires a real walk).

## Phase 3 — Token storage + clean disconnect (🟢 agent-buildable)

1. 🟢 Migration `0030_db_oauth_grants.sql` (additive; see architecture.md §3).
2. 🟢 Callback seals the OAuth token (`sealSecret`, AAD `dboauth:<dbId>`) + records
   `provider_role`, `provider_project`.
3. 🟢 `DELETE /v1/databases/:id`: if a grant row exists, open token → best-effort provider
   API `DROP ROLE` → delete grant row → delete DB (P6 reversible cleanup). Residual-role
   fallback message when token is gone.
4. 🟢 "Needs reconnect" state: a query-time 401/expired marks the DB and offers one-click
   re-auth (re-run `/start`, preserving `dbId`).

## Phase 4 — Supabase (🟢 mostly build / 🔴 self-serve app + 🔴 transport decision)

1. 🔴 **FOUNDER (cheap, self-serve):** create a Supabase OAuth app (org settings → OAuth
   Apps), set `client_id`/`client_secret`/redirect on the Worker. No business gate for the
   OAuth app itself (distinct from the business-gated Partner Catalog listing).
2. 🔴/🟢 **Transport prerequisite (research.md §0):** the Supabase shared pooler is raw
   Postgres wire on 6543 — the existing `neon()` HTTP driver can't reach it. Decide + build
   one of: (a) a Cloudflare `connect()` (`cloudflare:sockets`) Postgres-wire driver on the
   BYO-PG path (unlocks the whole (m)-column Postgres set at once), or (b) introspect via
   Supabase `POST /database/query` `read_only:true` — **rejected** as a pipeline fork
   (GLOBAL-017). This is the real gating work for Supabase, not the OAuth app.
3. 🟢 `resolveSupabaseConnection(token, ref)`: `GET /v1/projects` → `POST /v1/projects/{ref}/database/query`
   `CREATE ROLE nlqdb_ro_<rand> LOGIN PASSWORD '<gen>'` + read-only GRANTs → get pooler
   host/region (`GET /v1/projects/{ref}/config/database/pooler`) → assemble
   `postgres://nlqdb_ro_<rand>.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres`.
4. 🟢 Add the Supabase provider button; same journey.

## Phase 5 — Optional third provider

- 🟢/🔴 **DigitalOcean** (best next genuine OAuth: self-serve app + Databases API returns a
  connection string) — inherits the Phase-4 transport work. Or **Tinybird** (ClickHouse-family,
  HTTP-native/reachable today, but token-paste not browser OAuth).

---

## Founder-gated blockers, consolidated

| # | Blocker | Provider | Self-serve? | Where |
|---|---|---|---|---|
| B1 | P1 sign-off of the SK decision (UX change) | — | founder decision | this repo |
| B2 | Neon **partner** OAuth `client_id`/`client_secret` + redirect registration | Neon | **No** — commercial-relationship-gated | Neon partner/support ([row 20](../../../home/user/nlqdb/docs/research/acquisition-channels.md)) |
| B3 | Set `NEON_OAUTH_CLIENT_ID`/`_SECRET` as Worker secrets | Neon | founder runs `wrangler secret put` | runbook |
| B4 | Supabase OAuth app (client id/secret/redirect) | Supabase | **Yes** — dashboard, minutes | supabase.com/dashboard org → OAuth Apps |
| B5 | Set `SUPABASE_OAUTH_CLIENT_ID`/`_SECRET` secrets | Supabase | founder runs `wrangler secret put` | runbook |
| B6 | Decide + fund the Workers Postgres-wire transport (Supabase/DO/etc.) | all non-Neon PG | engineering decision | architecture.md §0 |

**Everything else in Phases 1–5 is agent-buildable and unit-testable without a real
provider** by stubbing the resolver and the token exchange. The critical path to a *shipped*
OAuth connect is: **B1 → Phase 1 → Phase 2 (build) → B2/B3 → Phase 2 E2E.** Neon is
shippable the moment B2/B3 land; Supabase additionally waits on B6.
