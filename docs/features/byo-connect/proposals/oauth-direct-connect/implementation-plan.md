# Implementation plan — OAuth-first connect

Phased so an implementation agent can execute the agent-buildable work immediately and
the founder-gated blockers are isolated and explicit. **First provider: Supabase**
(research.md §5 — self-serve OAuth app, reachable via `SK-DBCONN-002`, zero business
gate). **Neon builds in parallel and ships dark** until the founder's partner OAuth
client lands.

**Hard dependency:** `SK-DBCONN-002` (PR #982 — BYO Postgres on postgres.js over
Workers `connect()` sockets) must merge first. Without it no non-Neon Postgres host is
reachable and this plan's order collapses back to Neon-only.

## Legend
- 🟢 **agent-buildable** — no human secret/registration needed to write + unit-test.
- 🔴 **FOUNDER-GATED** — needs a human to register an app / partner / set a secret.

---

## Phase 0 — Decision sign-off (blocking, P1)

- 🔴 Founder signs off `sk-decision-draft.md` (this changes documented UX per **SK-WEB-019**
  and extends **SK-DBCONN-001** — a **P1** item). Land the SK decisions *before* code
  (P3: decisions in canonical home first).
- 🔴 ~~Founder starts the Neon partner-OAuth conversation now~~ — **DEFERRED by founder
  decision (2026-08-12): no paid infra at the $0 stage.** The bundled ask (partner OAuth
  client + [Agent Plan](https://neon.com/docs/introduction/agent-plan)) requires an active
  paid Scale plan, so it re-opens at the `docs/phase-plan.md` §6 monetization trigger —
  or earlier if Neon responds to a free-tier partnership inquiry (allowed, zero cost,
  low expectation). Today's usage is compliant at $0 (research.md §1); the one hard
  guardrail until the Agent Plan lands: **do not ship per-user Neon projects/branches or
  hand users direct DSNs to nlqdb-owned Neon DBs** (SK-DB-007 Phase 2b stays parked).

## Phase 1 — OAuth engine, provider-agnostic (🟢 agent-buildable)

Buildable and unit-testable with a **stub descriptor**; no real client needed yet.

1. 🟢 `GET /v1/db/connect/oauth/:provider/start` + `/callback` route handlers in a new
   `apps/api/src/db-connect/oauth/` (route glue in `apps/api/src/index.ts`),
   `requirePrincipal` on `/start`. RFC 9700 shape: PKCE `S256` + one-time `state` in KV
   (`oauth_connect:<state>`, TTL 600s), exact-match `redirect_uri`.
2. 🟢 The `ProviderDescriptor` contract + registry (architecture.md §1) and a **fake
   descriptor** for tests that returns a known DSN, proving the callback →
   `connectByoDb` composition end-to-end without a network.
3. 🟢 Config plumbing: read the descriptor-named `<PROVIDER>_OAUTH_CLIENT_ID`/`_SECRET`
   from env; absent ⇒ 503 on `/start` (same shape as KEK gate). Add to `env.d.ts` +
   `wrangler` vars (values later).
4. 🟢 Callback → existing `connectByoDb(deps, …)` wiring (reuse `buildConnectByoDeps`), then
   302 to `/app/connect?connected=<dbId>` / `?error=<code>` (GLOBAL-012 mapping).
5. 🟢 OTel spans on token exchange + resolver (GLOBAL-014); no URL/token in spans.
6. 🟢 Tests: state/PKCE round-trip, CSRF/expiry reject, denied-error mapping, fake-descriptor
   happy path lands a registered DB via the real pipeline.

## Phase 2 — Supabase descriptor (🟢 build / 🔴 minutes-cheap secret to run)

1. 🟢 `providers/supabase.ts`: `listProjects` = `GET /v1/projects`; `resolve` =
   `POST /v1/projects/{ref}/database/query` `CREATE ROLE nlqdb_ro_<rand> LOGIN PASSWORD
   '<gen>'` + read-only GRANTs → pooler host/region
   (`GET /v1/projects/{ref}/config/database/pooler`) → assemble
   `postgres://nlqdb_ro_<rand>.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres`.
2. 🟢 Project handling (no MVP hedge): exactly one project ⇒ auto-continue; more than one ⇒
   the callback interstitial renders the picker (ux-design.md). Zero ⇒ honest empty state.
3. 🟢 Web: `/app/connect` provider-button row (primary) + paste demoted to `<details>`
   (see ux-design.md); "Connect Supabase" → `/start`; disabled+paste-fallback when
   unconfigured. `db.connected` event gains `{ method, provider }`.
4. 🟢 Unit tests with mocked Supabase REST (fixtures for projects/query/pooler).
5. 🔴 **FOUNDER (self-serve, minutes):** create the Supabase OAuth app (org settings →
   OAuth Apps; scopes incl. `database:write` for CREATE ROLE), set
   `SUPABASE_OAUTH_CLIENT_ID`/`_SECRET` as Worker secrets, register the exact
   `redirect_uri` (`https://<api-origin>/v1/db/connect/oauth/supabase/callback`).
   Distinct from the business-gated Partner Catalog listing — no approval gate.
6. 🟢 E2E once secrets exist: real Supabase consent → connected DB, including the
   one-connection **pooler TLS-trust check** (SK-DBCONN-002's `manual-test-postgres.md`
   walk covers the transport half). P6 requires this real walk before "done".

## Phase 3 — Token storage + clean disconnect (🟢 agent-buildable)

1. 🟢 Migration `0030_db_oauth_grants.sql` (additive; see architecture.md §3).
2. 🟢 Callback seals the OAuth token (`sealSecret`, AAD `dboauth:<dbId>`) + records
   `provider_role`, `provider_project`.
3. 🟢 `DELETE /v1/databases/:id`: if a grant row exists, open token → best-effort provider
   API `DROP ROLE` → delete grant row → delete DB (P6 reversible cleanup). Residual-role
   fallback message when token is gone. (Until this phase lands, disconnect shows the
   documented copy-paste `DROP ROLE` — ux-design.md.)
4. 🟢 "Needs reconnect" state: a query-time 401/expired marks the DB and offers one-click
   re-auth (re-run `/start`, preserving `dbId`).

## Phase 4 — Neon descriptor (🟢 build now, ships when B2 lands)

1. 🟢 `providers/neon.ts`: `listProjects` = `GET /projects`; `resolve` =
   `POST /projects/{id}/branches/{branch}/roles` (RO role, capture returned password) →
   `GET /projects/{id}/connection_uri?database_name=&role_name=&pooled=true`. Read-only
   GRANTs applied to the role. Unit tests with mocked Neon REST.
2. 🟢 "Connect Neon" button, wired to the same engine; renders disabled until B2/B3.
3. 🔴 **FOUNDER:** obtain the Neon **partner OAuth `client_id` + `client_secret`** (Neon
   only grants OAuth to commercial partners —
   [acquisition-channels row 20](../../../home/user/nlqdb/docs/research/acquisition-channels.md));
   set Worker secrets; register the exact `redirect_uri`
   (`https://<api-origin>/v1/db/connect/oauth/neon/callback`). **Started at Phase 0;
   lands whenever it lands.**
4. 🟢 E2E once secrets exist: real Neon consent → connected DB.

## Phase 5 — third provider: deliberately not committed

No third provider is scheduled (research.md §5): DigitalOcean's per-cluster private CA
fails the Workers runtime TLS verify, and the remaining candidates are token-paste.
Re-open when (a) a candidate passes a one-connection TLS-trust check **and** (b) demand
signals name it. Adding it then is one descriptor file (the Phase-1 engine is the
enabling layer).

---

## Founder-gated blockers, consolidated

| # | Blocker | Provider | Self-serve? | Where |
|---|---|---|---|---|
| B1 | P1 sign-off of the SK decision (UX change) | — | founder decision | this repo |
| B2 | Neon **partner** OAuth `client_id`/`client_secret` + redirect registration | Neon | **No** — commercial-relationship-gated; **start at Phase 0, runs in parallel** | Neon partner/support ([row 20](../../../home/user/nlqdb/docs/research/acquisition-channels.md)) |
| B3 | Set `NEON_OAUTH_CLIENT_ID`/`_SECRET` as Worker secrets | Neon | founder runs `wrangler secret put` | runbook |
| B4 | Supabase OAuth app (client id/secret/redirect) | Supabase | **Yes** — dashboard, minutes | supabase.com/dashboard org → OAuth Apps |
| B5 | Set `SUPABASE_OAUTH_CLIENT_ID`/`_SECRET` secrets | Supabase | founder runs `wrangler secret put` | runbook |
| ~~B6~~ | ~~Workers Postgres-wire transport~~ — **landed as `SK-DBCONN-002` (PR #982)**; this plan requires that PR merged | all non-Neon PG | n/a | `packages/db/src/postgres-byo.ts` |

**Everything else in Phases 1–4 is agent-buildable and unit-testable without a real
provider** by stubbing the descriptor and the token exchange. The critical path to a
*shipped* OAuth connect is: **merge PR #982 → B1 → Phase 1 → Phase 2 (build) → B4/B5
(minutes) → Phase 2 E2E.** No step on it waits on a negotiation. Neon joins via
B2/B3 whenever the partnership closes.
