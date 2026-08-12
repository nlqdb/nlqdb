# Architecture — OAuth connect that reuses the existing pipeline

The load-bearing constraint (**GLOBAL-017**, and the task's explicit instruction):
**OAuth must resolve to a connection URL and then reuse the existing
`connectByoDb` orchestrator — do NOT fork the validate → introspect → seal → register
pipeline.** OAuth is a *credential-acquisition front-end* to the one connect verb, not a
second connect path.

## 1. Composition — where OAuth plugs in

```
                       ┌─────────────────────────────────────────────┐
  paste path ─────────►│                                             │
  (unchanged)          │   connectByoDb(deps, {engine, connectionUrl,│
                       │      name, tenantId})                        │
  OAuth path ─┐        │   a. KEK gate                                │
              │        │   b. validateByoConnection (egress guard)    │
  provider ───┘        │   c. introspect + render                     │
  resolver             │   d. seal connection_url → connection_blob   │
  ▲                    │   e. register databases row (+ pk_live)      │
  │                    └─────────────────────────────────────────────┘
  │
  resolveProviderConnection(provider, oauthToken, projectId)
     └─ returns a plaintext connection URL (DSN)
```

The **only new backend primitive** is a per-provider resolver that turns an OAuth grant
into a **plaintext connection URL**. Everything downstream of that URL is the *existing*
`connectByoDb` — byte-identical registered row, same sealed `connection_blob`, same
`__byo_blob__` sentinel, same query-time dispatch. A pasted URL and an OAuth-resolved URL
are indistinguishable once they reach `connectByoDb`.

### `resolveProviderConnection` (new, pure-ish, per provider)

```ts
// packages/db/src/providers/<provider>.ts  (or apps/api/src/db-connect/providers/)
type ResolvedConnection = { engine: "postgres" | "clickhouse"; connectionUrl: string;
                            displayName: string; providerRoleName?: string };

// Neon: list projects → create RO role (returns pw) → GET connection_uri?pooled=true
// Supabase: pick project → POST /database/query CREATE ROLE … → assemble pooler DSN
async function resolveNeonConnection(token, projectId): Promise<ResolvedConnection>
```

It performs provider REST calls (each an OTel span, **GLOBAL-014**), and returns a DSN.
The DSN then flows into `connectByoDb` unchanged. `resolveProviderConnection` lives beside
`build-deps.ts` because it needs `apps/api` HTTP context; the pure per-provider URL
assembly can live in `packages/db` (GLOBAL-021 ownership).

## 2. OAuth callback routes on the Worker

Two helper routes per provider — an OAuth **handshake**, not a second data operation, so
**GLOBAL-017 holds** (it explicitly allows auth helpers like `nlq login`). The single
*data* verb remains `POST /v1/db/connect`; the callback invokes the same `connectByoDb`
orchestrator in-process rather than re-POSTing.

- **`GET /v1/db/connect/oauth/:provider/start`** — `requirePrincipal` (connect is
  account-only, same gate as the POST verb). Generates `state` + PKCE `code_verifier`,
  stores `{ tenantId, provider, codeVerifier, createdAt }` in **KV** under
  `oauth_connect:<state>` (TTL 600s), and 302s to the provider authorize URL with
  `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `S256`.
- **`GET /v1/db/connect/oauth/:provider/callback`** — reads `code` + `state`; looks up KV
  state (reject on miss → CSRF/expiry), deletes it (one-time use), exchanges `code` at the
  provider token endpoint with `code_verifier`, calls `resolveProviderConnection`, then
  `connectByoDb(deps, { engine, connectionUrl, tenantId, name })`. On success optionally
  seals + stores the OAuth token (§4), then 302s to `/app/connect?connected=<dbId>`. On any
  failure 302s to `/app/connect?error=<code>` with a **GLOBAL-012** one-sentence mapping.

Config: `client_id`/`client_secret` per provider come from Worker env/secrets
(`NEON_OAUTH_CLIENT_ID` / `..._SECRET`, `SUPABASE_OAUTH_CLIENT_ID` / `..._SECRET`).
Absent client ⇒ `/start` returns the same 503 shape as the KEK gate, and the web disables
the button. `redirect_uri` is the API origin (same-origin after the SK-WEB-009 merge).

## 3. Token storage — sealed exactly like `connection_blob` (GLOBAL-031)

**Key insight that keeps this small:** the *durable* artifact is still the sealed
`connection_blob` (the resolved DSN, with a role password that persists). Query-time needs
**no** OAuth token — it opens `connection_blob` just like a pasted BYO row. The OAuth token
is needed only for **lifecycle**: clean disconnect (DROP the role we created) and future
re-introspection / re-auth. So token storage is additive and its own concern.

Seal the token with the shared envelope (`sealSecret` / `openSecret`,
`apps/api/src/secret-envelope.ts`), **new AAD context `dboauth:<dbId>`** — mirroring
`dbconn:<dbId>`. Same KEK (`BYO_SECRET_KEK`), same `nbe1.` format, same rotation story
already scoped in GLOBAL-031. No new crypto.

### New D1 migration (additive, forward-only — the free-tier rule)

```sql
-- 0030_db_oauth_grants.sql
-- OAuth grant backing a connected DB (Neon/Supabase). One row per BYO DB that was
-- connected via OAuth; paste-connected rows have none. The sealed connection URL
-- still lives in databases.connection_blob (GLOBAL-031) — this table only powers
-- clean disconnect + re-auth, so it is deliberately separate and optional.
CREATE TABLE db_oauth_grants (
  db_id            TEXT PRIMARY KEY REFERENCES databases(id),
  provider         TEXT NOT NULL,               -- 'neon' | 'supabase'
  token_blob       TEXT NOT NULL,               -- sealed refresh/access token, AAD dboauth:<dbId>
  provider_role    TEXT,                         -- the RO role nlqdb created, for DROP on disconnect
  provider_project TEXT,                         -- project ref, for display + re-introspect
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Alternative considered and rejected: reuse `databases.connection_blob` to also hold the
token — conflates the query credential with the lifecycle credential and muddies AAD
context. A separate table keyed by `db_id` is cleaner and its absence is meaningful
("paste-connected, nothing to revoke"). `DELETE /v1/databases/:id` gains a step: if a
`db_oauth_grants` row exists, open the token and best-effort DROP the provider role, then
delete both rows.

## 4. Surface parity (GLOBAL-003) — a *reasoned* N/A, not an omission

The one connect verb `POST /v1/db/connect` already ships on SDK (`client.databases.connect`),
CLI (`nlq db connect`, Go), and MCP (`nlqdb_connect_database`) — all taking a
`connection_url`. **OAuth is a browser-redirect handshake; SDK/CLI/MCP have no browser and
no redirect listener**, so they cannot run the consent flow. This is the same class of N/A
as `<nlq-data>` for the connect verb (wrong-surface, documented in SK-DBCONN-001), not a
gap to close later:

- **SDK / MCP:** keep `connection_url` (paste). These callers are already holding a
  credential (that's why they can call connect headlessly); OAuth would add a browser
  dependency they don't have. Documented tracked N/A.
- **CLI:** `nlq db connect <url>` (paste) stays. *Optionally* a future `nlq db connect --oauth neon`
  could run a local-loopback redirect (the `nlq login` device/loopback pattern) — but that
  is a separate capability, tracked, not required for parity now.
- **elements (`<nlq-data>`):** N/A unchanged (read-scoped public embed; no connect verb).

So the parity line reads: **web = OAuth-first + paste fallback; SDK/CLI/MCP = paste
(OAuth N/A, browser-flow only, tracked); elements = N/A.** This is a reasoned, recorded
N/A per GLOBAL-003's tracked-gap clause — identical treatment to the existing connect verb.

## 5. Egress + secrets invariants carried forward

- The resolved DSN goes through `validateByoConnection` (**GLOBAL-035** egress guard +
  DoH resolve-recheck) exactly as a pasted URL does — an OAuth-resolved host is still an
  untrusted outbound target and gets the same private-range/rebind guard. No bypass.
- The connection URL and the OAuth token never enter a span/log (GLOBAL-031 / GLOBAL-012);
  spans carry only `provider`, `nlqdb.engine`, and on success `db_id`.
- Provider REST calls each emit an OTel span (`oauth.token`, `provider.resolve`, etc.,
  **GLOBAL-014**).

## 6. Why this shape (design rationale)

- **Reuse over fork (GLOBAL-017, P5):** one connect pipeline, one sealed-blob storage
  boundary, one query-time dispatch. OAuth adds *only* a front-end resolver + two handshake
  routes. Removes the temptation to introspect "through the provider's API" (which would be
  a second, drifting introspection path).
- **Durable DSN, optional token:** query-time correctness needs nothing new; the token
  table is a clean, additive, lifecycle-only concern. This keeps the migration tiny and the
  hot path unchanged.
- **Neon-first falls out of the transport reality** (research.md §0): Neon's resolved host
  is the one the existing `neon()` HTTP driver already speaks, so Neon needs *zero* new
  transport. Supabase/DigitalOcean/etc. need a Workers Postgres-wire transport first — an
  orthogonal, larger piece of work.
