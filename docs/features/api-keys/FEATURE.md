---
name: api-keys
description: Long-lived API keys for CI / MCP hosts; rotation, revocation, scoping.
when-to-load:
  globs:
    - apps/api/src/index.ts
    - apps/api/src/api-keys.ts
    - packages/sdk/**
  topics: [api-key, credential, rotation, revocation, ci]
---

# Feature: Api Keys

**One-liner:** Long-lived API keys for CI / MCP hosts; rotation, revocation, scoping.
**Status:** partial — `pk_live_` (per-DB read-only), `sk_live_` and `sk_mcp_*` mint via `POST /v1/keys` (slices 1 + 3b of `SK-MCP-010`); HMAC-SHA256 hashing, `revoked_at` column + `lookupSkKey` filtering it out, `last_used_at` bump on lookup, OAuth-callback mint path (`SK-APIKEYS-009`). **`GET /v1/keys` + `DELETE /v1/keys/:id` ship** (`SK-APIKEYS-010` / `SK-APIKEYS-011`) — SDK + CLI `nlq keys list|revoke` wired. Dashboard UI, origin pinning for `pk_live_` (`SK-APIKEYS-003` `allow_origins`), rotation grace (`SK-APIKEYS-005`), global sign-out (`SK-APIKEYS-006`), dedicated `API_KEY_SECRET`, and `<nlq-action>` write-tokens remain open (see Open questions).
**Owners (code):** `apps/api/src/api-keys.ts`, `apps/api/src/principal.ts`, `apps/api/src/index.ts` (`POST /v1/keys`, `GET /v1/keys`, `DELETE /v1/keys/:id`, `GET /v1/databases`), `packages/sdk/**`, `cli/internal/cmd/keys.go`
**Cross-refs:** docs/architecture.md §4.1 (key types), §4.4 (service-to-service), §4.5 (rotation/revocation), §3.4 (MCP per-host keys) · docs/runbook.md §4 (Secrets)

## Touchpoints — read this feature before editing

- `apps/api/src/api-keys.ts` (mint / lookup / list / revoke / `last_used_at` bump for all three key types)
- `apps/api/src/principal.ts` (`Principal` discriminated union; bearer parsers; `accountTenantIdFromPrincipal`)
- `apps/api/src/index.ts` (`POST /v1/keys` mint, `GET /v1/keys` list, `DELETE /v1/keys/:id` revoke, `GET /v1/databases` account-scoped principal gate)
- `apps/api/migrations/0011_api_keys.sql` (initial table) + `0012_api_keys_sk_columns.sql` (sk_mcp claims) + `0013_api_keys_revoked.sql` (`revoked_at`)
- `packages/sdk/**` (`listKeys`, `revokeKey`, `KeyRecord`)
- `cli/internal/cmd/keys.go` (`nlq keys list`, `nlq keys revoke`)

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-APIKEYS-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-APIKEYS-001**](decisions/SK-APIKEYS-001-three-key-types.md) — Three key types: `pk_live_`, `sk_live_`, `sk_mcp_<host>_<device>_`.
- [**SK-APIKEYS-002**](decisions/SK-APIKEYS-002-argon2id-no-plaintext.md) — Hash at rest; `last_4` for display; no plaintext retrieval. (Hash function superseded by SK-APIKEYS-008.)
- [**SK-APIKEYS-003**](decisions/SK-APIKEYS-003-pk-live-readonly.md) — `pk_live_` is read-only, origin-pinned; writes need `<nlq-action>` with a signed write-token.
- [**SK-APIKEYS-004**](decisions/SK-APIKEYS-004-mcp-per-host-per-device.md) — MCP keys are scoped per-host AND per-device.
- [**SK-APIKEYS-005**](decisions/SK-APIKEYS-005-rotation-grace.md) — Rotation has 60-day grace + webhook; rotate is the only path to recover from a lost key. (Not yet shipped — see Open questions.)
- [**SK-APIKEYS-006**](decisions/SK-APIKEYS-006-global-signout-scope.md) — Global sign-out clears `sk_mcp_…` but leaves `sk_live_` / `pk_live_` alone.
- [**SK-APIKEYS-007**](decisions/SK-APIKEYS-007-mint-via-post-keys.md) — Mint via `POST /v1/keys`; never display, write straight to host config.
- [**SK-APIKEYS-008**](decisions/SK-APIKEYS-008-hmac-sha256-storage.md) — HMAC-SHA256 replaces Argon2id for all key storage on the Workers runtime.
- [**SK-APIKEYS-009**](decisions/SK-APIKEYS-009-sk-mcp-server-side-mint.md) — `sk_mcp_*` minted server-side at `POST /v1/oauth/mcp-callback`, never displayed.
- [**SK-APIKEYS-010**](decisions/SK-APIKEYS-010-list-endpoint.md) — `GET /v1/keys` lists the caller's inventory in one envelope; no pagination in v1.
- [**SK-APIKEYS-011**](decisions/SK-APIKEYS-011-hard-revoke.md) — `DELETE /v1/keys/:id` is hard-revoke; rotation grace lives in SK-APIKEYS-005.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-018** — Revocation is instant and visible across devices.
  - *In this feature:* `DELETE /v1/keys/:id` ([`SK-APIKEYS-011`](decisions/SK-APIKEYS-011-hard-revoke.md)) is the revoke surface. Propagation to live MCP sessions is ≤ 1 s through `SK-MCP-014`'s DO revalidation cache; `lookupSkKey` filters `revoked_at IS NULL` at the source so cookie sessions and CLI bearers see the revocation on their next request.
- **GLOBAL-008** — One Better Auth identity across all surfaces.

## Open questions / known unknowns

- **Dashboard key-management UI (Phase 2).** `POST /v1/keys` + `GET /v1/keys` + `DELETE /v1/keys/:id` all ship; the dashboard pages that wrap them — generate-key form, copy-once toast (`SK-APIKEYS-002`), key list with `last_4` + `last_used_at` + label, revoke button — are open work in `apps/web`. The `nlq mcp install` deep-link flow (`SK-MCP-007` happy path) wires through `app.nlqdb.com/mcp` and depends on the same UI surface.
- **`POST /v1/keys/:id/rotate`.** Mint + hard-revoke are live; rotation with 60-day grace + webhook is not. Lands alongside the events-pipeline rotation event ([`SK-APIKEYS-005`](decisions/SK-APIKEYS-005-rotation-grace.md)). Until then, "recover from a lost key" is "mint a new one and revoke the old".
- **`SK-APIKEYS-006` "sign out everywhere" wiring.** The decision (revoke every `sk_mcp_…` row on global sign-out, leave `sk_live_` / `pk_live_` alone) is locked, but no global-sign-out endpoint exists yet — Better Auth's per-session sign-out is the only path today. Implement when the dashboard "sign out everywhere" affordance ships.
- **Dedicated `API_KEY_SECRET`.** `SK-APIKEYS-008` reuses `BETTER_AUTH_SECRET` as the HMAC key. Phase 2 should add a separate `API_KEY_SECRET` secret so key-hash HMAC and session-signing HMAC use independent keys. Rotation of one doesn't invalidate the other.
- **Origin pinning for `pk_live_`.** `SK-APIKEYS-003` specifies per-key `allow_origins`. The `api_keys` table has no `allow_origins` column yet; Phase 1 skips origin enforcement (any origin can use a `pk_live_` key). Add `allow_origins TEXT` in Phase 2 when the dashboard key-management UI ships.
- **`<nlq-action>` write-token shape (Phase 2).** `SK-APIKEYS-003` defers writes through `<nlq-action>` with a "signed short-lived write-token." The token's TTL, claim shape, and binding (per-DB? per-action?) aren't yet specified. Decide before the Phase 2 web-app slice that ships writes from the browser.
- **Webhook delivery guarantees on rotate.** `SK-APIKEYS-005` says rotation emits a webhook. The events-pipeline feature governs delivery semantics (at-least-once with retries) — confirm that rotation events meet the at-least-once contract when the events slice lands.
- **Rotation grace observability.** Need a dashboard signal for "old key still in use 7 days into its 60d grace" so operators know whether to worry. Track in the observability feature once the rotation slice lands.
- **`NLQDB_API_KEY` precedence with multiple keys.** `GLOBAL-010` says the env var is the escape hatch. If a user has both a keychain-stored key and `NLQDB_API_KEY`, the env var wins (per `docs/architecture.md §3.4` install path 4). Confirm CLI and MCP both implement that ordering identically.
- **`sk_live_` surface mapping.** `surfaceFromPrincipal` maps `sk_live_` → `"cli"` (the most common caller — `NLQDB_API_KEY` in shells / CI). Raw-HTTP-API callers using `sk_live_` outside of the CLI path will mislabel as `cli` until a distinct `"api"` value is added to `@nlqdb/events`'s `NlqSurface` union. Promote when API-direct volume becomes a meaningful signal.
- **`Idempotency-Key` semantics for `POST /v1/keys`.** `GLOBAL-005` requires every mutation to accept `Idempotency-Key`. Mint replay through the standard middleware would store the response body — including the plaintext — in the idempotency cache, which violates `SK-APIKEYS-002` ("once issued, there is no path to retrieve the plaintext"). The current slice does not wire idempotency on `/v1/keys`; either (a) the middleware grows a "do-not-cache-body" annotation for mint-like endpoints, or (b) `/v1/keys` is exempted from `GLOBAL-005` with a feature-local nested commentary. Decide before the idempotency-middleware slice lands. `DELETE /v1/keys/:id` is idempotent by RFC 9110 ([`SK-APIKEYS-011`](decisions/SK-APIKEYS-011-hard-revoke.md)) so it does not need this header.
