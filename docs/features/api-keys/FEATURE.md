---
name: api-keys
description: Long-lived API keys for CI / MCP hosts; rotation, revocation, scoping.
when-to-load:
  globs:
    - apps/api/src/index.ts
    - packages/sdk/**
  topics: [api-key, credential, rotation, revocation, ci]
---

# Feature: Api Keys

**One-liner:** Long-lived API keys for CI / MCP hosts; rotation, revocation, scoping.
**Status:** partial — Phase 1 `pk_live_` (per-DB read-only) ships end-to-end via `mintPkLiveKey` on `db.create`. **SK-MCP-010 slice 1** just shipped: `sk_live_` + `sk_mcp_<host>_<device>_` mint via `POST /v1/keys`, HMAC-SHA256 hashing, `lookupSkKey` in `principal.ts`, `last_used_at` bump on each successful lookup, and `GET /v1/databases` now accepts both bearer types (the MCP server's `nlqdb_list_databases` / `nlqdb_describe` tools work against the API on this PR). Dashboard key-management UI (mint button, copy-once toast, revoke flow), origin pinning for `pk_live_` (SK-APIKEYS-003 `allow_origins` column), rotation + 60-day grace (SK-APIKEYS-005), the `SK-APIKEYS-006` "sign out everywhere" wiring, the dedicated `API_KEY_SECRET`, and `<nlq-action>` write-tokens remain open work (see Open questions).
**Owners (code):** `apps/api/src/api-keys.ts`, `apps/api/src/principal.ts`, `apps/api/src/index.ts` (`POST /v1/keys`, `GET /v1/databases`), `packages/sdk/**`
**Cross-refs:** docs/architecture.md §4.1 (key types), §4.4 (service-to-service), §4.5 (rotation/revocation), §3.4 (MCP per-host keys) · docs/runbook.md §4 (Secrets)

## Touchpoints — read this feature before editing

- `apps/api/src/api-keys.ts` (mint / lookup / `last_used_at` bump for all three key types)
- `apps/api/src/principal.ts` (`Principal` discriminated union; bearer parsers; `accountTenantIdFromPrincipal`)
- `apps/api/src/index.ts` (`POST /v1/keys` mint endpoint; `GET /v1/databases` account-scoped principal gate)
- `apps/api/migrations/0011_api_keys.sql` (initial table) + `0012_api_keys_sk_columns.sql` (sk_mcp claims)
- `packages/sdk/**`

## Decisions

### SK-APIKEYS-001 — Three key types: `pk_live_`, `sk_live_`, `sk_mcp_<host>_<device>_`

- **Decision:** API keys come in exactly three prefix-tagged types. Each is fixed-purpose and not interchangeable: `pk_live_…` (publishable, read-only, per-DB, origin-pinned, used by `<nlq-data>`); `sk_live_…` (secret, server-only, full scope, used by backends and the HTTP API); `sk_mcp_<host>_<device>_…` (like `sk_live_` plus `(mcp_host, device_id)` claims, used by the MCP server).
- **Core value:** Simple, Bullet-proof, Effortless UX
- **Why:** A self-describing prefix tells a reader (human or log line) exactly what the key can do without consulting a database. A leaked browser key (`pk_live_`) cannot mutate; a leaked MCP key carries the host that minted it; an `sk_live_` is unambiguously a backend secret. Three types is the smallest number that distinguishes the three threat models cleanly.
- **Consequence in code:** Validators dispatch on prefix before consulting the DB. `pk_live_` keys reject any mutating call at the edge before the plan runs. The `sk_mcp_…` validator additionally enforces the `(mcp_host, device_id)` claims. New surfaces never get a fourth key type without a `GLOBAL-NNN`-grade decision.
- **Alternatives rejected:** One key type, scope encoded in claims — readers can't tell scope at a glance; log triage harder. Per-surface key types (`sk_web_`, `sk_cli_`, …) — sessions cover those; a key per surface is one more thing to rotate.
- **Source:** docs/architecture.md §4.1

### SK-APIKEYS-002 — Hash with Argon2id; store last 4 cleartext for display; no plaintext retrieval

- **Decision:** All API keys are hashed with Argon2id at rest. The last 4 characters are stored in cleartext purely for display (`"sk_live_…a4f7 · 3m ago · Cursor on macbook-air"`). Once issued, there is no path to retrieve the plaintext — losing a key means rotating it.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** A "reveal" path is one XSS / session-hijack / shoulder-surf away from a leak. Argon2id is the OWASP-recommended password-hash for greenfield work; we use it for keys for the same reasons (memory-hardness against GPU attackers). The `last_4` stub gives users enough to recognise *which* key they're looking at without giving anyone enough to use it.
- **Consequence in code:** The `keys` table stores `key_hash` (argon2id) + `last_4`. Verification is constant-time. No endpoint returns plaintext key material after creation. PRs that add a "show key" button or an `unhash_key()` helper are rejected at review.
- **Alternatives rejected:** Reveal-once flag tied to email re-confirmation — adds an "or you can have it back" path that erodes the discipline. Encrypted-at-rest with a master key — still a key-recovery surface; same risk model as plaintext. Bcrypt — older, no memory-hardness; reach for Argon2id per `GLOBAL-016`.
- **Source:** docs/architecture.md §4.1

### SK-APIKEYS-003 — `pk_live_` is read-only, origin-pinned, rate-limited; writes need `<nlq-action>` with a signed write-token

- **Decision:** Publishable keys cannot be used to mutate data. The edge rejects any `INSERT/UPDATE/DELETE` (and any `/v1/run` write call) with a `pk_live_` before the plan executes. Origin pinning is enforced at the edge by `Origin` / `Referer` matching against the key's allow-list. Writes from the browser go through `<nlq-action>` with a signed short-lived write-token (Phase 2).
- **Core value:** Bullet-proof, Effortless UX
- **Why:** A browser key is, by definition, in a hostile environment — anyone who views source can copy it. Read-only + origin-pinned + rate-limited makes the worst-case leak an annoyance, not a breach. Routing writes through a signed write-token keeps the threat model crisp: write capability is bound to a session, not to a long-lived browser-visible token.
- **Consequence in code:** `validatePkLive()` rejects any non-`SELECT` plan. `Origin` mismatch returns `403 origin_not_allowed`. `<nlq-action>` requires a write-token issued by the session-bound `/v1/write-token` endpoint. Writes attempted via `<nlq-data>` fail at the edge before reaching the planner.
- **Alternatives rejected:** Allow writes if `pk_live_` carries a `write` claim — cancels the read-only guarantee. Accept a CSRF token from the page — doesn't help in non-cookie contexts (static HTML on a CDN).
- **Source:** docs/architecture.md §4.1, §4.4

### SK-APIKEYS-004 — MCP keys are scoped per-host AND per-device; agents do not share credentials

- **Decision:** Each MCP integration mints its own key of the form `sk_mcp_<host>_<device>_…` carrying `{user_id, mcp_host, device_id, created_at, last_used_at}` claims. Two MCP hosts on the same machine — or the same host on two machines — get two separate keys. There is no "MCP key" that floats across hosts.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Per-host keys make revocation precise: "stop letting Cursor on this laptop talk to nlqdb" is one click instead of "rotate everywhere and re-onboard every host." It also keeps the audit log meaningful — every tool call has a `(user_id, mcp_host, device_id)` tuple, so the dashboard can show "Cursor on macbook-air ran 14 queries today."
- **Consequence in code:** `nlq mcp install` (per `docs/architecture.md §3.4`) mints via `POST /v1/keys` with `{type: "sk_mcp", host, device}` and writes the result straight to the host's config file (never displayed). DBs created via MCP are tagged with `(mcp_host, device_id)` and default to visible only under that tuple; promote-to-account is one click.
- **Alternatives rejected:** One MCP key per user — revocation blast radius is every host; bad UX for the "I need to revoke just my work laptop" case. Key per host (no device) — same key on two machines means one machine being compromised takes the host down everywhere.
- **Source:** docs/architecture.md §3.4, §4.1

### SK-APIKEYS-005 — Rotation has 60-day grace + webhook; rotate is the only path to recover from a lost key

- **Decision:** `nlq keys rotate <id>` (or the dashboard equivalent) mints a new key and deprecates the old with a 60-day grace window, emitting a webhook on rotation. There is no "reveal lost key" path; rotation is the recovery mechanism.
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** Hard-revoking on rotation would force every deployed system to swap simultaneously, taking a production app down on every rotation. 60 days is long enough to roll a key through a CI/CD pipeline at a reasonable cadence, short enough that long-tail use of the old key gets noticed. The webhook lets customers automate the swap if they prefer (e.g., update a Vercel env var).
- **Consequence in code:** `keys.rotate()` writes the new key, marks the old `expires_at = now + 60d`, and enqueues the rotation webhook (event-pipeline). The dashboard shows both the new and old key's `last_used_at` so the operator can see when the old one stops being used. The CLI verb is `nlq keys rotate <id>`; no `--force-revoke` flag.
- **Alternatives rejected:** Hard-revoke on rotate (no grace) — production outages on every rotation. Rotation copies the secret across deploys automatically — would require us to push to the customer's deploy target, which we do not have credentials for.
- **Source:** docs/architecture.md §4.5

### SK-APIKEYS-006 — Global sign-out clears `sk_mcp_…` but leaves `sk_live_` / `pk_live_` alone

- **Decision:** "Sign out everywhere" invalidates web sessions, CLI device refresh tokens, and every `sk_mcp_…` key — but does **not** revoke `sk_live_…` or `pk_live_…` keys. Production credentials must be rotated explicitly (`SK-APIKEYS-005`).
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** A user signing out from a stolen laptop should not also take down their production app. Sessions and MCP keys are tied to *a person on a device*; `sk_live_` / `pk_live_` are tied to *a deployment*. Conflating them turns a security action ("sign out") into a customer-facing outage.
- **Consequence in code:** `globalSignout(user_id)` filters by key type — the SQL `WHERE` excludes `sk_live_*` / `pk_live_*`. UI labels the action as "Sign out everywhere" with explicit copy that production keys must be rotated separately. The dashboard's production-key list links to the rotate flow.
- **Alternatives rejected:** Hard global sign-out (everything goes) — production outages on every "I left my laptop on the train." Leave MCP keys alone too — defeats the point; agents on a lost device keep working.
- **Source:** docs/architecture.md §4.5

### SK-APIKEYS-007 — Mint via `POST /v1/keys`; never display, write straight to host config

- **Decision:** All key minting goes through `POST /v1/keys` with `{type, scope, host?, device?}`. For MCP installs, the response is written straight to the host's config file by `nlq mcp install` — the plaintext key is never displayed in the terminal or dashboard. For `sk_live_`, the dashboard shows the plaintext exactly once at creation (copy button); reload destroys it.
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** A key that flashes through a terminal is a key in shell history, in screenshots, in the user's clipboard. Writing it directly to the host config (with permissions tightened) eliminates the human-typing leak path.
- **Consequence in code:** `POST /v1/keys` is the only mint path. `nlq mcp install` writes the response into the host config file before returning. The CLI never echoes the plaintext. Dashboard's create-key view returns the plaintext once; reload destroys it.
- **Alternatives rejected:** CLI prints the key — leaks via shell history / screenshot. Dashboard always shows the plaintext — defeats `SK-APIKEYS-002`. Email the key — email isn't a secure channel.
- **Source:** docs/architecture.md §3.4, §4.1

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-018** — Revocation is instant and visible across devices.
- **GLOBAL-008** — One Better Auth identity across all surfaces.

### SK-APIKEYS-008 — HMAC-SHA256 replaces Argon2id for all key storage on the Workers runtime

- **Decision:** API keys (all types: `pk_live_`, `sk_live_`, `sk_mcp_…`) are stored as `HMAC-SHA256(BETTER_AUTH_SECRET, plaintext_key)` (hex-encoded) in D1, not as Argon2id digests. Phase 2 migration to a dedicated `API_KEY_SECRET` secret is tracked as an open question below. `sk_live_` and `sk_mcp_…` keys ship in Phase 2 (CLI install, MCP onboarding); this decision lands with `pk_live_` in Phase 1.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** Argon2id is not available in the Cloudflare Workers runtime — the Web Crypto API only surfaces SHA, HMAC, AES, PBKDF2, HKDF, RSA, and ECDH. For randomly generated, high-entropy secrets (≥128 bits of CSPRNG output — what `pk_live_`, `sk_live_`, and `sk_mcp_` all are), HMAC-SHA256 provides equivalent protection against database-dump attacks: the preimage attack cost on a 128-bit random input is 2^128 SHA-256 operations regardless of whether the function is memory-hard. Argon2id's memory-hardening only improves security over fast hashes for *low-entropy* inputs (user-chosen passwords), which none of our key types are. Reusing `BETTER_AUTH_SECRET` avoids adding a new required secret in Phase 1 while keeping key hashes distinct from the HMAC-signed anon-stash cookies (different HMAC messages, same key — a security-standard pattern).
- **Consequence in code:** `apps/api/src/api-keys.ts` is the only file that calls `crypto.subtle.importKey` / `crypto.subtle.sign` for key hashing. The `api_keys` D1 table stores `key_hash TEXT UNIQUE` (HMAC hex) + `last_4 TEXT` for display — not the plaintext key. Lookup is `WHERE key_hash = ?` with the computed HMAC. Verification is constant-time at the HMAC layer (identical-length hex strings). PRs that store plaintext keys or use a hash other than HMAC-SHA256 fail review.
- **Alternatives rejected:**
  - Argon2id WASM bundle — unavailable as a first-party Workers primitive; the smallest maintained WASM builds add ~200 KB to the bundle, violating `GLOBAL-013`'s 3 MiB total budget.
  - PBKDF2 (available in Web Crypto) — provides memory-cost via iteration count but is single-threaded and still insufficient for low-entropy inputs at practical iteration counts; irrelevant for random keys anyway.
  - Plaintext storage — D1 at rest is Cloudflare-encrypted but operator-readable; a `SELECT * FROM api_keys` would expose all keys.
  - SHA-256 without HMAC — no keyed component means anyone with the database dump can compute the hash of any candidate key directly; HMAC binds the hash to the server secret so the attacker needs both the dump *and* `BETTER_AUTH_SECRET`.

## Open questions / known unknowns

- **Dashboard key-management UI (Phase 2).** `POST /v1/keys` ships in this slice; the dashboard pages that wrap it — generate-key form, copy-once toast (`SK-APIKEYS-002`), key list with `last_4` + `last_used_at` + label, revoke button — are open work in `apps/web`. The `nlq mcp install` deep-link flow (`SK-MCP-007` happy path) wires through `app.nlqdb.com/mcp` and depends on the same UI surface.
- **`POST /v1/keys` revoke path.** Mint is live; revoke (`DELETE /v1/keys/:id`) is not. SK-APIKEYS-005 specifies 60-day grace with a deprecation flag; the minimal slice the dashboard needs is hard-revoke, with grace landing alongside the rotation webhook.
- **`SK-APIKEYS-006` "sign out everywhere" wiring.** The decision (revoke every `sk_mcp_…` row on global sign-out, leave `sk_live_` / `pk_live_` alone) is locked, but no global-sign-out endpoint exists yet — Better Auth's per-session sign-out is the only path today. Implement when the dashboard "sign out everywhere" affordance ships.
- **Dedicated `API_KEY_SECRET`.** `SK-APIKEYS-008` reuses `BETTER_AUTH_SECRET` as the HMAC key. Phase 2 should add a separate `API_KEY_SECRET` secret so key-hash HMAC and session-signing HMAC use independent keys. Rotation of one doesn't invalidate the other.
- **Origin pinning for `pk_live_`.** `SK-APIKEYS-003` specifies per-key `allow_origins`. The `api_keys` table has no `allow_origins` column yet; Phase 1 skips origin enforcement (any origin can use a `pk_live_` key). Add `allow_origins TEXT` in Phase 2 when the dashboard key-management UI ships.
- **`<nlq-action>` write-token shape (Phase 2).** `SK-APIKEYS-003` defers writes through `<nlq-action>` with a "signed short-lived write-token." The token's TTL, claim shape, and binding (per-DB? per-action?) aren't yet specified. Decide before the Phase 2 web-app slice that ships writes from the browser.
- **Webhook delivery guarantees on rotate.** `SK-APIKEYS-005` says rotation emits a webhook. The events-pipeline feature governs delivery semantics (at-least-once with retries) — confirm that rotation events meet the at-least-once contract when the events slice lands.
- **Rotation grace observability.** Need a dashboard signal for "old key still in use 7 days into its 60d grace" so operators know whether to worry. Track in the observability feature once the rotation slice lands.
- **`NLQDB_API_KEY` precedence with multiple keys.** `GLOBAL-010` says the env var is the escape hatch. If a user has both a keychain-stored key and `NLQDB_API_KEY`, the env var wins (per `docs/architecture.md §3.4` install path 4). Confirm CLI and MCP both implement that ordering identically.
- **`sk_live_` surface mapping.** `surfaceFromPrincipal` maps `sk_live_` → `"cli"` (the most common caller — `NLQDB_API_KEY` in shells / CI). Raw-HTTP-API callers using `sk_live_` outside of the CLI path will mislabel as `cli` until a distinct `"api"` value is added to `@nlqdb/events`'s `NlqSurface` union. Promote when API-direct volume becomes a meaningful signal.
