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
**Status:** implemented
**Owners (code):** `apps/api/src/index.ts`, `packages/sdk/**`
**Cross-refs:** docs/design.md §4.1 (key types), §4.4 (service-to-service), §4.5 (rotation/revocation), §3.4 (MCP per-host keys) · docs/runbook.md §4 (Secrets)

## Touchpoints — read this skill before editing

- `apps/api/src/index.ts`
- `packages/sdk/**`

## Decisions

### SK-APIKEYS-001 — Three key types: `pk_live_`, `sk_live_`, `sk_mcp_<host>_<device>_`

- **Decision:** API keys come in exactly three prefix-tagged types. Each is fixed-purpose and not interchangeable: `pk_live_…` (publishable, read-only, per-DB, origin-pinned, used by `<nlq-data>`); `sk_live_…` (secret, server-only, full scope, used by backends and the HTTP API); `sk_mcp_<host>_<device>_…` (like `sk_live_` plus `(mcp_host, device_id)` claims, used by the MCP server).
- **Core value:** Simple, Bullet-proof, Effortless UX
- **Why:** A self-describing prefix tells a reader (human or log line) exactly what the key can do without consulting a database. A leaked browser key (`pk_live_`) cannot mutate; a leaked MCP key carries the host that minted it; an `sk_live_` is unambiguously a backend secret. Three types is the smallest number that distinguishes the three threat models cleanly.
- **Consequence in code:** Validators dispatch on prefix before consulting the DB. `pk_live_` keys reject any mutating call at the edge before the plan runs. The `sk_mcp_…` validator additionally enforces the `(mcp_host, device_id)` claims. New surfaces never get a fourth key type without a `GLOBAL-NNN`-grade decision.
- **Alternatives rejected:** One key type, scope encoded in claims — readers can't tell scope at a glance; log triage harder. Per-surface key types (`sk_web_`, `sk_cli_`, …) — sessions cover those; a key per surface is one more thing to rotate.
- **Source:** docs/design.md §4.1

### SK-APIKEYS-002 — Hash with Argon2id; store last 4 cleartext for display; no plaintext retrieval

- **Decision:** All API keys are hashed with Argon2id at rest. The last 4 characters are stored in cleartext purely for display (`"sk_live_…a4f7 · 3m ago · Cursor on macbook-air"`). Once issued, there is no path to retrieve the plaintext — losing a key means rotating it.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** A "reveal" path is one XSS / session-hijack / shoulder-surf away from a leak. Argon2id is the OWASP-recommended password-hash for greenfield work; we use it for keys for the same reasons (memory-hardness against GPU attackers). The `last_4` stub gives users enough to recognise *which* key they're looking at without giving anyone enough to use it.
- **Consequence in code:** The `keys` table stores `key_hash` (argon2id) + `last_4`. Verification is constant-time. No endpoint returns plaintext key material after creation. PRs that add a "show key" button or an `unhash_key()` helper are rejected at review.
- **Alternatives rejected:** Reveal-once flag tied to email re-confirmation — adds an "or you can have it back" path that erodes the discipline. Encrypted-at-rest with a master key — still a key-recovery surface; same risk model as plaintext. Bcrypt — older, no memory-hardness; reach for Argon2id per `GLOBAL-016`.
- **Source:** docs/design.md §4.1

### SK-APIKEYS-003 — `pk_live_` is read-only, origin-pinned, rate-limited; writes need `<nlq-action>` with a signed write-token

- **Decision:** Publishable keys cannot be used to mutate data. The edge rejects any `INSERT/UPDATE/DELETE` (and any `/v1/run` write call) with a `pk_live_` before the plan executes. Origin pinning is enforced at the edge by `Origin` / `Referer` matching against the key's allow-list. Writes from the browser go through `<nlq-action>` with a signed short-lived write-token (Phase 2).
- **Core value:** Bullet-proof, Effortless UX
- **Why:** A browser key is, by definition, in a hostile environment — anyone who views source can copy it. Read-only + origin-pinned + rate-limited makes the worst-case leak an annoyance, not a breach. Routing writes through a signed write-token keeps the threat model crisp: write capability is bound to a session, not to a long-lived browser-visible token.
- **Consequence in code:** `validatePkLive()` rejects any non-`SELECT` plan. `Origin` mismatch returns `403 origin_not_allowed`. `<nlq-action>` requires a write-token issued by the session-bound `/v1/write-token` endpoint. Writes attempted via `<nlq-data>` fail at the edge before reaching the planner.
- **Alternatives rejected:** Allow writes if `pk_live_` carries a `write` claim — cancels the read-only guarantee. Accept a CSRF token from the page — doesn't help in non-cookie contexts (static HTML on a CDN).
- **Source:** docs/design.md §4.1, §4.4

### SK-APIKEYS-004 — MCP keys are scoped per-host AND per-device; agents do not share credentials

- **Decision:** Each MCP integration mints its own key of the form `sk_mcp_<host>_<device>_…` carrying `{user_id, mcp_host, device_id, created_at, last_used_at}` claims. Two MCP hosts on the same machine — or the same host on two machines — get two separate keys. There is no "MCP key" that floats across hosts.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Per-host keys make revocation precise: "stop letting Cursor on this laptop talk to nlqdb" is one click instead of "rotate everywhere and re-onboard every host." It also keeps the audit log meaningful — every tool call has a `(user_id, mcp_host, device_id)` tuple, so the dashboard can show "Cursor on macbook-air ran 14 queries today."
- **Consequence in code:** `nlq mcp install` (per `docs/design.md §3.4`) mints via `POST /v1/keys` with `{type: "sk_mcp", host, device}` and writes the result straight to the host's config file (never displayed). DBs created via MCP are tagged with `(mcp_host, device_id)` and default to visible only under that tuple; promote-to-account is one click.
- **Alternatives rejected:** One MCP key per user — revocation blast radius is every host; bad UX for the "I need to revoke just my work laptop" case. Key per host (no device) — same key on two machines means one machine being compromised takes the host down everywhere.
- **Source:** docs/design.md §3.4, §4.1

### SK-APIKEYS-005 — Rotation has 60-day grace + webhook; rotate is the only path to recover from a lost key

- **Decision:** `nlq keys rotate <id>` (or the dashboard equivalent) mints a new key and deprecates the old with a 60-day grace window, emitting a webhook on rotation. There is no "reveal lost key" path; rotation is the recovery mechanism.
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** Hard-revoking on rotation would force every deployed system to swap simultaneously, taking a production app down on every rotation. 60 days is long enough to roll a key through a CI/CD pipeline at a reasonable cadence, short enough that long-tail use of the old key gets noticed. The webhook lets customers automate the swap if they prefer (e.g., update a Vercel env var).
- **Consequence in code:** `keys.rotate()` writes the new key, marks the old `expires_at = now + 60d`, and enqueues the rotation webhook (event-pipeline). The dashboard shows both the new and old key's `last_used_at` so the operator can see when the old one stops being used. The CLI verb is `nlq keys rotate <id>`; no `--force-revoke` flag.
- **Alternatives rejected:** Hard-revoke on rotate (no grace) — production outages on every rotation. Rotation copies the secret across deploys automatically — would require us to push to the customer's deploy target, which we do not have credentials for.
- **Source:** docs/design.md §4.5

### SK-APIKEYS-006 — Global sign-out clears `sk_mcp_…` but leaves `sk_live_` / `pk_live_` alone

- **Decision:** "Sign out everywhere" invalidates web sessions, CLI device refresh tokens, and every `sk_mcp_…` key — but does **not** revoke `sk_live_…` or `pk_live_…` keys. Production credentials must be rotated explicitly (`SK-APIKEYS-005`).
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** A user signing out from a stolen laptop should not also take down their production app. Sessions and MCP keys are tied to *a person on a device*; `sk_live_` / `pk_live_` are tied to *a deployment*. Conflating them turns a security action ("sign out") into a customer-facing outage.
- **Consequence in code:** `globalSignout(user_id)` filters by key type — the SQL `WHERE` excludes `sk_live_*` / `pk_live_*`. UI labels the action as "Sign out everywhere" with explicit copy that production keys must be rotated separately. The dashboard's production-key list links to the rotate flow.
- **Alternatives rejected:** Hard global sign-out (everything goes) — production outages on every "I left my laptop on the train." Leave MCP keys alone too — defeats the point; agents on a lost device keep working.
- **Source:** docs/design.md §4.5

### SK-APIKEYS-007 — Mint via `POST /v1/keys`; never display, write straight to host config

- **Decision:** All key minting goes through `POST /v1/keys` with `{type, scope, host?, device?}`. For MCP installs, the response is written straight to the host's config file by `nlq mcp install` — the plaintext key is never displayed in the terminal or dashboard. For `sk_live_`, the dashboard shows the plaintext exactly once at creation (copy button); reload destroys it.
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** A key that flashes through a terminal is a key in shell history, in screenshots, in the user's clipboard. Writing it directly to the host config (with permissions tightened) eliminates the human-typing leak path.
- **Consequence in code:** `POST /v1/keys` is the only mint path. `nlq mcp install` writes the response into the host config file before returning. The CLI never echoes the plaintext. Dashboard's create-key view returns the plaintext once; reload destroys it.
- **Alternatives rejected:** CLI prints the key — leaks via shell history / screenshot. Dashboard always shows the plaintext — defeats `SK-APIKEYS-002`. Email the key — email isn't a secure channel.
- **Source:** docs/design.md §3.4, §4.1

### GLOBAL-010 — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch

- **Decision:** Long-lived credentials (CLI tokens, MCP host keys) live
  in the OS keychain (Keychain on macOS, libsecret on Linux,
  Credential Manager on Windows). The only env-var path is
  `NLQDB_API_KEY`, used in CI / containerized environments where a
  keychain is unavailable.
- **Core value:** Seamless auth, Bullet-proof
- **Why:** Keychain storage means credentials survive reboots, are
  encrypted at rest by the OS, and don't leak into shell history /
  ps output / env-dump screenshots. The single env-var fallback is
  the explicit, auditable escape hatch — it doesn't quietly become
  the default.
- **Consequence in code:** `cli/` and `packages/mcp` use a small
  keychain abstraction; tokens are written there on first sign-in.
  When the keychain is missing (CI, Docker), `NLQDB_API_KEY` is read
  with a one-line message that names the env-var explicitly. No
  config-file fallback, no `~/.nlqdb/credentials.json`.
- **Alternatives rejected:**
  - Plain config-file storage in `~/.nlqdb/` — leaks via cloud
    backups / dotfile syncs.
  - Required env vars — bad UX on a developer laptop.
- **Source:** docs/decisions.md#GLOBAL-010

### GLOBAL-018 — Revocation is instant and visible across devices

- **Decision:** Revoking a token, API key, or session takes effect on
  the next request — no caching window, no propagation delay. The
  user sees, in every active surface, that the credential is gone.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Revocation that "eventually" propagates is a security
  hole. A user pressing "sign out everywhere" or rotating an API key
  expects immediate effect — across web, CLI, MCP, and any agent
  with the credential. Anything less and the feature has lied.
- **Consequence in code:** Token/key validation hits the auth
  service on every request (or against a sub-second-stale cache);
  revoked credentials return a clear, recoverable error
  (`GLOBAL-012`). Surfaces show a banner / message naming the
  revocation. Tests cover "revoke from web → CLI 401 on next call."
- **Alternatives rejected:**
  - Long-lived JWTs with no revocation list — revocation becomes a
    lie.
  - Soft revocation (mark, sweep later) — same problem, slower.
- **Source:** docs/decisions.md#GLOBAL-018

### GLOBAL-008 — One Better Auth identity across all surfaces

- **Decision:** A user has exactly one identity, managed by Better Auth.
  CLI, MCP, web, and SDK all authenticate through that identity (via
  bearer / cookie / device-flow). No surface owns its own auth store.
- **Core value:** Seamless auth, Simple, Bullet-proof
- **Why:** Multi-surface products fragment when each surface owns its
  own identity model — a user signs in to web but the CLI doesn't know,
  or the MCP key isn't tied to the same human. One identity model means
  one revocation surface (`GLOBAL-018`), one rate-limit surface, one
  audit log.
- **Consequence in code:** `packages/auth-internal` is the only thing
  that talks to Better Auth. Every other surface consumes its
  primitives. CLI's device-flow auth and MCP's host-scoped keys both
  resolve to a single `user_id`.
- **Alternatives rejected:**
  - Per-surface identity systems — fragmented audit trails, fragmented
    revocation, no cross-surface session continuity.
  - Bring-your-own-IdP only — punts the problem to operators; bad
    default for the free tier.
- **Source:** docs/decisions.md#GLOBAL-008

## Open questions / known unknowns

- **`<nlq-action>` write-token shape (Phase 2).** `SK-APIKEYS-003` defers writes through `<nlq-action>` with a "signed short-lived write-token." The token's TTL, claim shape, and binding (per-DB? per-action?) aren't yet specified. Decide before the Phase 2 web-app slice that ships writes from the browser.
- **Webhook delivery guarantees on rotate.** `SK-APIKEYS-005` says rotation emits a webhook. The events-pipeline skill governs delivery semantics (at-least-once with retries) — confirm that rotation events meet the at-least-once contract when the events slice lands.
- **Rotation grace observability.** Need a dashboard signal for "old key still in use 7 days into its 60d grace" so operators know whether to worry. Track in the observability skill once the rotation slice lands.
- **`NLQDB_API_KEY` precedence with multiple keys.** `GLOBAL-010` says the env var is the escape hatch. If a user has both a keychain-stored key and `NLQDB_API_KEY`, the env var wins (per `docs/design.md §3.4` install path 4). Confirm CLI and MCP both implement that ordering identically.
