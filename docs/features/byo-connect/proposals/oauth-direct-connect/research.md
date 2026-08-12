# Research — OAuth / provider-integration connect for nlqdb

**Scope:** what mechanism lets nlqdb obtain a *live connection to a user's managed
database after the user approves on the provider side* (no credential copy-paste),
for Neon, Supabase, ClickHouse Cloud, and a wider catalog of managed DB providers.
All facts web-verified 2026-08; source URLs inline. Per **P2** every load-bearing
claim below is a linked provider doc, not memory.

---

## 0. Workers Postgres reachability — solved by `SK-DBCONN-002` (PR #982); TLS trust is the residual gate

The first draft of this research found the BYO-Postgres path Neon-only: it ran on
`@neondatabase/serverless`'s `neon(rawUrl)` **SQL-over-HTTP**, which only reaches
Neon-protocol hosts. **That constraint no longer holds.** `SK-DBCONN-002`
(`docs/features/byo-connect/decisions/SK-DBCONN-002-byo-postgres-driver-postgres-js.md`,
PR #982) moves both BYO-PG call sites onto **postgres.js over the Workers `connect()`
socket API** (`packages/db/src/postgres-byo.ts`) — a real Postgres wire-protocol TCP
connection that reaches **any** Postgres host. This proposal assumes SK-DBCONN-002 is
merged; it is a hard dependency, not an option.

The residual reachability rule (from SK-DBCONN-002's own constraints) — a provider is
reachable iff **all three** hold:

1. **Public endpoint** (no VPC/private networking gate — rules out default RDS,
   Fly.io flycast).
2. **Publicly-trusted TLS cert.** `ssl: "require"` hands the handshake to the
   Workers runtime, which verifies against its own trust store and cannot be given
   a custom CA. Providers that ship a **per-cluster private CA** — DigitalOcean
   ([self-signed chain](https://www.digitalocean.com/community/questions/persistent-self_signed_cert_in_chain-error-on-managed-postgresql-connection)),
   Aiven, RDS (Amazon-private RDS CA) — **fail verification and are unsupported for
   now**, OAuth or not.
3. **IPv4 hostname** (e.g. Supabase's shared Supavisor pooler; the direct
   `db.<ref>.supabase.co` host is IPv6-only).

ClickHouse-family providers were never gated — the BYO-ClickHouse path is native-HTTP
`fetch` (`packages/db/src/clickhouse-byo.ts`) and reaches any host.

---

## 1. Neon — genuine OAuth, deepest API fit, founder-partner-gated

**Verdict: deepest technical fit (create-role returns the password, `connection_uri`
returns a ready DSN — no SQL round-trip needed). Shipping is blocked on a
founder-obtained partner OAuth client, which is a calendar-time business
negotiation — so Neon builds in parallel but ships second.**

- **OAuth model — real authorization-code + PKCE.** Authorize endpoint
  `https://oauth2.neon.tech/oauth2/auth`, token endpoint
  `https://oauth2.neon.tech/oauth2/token`, discovery at
  `https://oauth2.neon.tech/.well-known/openid-configuration`. `code_challenge` +
  `code_challenge_method=S256` supported.
  ([Neon OAuth integration](https://neon.com/docs/guides/oauth-integration))
- **Scopes (fixed, no custom):** `urn:neoncloud:projects:{create,read,update,delete,permission}`
  and `urn:neoncloud:orgs:{create,read,update,delete,permission}`. Creating a role
  and reading a connection URI need `projects:read` + a project-write scope
  (`projects:update`/`create`). (same doc)
- **FOUNDER-GATED BLOCKER:** *"We only provide OAuth integrations for partners we
  have active commercial relationships with."* The `client_id`/`client_secret` are
  *"provided by Neon when your OAuth application is registered"* — i.e. a manual
  partner onboarding, **not** self-serve. This matches
  [`acquisition-channels.md` row 20](../../../../research/acquisition-channels.md)
  ("Neon 08-10: formal OAuth/API business partnership via support/partner channels —
  account-walled → founder"). An agent cannot register the app. (same doc)
- **Post-authorization it fully composes to a connection URL:**
  - List the user's projects: `GET /api/v2/projects` (base `https://console.neon.tech`)
    (bearer = OAuth access token).
    ([Neon API](https://neon.com/docs/reference/api-reference))
  - **Create a scoped read-only role** — `POST /projects/{project_id}/branches/{branch_id}/roles`.
    The response **returns the new role's password in plaintext** on create/reset:
    *"The password field is included in the response when a role is created or its
    password is reset."* So nlqdb can mint a dedicated role and know its password.
    ([Create a role](https://api-docs.neon.tech/reference/createprojectbranchrole))
  - **Get a ready DSN** — `GET /projects/{project_id}/connection_uri?database_name=…&role_name=…&pooled=true`
    returns a standard Postgres URI (`pooled=true` adds the `-pooler` suffix).
    ([Retrieve connection URI](https://api-docs.neon.tech/reference/getconnectionuri))
- **Why Neon still matters:** nlqdb itself runs on Neon (authentic fit), read-only
  role isolation is native, and it is the only provider whose management API hands
  back a complete pooled DSN with zero SQL round-trips.
- **Terms posture going into the partner ask (checked 2026-08).** Neon's terms are a
  Product Schedule under the [Databricks MCSA](https://www.databricks.com/legal/mcsa),
  whose §1.2.2(e) prohibits "sell, resell, license, sublicense, distribute, rent,
  lease, or otherwise provide access to the Platform Services to any third party".
  nlqdb's *current* hosted usage is clean: one shared free-tier project,
  schema-per-tenant (`SK-DB-007`), users only ever touch nlqdb's API — that is
  app-on-a-database, and Neon states free-plan
  [commercial use is allowed](https://neon.com/blog/how-to-make-the-most-of-neons-free-plan).
  The line is crossed if nlqdb ever provisions **per-user Neon projects/branches** or
  hands users a **direct DSN to nlqdb-owned Neon DBs** (Phase 2b's branch-per-tier is
  that trigger) — the sanctioned vehicle for that is the
  [**Agent Plan**](https://neon.com/docs/introduction/agent-plan) ("platforms that
  provision and manage Postgres databases for end users": Neon-sponsored free org up
  to 30k projects, but requires a paid Scale plan + approval — a GLOBAL-013 exception
  the founder must own). The Agent-Plan application and the partner OAuth client are
  the **same conversation** — ask for both at once. **Founder decision 2026-08-12:
  deferred (no spend at the $0 stage); re-opens at the phase-plan §6 monetization
  trigger. Until then the guardrail is: no per-user Neon provisioning, no direct DSNs
  to nlqdb-owned Neon DBs.**

---

## 2. Supabase — self-serve OAuth app + reachable pooler ⇒ the first shippable provider

**Verdict: build first. The OAuth app is self-serve (founder creates it in minutes,
no business gate for the OAuth integration itself), a management-API SQL endpoint
lets nlqdb create its own read-only role, and the shared pooler passes all three §0
reachability conditions once SK-DBCONN-002 merges. Nothing here waits on a human
relationship.**

- **OAuth app registration is SELF-SERVE** in the dashboard: org settings →
  **OAuth Apps** tab → *Add application* → yields `client_id` + `client_secret` +
  redirect URI. No approval gate documented.
  ([Build a Supabase OAuth integration](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration))
  - Note: this is *distinct* from the **Partner Catalog** listing, which
    [`acquisition-channels.md` row 20](../../../../research/acquisition-channels.md)
    correctly records as business-viability-gated (registration + bank account/revenue).
    The OAuth integration needs only a Supabase account.
- **Flow:** authorize `https://api.supabase.com/v1/oauth/authorize`, token
  `POST https://api.supabase.com/v1/oauth/token`, PKCE strongly recommended
  (`S256`), refresh tokens returned, tokens invalidate on user revoke. Scopes are
  set at app-create time; `scope=all` exists while fine-grained scopes roll out.
  (same doc; [OAuth 2.1 server beta, 2025-11-26](https://github.com/orgs/supabase/discussions/38022))
- **List orgs / projects:** `GET /v1/organizations`, `GET /v1/projects`.
  ([List organizations](https://supabase.com/docs/reference/api/list-all-organizations),
  [List projects](https://supabase.com/docs/reference/api/v1-list-all-projects))
- **The password caveat, and how to route around it cleanly:** you **cannot**
  retrieve the existing `postgres` superuser password via the Management API. But you
  don't need it — **`POST /v1/projects/{ref}/database/query`** (beta; OAuth scope
  `database:write`) runs arbitrary SQL as admin, so nlqdb runs
  `CREATE ROLE nlqdb_ro_<rand> LOGIN PASSWORD '<generated>'` + read-only `GRANT`s and
  then **knows** that role's password.
  ([Run a query](https://supabase.com/docs/reference/api/v1-run-a-query))
- **Assemble the pooler DSN** (the reachable, IPv4 path):
  `postgres://<role>.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
  (transaction mode 6543; session 5432). Username for any role on the shared pooler is
  `<role>.<ref>`. The **direct** `db.<ref>.supabase.co` host is **IPv6-only** since
  Jan 2024 unless the paid IPv4 add-on (~$4/mo) is enabled — so the **Supavisor shared
  pooler (IPv4-only, every tier)** is the correct target.
  ([Pooler format](https://www.weweb.io/blog/supabase-connection-string-guide-ports-pooling),
  [IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address),
  [IPv4/IPv6 compatibility](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP))
- **Reachability:** the pooler is raw Postgres wire on 6543 — reached by
  SK-DBCONN-002's postgres.js transport (`prepare: false` is already set
  connection-wide for Supavisor transaction mode, and the pooler presents a
  publicly-trusted cert per SK-DBCONN-002's research + `manual-test-postgres.md`
  walk). The rejected alternative — introspecting *through* `database/query`
  (`read_only:true`) — would fork the pipeline (see architecture.md; **GLOBAL-017**).

---

## 3. ClickHouse Cloud — no end-user OAuth; paste stays primary here

**Verdict: no authorize-on-their-side flow exists. Keep paste-URL as the ClickHouse
Cloud path; at most add a guided "create a read-only key, paste it" helper.**

- **Only programmatic access is org/service API keys** (Key ID + Key Secret) via
  **HTTP Basic auth**. No OAuth2 authorization-code flow, no third-party OAuth-app /
  partner registration program.
  ([Managing API keys](https://clickhouse.com/docs/cloud/manage/openapi))
- Keys carry predefined roles — `developer` = read-only for assigned services,
  `admin` = full — and can be IP-restricted and given an expiry. (same doc)
- ClickHouse Cloud does offer SAML/OIDC **login** SSO (Entra, and Keycloak/Entra via
  Altinity builds), but that is user-login federation, **not** delegated third-party
  authorization — it cannot hand nlqdb a connection. ([Altinity OAuth webinar](https://altinity.com/webinarspage/making-clickhouse-safe-for-ai-using-oauth-in-altinity-builds))
- Closest "approve on their side": the user creates a **read-only key / read-only DB
  user** in their console and pastes it. That is still copy-paste — so ClickHouse Cloud
  is a **paste-URL (fallback)** provider. The BYO-ClickHouse HTTP path already reaches
  it (§0), so no transport work; the gap is purely the absence of OAuth.

---

## 4. Wider provider matrix

Legend — **OAuth?**: (a) genuine authorize-on-provider-side OAuth app a user consents
to; (m) management API reachable with a *user-pasted* token/key (no browser consent);
(–) none. **RO role?**: can nlqdb provision/obtain a read-only credential.
**Reach?**: passes the three §0 conditions with SK-DBCONN-002 merged — public
endpoint + publicly-trusted TLS cert + IPv4. *"TLS?"* = PG wire fine but the cert
trust chain is unverified (a one-connection check settles it); *"no — private CA"* =
confirmed per-cluster/private CA, blocked until Workers allow custom trust.
**Founder-gated?**: needs a human to register an app / partner / secret.

### Postgres-family

| Provider | OAuth? | Mgmt API → DSN? | RO role? | Reach? | Founder-gated? | Source |
|---|---|---|---|---|---|---|
| **Supabase** | **(a)** PKCE, **self-serve app** | yes (SQL query → make role → pooler DSN) | yes (`database/query` CREATE ROLE) | **yes** — Supavisor pooler: IPv4 + public TLS | app self-serve (minutes) | [oauth](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration) · [query](https://supabase.com/docs/reference/api/v1-run-a-query) |
| **Neon** | **(a)** PKCE | yes (`connection_uri`) | yes (create-role returns pw) | **yes** | **yes** — partner OAuth client, commercial-relationship-gated | [oauth](https://neon.com/docs/guides/oauth-integration) · [conn uri](https://api-docs.neon.tech/reference/getconnectionuri) |
| **Vercel Postgres** (= Neon) | via Vercel/Neon | same as Neon | yes | **yes** (is Neon) | yes (Vercel/Neon marketplace) | [vercel-neon](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/) |
| **PlanetScale Postgres** | **(a)** OAuth apps GA | yes (create password) | branch/password scopes | TLS? | app self-serve; MySQL is core (out-of-engine) | [ps-oauth](https://planetscale.com/docs/api/planetscale-api-oauth-applications) · [get pw](https://planetscale.com/docs/api/reference/get_password) |
| **DigitalOcean Managed PG** | **(a)** OAuth apps, **self-serve** | yes (Databases API returns connection string) | create DB user via API | **no — private CA** ([self-signed chain](https://www.digitalocean.com/community/questions/persistent-self_signed_cert_in_chain-error-on-managed-postgresql-connection)) | app self-serve | [do-oauth](https://docs.digitalocean.com/reference/api/oauth/) · [do-db](https://docs.digitalocean.com/reference/api/reference/databases/) |
| **Aiven for PostgreSQL** | (m) personal token | yes (`service_uri`) | yes (SQL GRANT) | **no — private CA** (per-project Aiven CA) | token pasted by user | [aiven api](https://api.aiven.io/doc/) · [aiven ro](https://aiven.io/docs/products/postgresql/howto/readonly-user) |
| **CockroachDB Cloud** | (m) service-account secret | yes (connection string via API) | SQL user via ccloud/SQL | TLS? (+ CRDB dialect) | key pasted by user | [crdb api](https://www.cockroachlabs.com/docs/cockroachcloud/cloud-api) |
| **Timescale / Tiger Cloud** | (m) project access key | yes | SQL GRANT | TLS? | key pasted | [ts actions](https://github.com/timescale/cloud-actions) |
| **Crunchy Bridge** | (m) app_id/secret key | yes (cluster API) | SQL GRANT | TLS? | key pasted | [cb api](https://docs.crunchybridge.com/api) |
| **Railway** | (a)/(m) OAuth + tokens | yes (GraphQL → `DATABASE_URL`) | SQL GRANT | TLS? | app or token | [rw oauth](https://docs.railway.com/integrations/oauth/login-and-tokens) · [rw api](https://docs.railway.com/integrations/api) |
| **Render** | (m) API key (owner) | yes (external DB URL) | SQL GRANT | TLS? | key pasted | [render](https://render.com/docs) |
| **Fly.io Postgres** | (–) org token | via Machines API | SQL GRANT | no (flycast, not public) | token; not publicly reachable | [fly](https://fly.io/docs) |
| **AWS RDS / Aurora** | (m) IAM/STS (not consent-OAuth) | ARN/endpoint via API | SQL GRANT | **no — private CA** (Amazon RDS CA) + often VPC | IAM app + network gate | [rds](https://docs.aws.amazon.com/rds/) |
| **Google Cloud SQL / AlloyDB** | (m) Google OAuth + Admin API | list instances; create user | SQL GRANT | **no — private CA** (per-instance Google CA) | Google OAuth consent-screen verification | [cloudsql](https://cloud.google.com/sql/docs/postgres/admin-api) |
| **Azure DB for PostgreSQL** | (m) Entra OAuth + ARM | instance via ARM | SQL GRANT | TLS? (DigiCert-chained, likely public) | Entra app registration | [azure pg](https://learn.microsoft.com/azure/postgresql/) |
| **Xata** (now PG platform) | (m) API key | yes | SQL GRANT | TLS? | key pasted | [xata](https://xata.io/docs) |
| **Nile** | (m) API key | yes | SQL GRANT | TLS? | key pasted | [nile](https://thenile.dev/docs) |
| **Tembo** | (m) token | yes | SQL GRANT | product winding down | token | [tembo](https://tembo.io) |

### ClickHouse-family

| Provider | OAuth? | Mgmt API → conn? | RO role? | Reach today? | Founder-gated? | Source |
|---|---|---|---|---|---|---|
| **ClickHouse Cloud** | **(–)** keys only (HTTP Basic) | endpoint via Cloud API | `developer` role / RO user | **yes** (native HTTP) | no (user makes key) | [ch openapi](https://clickhouse.com/docs/cloud/manage/openapi) |
| **Tinybird** | (m) auth tokens | region host + read token | read/scoped tokens | **yes** (HTTP-native) | token pasted (nlqdb already integrates internally) | [tinybird](https://www.tinybird.co/docs) |
| **Aiven for ClickHouse** | (m) personal token | `service_uri` | SQL GRANT | **yes** (native HTTP) | token pasted | [aiven api](https://api.aiven.io/doc/) |
| **Altinity.Cloud** | (–)/(m) token | endpoint via API | SQL RO user | **yes** (native HTTP) | token; CH-level OIDC only | [altinity](https://docs.altinity.com/) |
| **DoubleCloud** | (–) | — | — | — | **deprecated** (shutdown announced 2024) | [doublecloud](https://double.cloud) |

---

## 5. Recommendation — build order (unambiguous)

**Build FIRST: Supabase.** With SK-DBCONN-002 merged it passes every §0 reachability
condition, the OAuth app is **self-serve** (founder unblocks in minutes, no partner
gate), and `database/query` cleanly provisions a read-only role. It is the only
provider where *nothing* waits on a business negotiation — the shortest path from
sign-off to a live "Connect" button. Neon-first (the first draft's order) would ship
a **disabled button** until a partner deal closes: a roadmap dependency on a
negotiation with no deadline.

**Build SECOND: Neon** — the resolver + button are agent-buildable immediately and
sit dark until the founder's **partner OAuth client** lands
([acquisition-channels row 20](../../../../research/acquisition-channels.md)
— a relationship the founder already wants). The founder starts that conversation at
Phase 0; it runs in parallel, it is not on the critical path.

**No THIRD provider is committed.** DigitalOcean (the next genuine self-serve OAuth)
is **blocked on its per-cluster private CA** (§0 condition 2), and every remaining
(m)-column provider is token-paste — it advances "no credential copy-paste" barely at
all. Revisit after Supabase ships real usage data: the next candidate is whichever of
PlanetScale/Railway clears a one-connection TLS-trust check *and* shows up in demand
signals.

**ClickHouse Cloud stays paste-URL** — no OAuth exists to build against.

---

## 6. Sources

Every load-bearing claim above carries its source URL inline (P2). Two references not
linked elsewhere in this file: postgres.js — https://github.com/porsager/postgres;
OAuth 2.0 Security BCP — https://datatracker.ietf.org/doc/rfc9700/ (RFC 9700, Jan 2025).
Arctic's deprecation (why no OAuth-client dependency) is cited in architecture.md.
