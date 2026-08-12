# Research — OAuth / provider-integration connect for nlqdb

**Scope:** what mechanism lets nlqdb obtain a *live connection to a user's managed
database after the user approves on the provider side* (no credential copy-paste),
for Neon, Supabase, ClickHouse Cloud, and a wider catalog of managed DB providers.
All facts web-verified 2026-08; source URLs inline. Per **P2** every load-bearing
claim below is a linked provider doc, not memory.

---

## 0. The one finding that shapes everything: Workers Postgres reachability

nlqdb's runtime is Cloudflare Workers (**GLOBAL-013**, no warm TCP sockets on the
free tier). The existing BYO-Postgres introspection/query path uses
`@neondatabase/serverless`'s `neon(rawUrl)` **HTTP** function
(`apps/api/src/db-connect/build-deps.ts:56`). That function speaks Neon's
**SQL-over-HTTP** protocol and only reaches hosts that implement it (Neon, and
Neon-protocol-compatible endpoints). The driver's `Pool`/`Client` WebSocket path
can reach an *arbitrary* Postgres **only through a self-hosted `wsProxy`** placed
in front of that database — which nlqdb does not run.
([serverless CONFIG.md](https://github.com/neondatabase/serverless/blob/main/CONFIG.md),
[serverless README](https://github.com/neondatabase/serverless))

**Consequence:** over the *current* Worker code path, the BYO-Postgres pipeline can
introspect **Neon** (and Vercel Postgres, which *is* Neon) but **not** a raw Supabase
pooler / RDS / Cloud SQL / DigitalOcean / etc. — those speak the Postgres wire
protocol on a TCP port, not Neon-HTTP. Reaching them over Workers needs new transport
(Cloudflare `connect()` from `cloudflare:sockets` + a wire-protocol driver, or each
provider's own HTTP query API). **This is pre-existing and out of scope for the OAuth
design, but it gates every non-Neon Postgres provider** and is the decisive reason to
ship **Neon first**. ClickHouse-family providers are unaffected — the BYO-ClickHouse
path is native-HTTP `fetch` (`packages/db/src/clickhouse-byo.ts`) and reaches any host.

---

## 1. Neon — genuine OAuth, reachable today, founder-partner-gated

**Verdict: best technical fit; the only Postgres provider whose OAuth output the
current Workers pipeline can already query. Shipping is blocked on a founder-obtained
partner OAuth client.**

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
  [`acquisition-channels.md` row 20](../../../home/user/nlqdb/docs/research/acquisition-channels.md)
  ("Neon 08-10: formal OAuth/API business partnership via support/partner channels —
  account-walled → founder"). An agent cannot register the app. (same doc)
- **Post-authorization it fully composes to a connection URL:**
  - List the user's projects: `GET https://console.neon.tech/api/v2/projects`
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
- **Why Neon is uniquely feasible today:** the resolved host is a Neon host, so the
  existing `neon()` HTTP driver already speaks to it — zero new transport code.
  nlqdb itself runs on Neon (authentic fit), and read-only role isolation is native.

---

## 2. Supabase — self-serve OAuth app, but needs the Workers-Postgres transport fix

**Verdict: strong. The OAuth app is self-serve (founder can create it in minutes, no
business gate for the OAuth integration itself), and a management-API SQL endpoint
lets nlqdb create its own read-only role. Gated on the §0 transport gap, not on a
partner relationship.**

- **OAuth app registration is SELF-SERVE** in the dashboard: org settings →
  **OAuth Apps** tab → *Add application* → yields `client_id` + `client_secret` +
  redirect URI. No approval gate documented.
  ([Build a Supabase OAuth integration](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration))
  - Note: this is *distinct* from the **Partner Catalog** listing, which
    [`acquisition-channels.md` row 20](../../../home/user/nlqdb/docs/research/acquisition-channels.md)
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
- **Blocker beyond the OAuth app:** the pooler is raw Postgres wire on 6543 — the §0
  Workers-reachability gap applies. Either (a) solve transport (Cloudflare TCP socket
  driver), or (b) introspect *through* `database/query` (`read_only:true`) — but (b)
  would fork the pipeline (see architecture.md; discouraged under **GLOBAL-017**).

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
(–) none. **RO role?**: can nlqdb provision/obtain a read-only credential. **Reach?**:
reachable over the *current* Worker path (Neon-HTTP for PG, native-HTTP for CH) without
new transport. **Founder-gated?**: needs a human to register an app / partner / secret.

### Postgres-family

| Provider | OAuth? | Mgmt API → DSN? | RO role? | Reach today? | Founder-gated? | Source |
|---|---|---|---|---|---|---|
| **Neon** | **(a)** PKCE | yes (`connection_uri`) | yes (create-role returns pw) | **yes** (Neon-HTTP) | **yes** — partner OAuth client, commercial-relationship-gated | [oauth](https://neon.com/docs/guides/oauth-integration) · [conn uri](https://api-docs.neon.tech/reference/getconnectionuri) |
| **Vercel Postgres** (= Neon) | via Vercel/Neon | same as Neon | yes | **yes** (is Neon) | yes (Vercel/Neon marketplace) | [vercel-neon](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/) |
| **Supabase** | **(a)** PKCE, **self-serve app** | yes (SQL query → make role → pooler DSN) | yes (`database/query` CREATE ROLE) | **no** (raw PG wire on pooler) | app self-serve; needs transport fix | [oauth](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration) · [query](https://supabase.com/docs/reference/api/v1-run-a-query) |
| **PlanetScale Postgres** | **(a)** OAuth apps GA | yes (create password) | branch/password scopes | no (PG wire) | app self-serve; MySQL is core (out-of-engine) | [ps-oauth](https://planetscale.com/docs/api/planetscale-api-oauth-applications) · [get pw](https://planetscale.com/docs/api/reference/get_password) |
| **DigitalOcean Managed PG** | **(a)** OAuth apps, **self-serve** | yes (Databases API returns connection string) | create DB user via API | no (PG wire) | app self-serve | [do-oauth](https://docs.digitalocean.com/reference/api/oauth/) · [do-db](https://docs.digitalocean.com/reference/api/reference/databases/) |
| **Aiven for PostgreSQL** | (m) personal token | yes (`service_uri`) | yes (SQL: ALTER DEFAULT PRIVILEGES / GRANT) | no (PG wire) | token pasted by user | [aiven api](https://api.aiven.io/doc/) · [aiven ro](https://aiven.io/docs/products/postgresql/howto/readonly-user) |
| **CockroachDB Cloud** | (m) service-account secret | yes (connection string via API) | SQL user via ccloud/SQL | no (PG wire; CRDB dialect) | key pasted by user | [crdb api](https://www.cockroachlabs.com/docs/cockroachcloud/cloud-api) |
| **Timescale / Tiger Cloud** | (m) project access key | yes | SQL GRANT | no (PG wire) | key pasted | [ts actions](https://github.com/timescale/cloud-actions) |
| **Crunchy Bridge** | (m) app_id/secret key | yes (cluster API) | SQL GRANT | no (PG wire) | key pasted | [cb api](https://docs.crunchybridge.com/api) |
| **Railway** | (a)/(m) OAuth + tokens | yes (GraphQL → `DATABASE_URL`) | SQL GRANT | no (PG wire) | app or token | [rw oauth](https://docs.railway.com/integrations/oauth/login-and-tokens) · [rw api](https://docs.railway.com/integrations/api) |
| **Render** | (m) API key (owner) | yes (external DB URL) | SQL GRANT | no (PG wire) | key pasted | [render](https://render.com/docs) |
| **Fly.io Postgres** | (–) org token | via Machines API | SQL GRANT | no (flycast, not public) | token; not publicly reachable | [fly](https://fly.io/docs) |
| **AWS RDS / Aurora** | (m) IAM/STS (not consent-OAuth) | ARN/endpoint via API | SQL GRANT | no (PG wire; often private VPC) | IAM app + network gate | [rds](https://docs.aws.amazon.com/rds/) |
| **Google Cloud SQL / AlloyDB** | (m) Google OAuth + Admin API | list instances; create user | SQL GRANT | no (PG wire; public IP + allowlist) | Google OAuth consent-screen verification | [cloudsql](https://cloud.google.com/sql/docs/postgres/admin-api) |
| **Azure DB for PostgreSQL** | (m) Entra OAuth + ARM | instance via ARM | SQL GRANT | no (PG wire) | Entra app registration | [azure pg](https://learn.microsoft.com/azure/postgresql/) |
| **Xata** (now PG platform) | (m) API key | yes | SQL GRANT | no (PG wire) | key pasted | [xata](https://xata.io/docs) |
| **Nile** | (m) API key | yes | SQL GRANT | no (PG wire) | key pasted | [nile](https://thenile.dev/docs) |
| **Tembo** | (m) token | yes | SQL GRANT | no; product winding down | token | [tembo](https://tembo.io) |

### ClickHouse-family

| Provider | OAuth? | Mgmt API → conn? | RO role? | Reach today? | Founder-gated? | Source |
|---|---|---|---|---|---|---|
| **ClickHouse Cloud** | **(–)** keys only (HTTP Basic) | endpoint via Cloud API | `developer` role / RO user | **yes** (native HTTP) | no (user makes key) | [ch openapi](https://clickhouse.com/docs/cloud/manage/openapi) |
| **Tinybird** | (m) auth tokens | region host + read token | read/scoped tokens | **yes** (HTTP-native) | token pasted (nlqdb already integrates internally) | [tinybird](https://www.tinybird.co/docs) |
| **Aiven for ClickHouse** | (m) personal token | `service_uri` | SQL GRANT | **yes** (native HTTP) | token pasted | [aiven api](https://api.aiven.io/doc/) |
| **Altinity.Cloud** | (–)/(m) token | endpoint via API | SQL RO user | **yes** (native HTTP) | token; CH-level OIDC only | [altinity](https://docs.altinity.com/) |
| **DoubleCloud** | (–) | — | — | — | **deprecated** (shutdown announced 2024) | [doublecloud](https://double.cloud) |

---

## 5. Recommendation — build order

**Build FIRST: Neon.** The only provider that is *both* genuine authorize-on-their-side
OAuth *and* reachable over the current Worker pipeline with zero new transport code.
create-role returns a password → dedicated read-only role; `connection_uri?pooled=true`
→ a DSN the existing `neon()` driver already queries. nlqdb runs on Neon (authentic
fit). The only blocker is the **founder obtaining a partner OAuth `client_id`/`client_secret`**
— a relationship the founder already wants ([acquisition-channels row 20](../../../home/user/nlqdb/docs/research/acquisition-channels.md)).

**Build SECOND: Supabase.** OAuth app is **self-serve** (founder unblocks in minutes,
no partner gate), `database/query` cleanly provisions a read-only role, shared pooler
gives an IPv4 DSN. Gated on the §0 transport work (a Workers Postgres-wire driver), not
on a human relationship — so it is the natural next step once transport lands, and that
transport unlocks the entire (m)-column Postgres set (DigitalOcean, Aiven, Railway,
Render, Cockroach, …) at once.

**Build THIRD: DigitalOcean** (best *second* genuine OAuth: self-serve app + Databases
API returns a connection string) once the Supabase transport work exists — or **Tinybird**
if the priority is a ClickHouse-family "connect" that is reachable today (token-paste,
not browser OAuth, so it advances "no copy-paste" less).

**ClickHouse Cloud stays paste-URL** — no OAuth exists to build against.

---

## 6. Sources

- Neon OAuth — https://neon.com/docs/guides/oauth-integration
- Neon connection URI — https://api-docs.neon.tech/reference/getconnectionuri
- Neon create role — https://api-docs.neon.tech/reference/createprojectbranchrole
- Neon API — https://neon.com/docs/reference/api-reference
- Supabase OAuth integration — https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
- Supabase run a query — https://supabase.com/docs/reference/api/v1-run-a-query
- Supabase list projects — https://supabase.com/docs/reference/api/v1-list-all-projects
- Supabase IPv4 add-on — https://supabase.com/docs/guides/platform/ipv4-address
- Supabase pooler format — https://www.weweb.io/blog/supabase-connection-string-guide-ports-pooling
- ClickHouse Cloud API keys — https://clickhouse.com/docs/cloud/manage/openapi
- DigitalOcean OAuth — https://docs.digitalocean.com/reference/api/oauth/
- DigitalOcean Databases — https://docs.digitalocean.com/reference/api/reference/databases/
- PlanetScale OAuth apps — https://planetscale.com/docs/api/planetscale-api-oauth-applications
- Aiven API — https://api.aiven.io/doc/ ; read-only user — https://aiven.io/docs/products/postgresql/howto/readonly-user
- CockroachDB Cloud API — https://www.cockroachlabs.com/docs/cockroachcloud/cloud-api
- Crunchy Bridge API — https://docs.crunchybridge.com/api
- Railway API/OAuth — https://docs.railway.com/integrations/api
- neon serverless (non-Neon reach) — https://github.com/neondatabase/serverless/blob/main/CONFIG.md
