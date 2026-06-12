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
**Status:** partial — `pk_live_` (per-DB read-only), `sk_live_` and `sk_mcp_*` mint via `POST /v1/keys` (slices 1 + 3b of `SK-MCP-010`); HMAC-SHA256 hashing, `revoked_at` column + `lookupSkKey` filtering it out, `last_used_at` bump on lookup, OAuth-callback mint path (`SK-APIKEYS-009`). **`GET /v1/keys` + `DELETE /v1/keys/:id` ship** (`SK-APIKEYS-010` / `SK-APIKEYS-011`) — SDK + CLI `nlq keys list|revoke` wired. **Dashboard UI ships** at `/app/keys` (`SK-APIKEYS-012`) — copy-once mint modal + revoke-confirm dialog, SDK gains `client.mintKey()`; the Cmd+K palette in chat and the MCP `auth_required` envelope both point here. Dedicated `API_KEY_SECRET` ships (`SK-APIKEYS-014`) — `apiKeyHmacSecret()` resolves it with a `BETTER_AUTH_SECRET` fallback; `.envrc` + GHA secret are seeded to the current value (zero-rehash), and the prod Worker picks it up on the next `deploy-api.yml` run. Origin pinning for `pk_live_` (`SK-APIKEYS-003` `allow_origins`), rotation grace (`SK-APIKEYS-005`), global sign-out (`SK-APIKEYS-006`), and `<nlq-action>` write-tokens remain open (see Open questions).
**Owners (code):** `apps/api/src/api-keys.ts`, `apps/api/src/principal.ts`, `apps/api/src/index.ts` (`POST /v1/keys`, `GET /v1/keys`, `DELETE /v1/keys/:id`, `GET /v1/databases`), `packages/sdk/**`, `cli/internal/cmd/keys.go`, `apps/web/src/pages/app/keys.astro`, `apps/web/src/components/keys/**`
**Cross-refs:** docs/architecture.md §4.1 (key types), §4.4 (service-to-service), §4.5 (rotation/revocation), §3.4 (MCP per-host keys) · docs/runbook.md §4 (Secrets)

## Touchpoints — read this feature before editing

- `apps/api/src/api-keys.ts` (mint / lookup / list / revoke / `last_used_at` bump for all three key types)
- `apps/api/src/principal.ts` (`Principal` discriminated union; bearer parsers; `accountTenantIdFromPrincipal`)
- `apps/api/src/index.ts` (`POST /v1/keys` mint, `GET /v1/keys` list, `DELETE /v1/keys/:id` revoke, `GET /v1/databases` account-scoped principal gate)
- `apps/api/migrations/0011_api_keys.sql` (initial table) + `0012_api_keys_sk_columns.sql` (sk_mcp claims) + `0013_api_keys_revoked.sql` (`revoked_at`)
- `packages/sdk/**` (`mintKey`, `listKeys`, `revokeKey`, `KeyRecord`, `MintKeyRequest`, `MintKeyResult`)
- `cli/internal/cmd/keys.go` (`nlq keys list`, `nlq keys revoke`)
- `apps/web/src/pages/app/keys.astro` + `apps/web/src/components/keys/**` (dashboard UI per `SK-APIKEYS-012`)

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
- [**SK-APIKEYS-012**](decisions/SK-APIKEYS-012-dashboard-ui.md) — Dashboard key-management UI at `/app/keys` with copy-once mint + confirm-revoke; SDK gains `client.mintKey()`.
- [**SK-APIKEYS-013**](decisions/SK-APIKEYS-013-mint-idempotency-redact-on-replay.md) — Mint accepts `Idempotency-Key` (no double-mint) but redacts the plaintext on replay, honouring both `GLOBAL-005` and `SK-APIKEYS-002`.
- [**SK-APIKEYS-014**](decisions/SK-APIKEYS-014-dedicated-api-key-secret.md) — Dedicated `API_KEY_SECRET` for key hashing via `apiKeyHmacSecret()`, falling back to `BETTER_AUTH_SECRET`; zero-rehash migration by seeding to the current value.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-018** — Revocation is instant and visible across devices.
  - *In this feature:* `DELETE /v1/keys/:id` ([`SK-APIKEYS-011`](decisions/SK-APIKEYS-011-hard-revoke.md)) is the revoke surface. Propagation to live MCP sessions is ≤ 1 s through `SK-MCP-014`'s DO revalidation cache; `lookupSkKey` filters `revoked_at IS NULL` at the source so cookie sessions and CLI bearers see the revocation on their next request.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-031** — One AES-256-GCM at-rest envelope + one Workers-held KEK for every BYO secret.
  - *In this feature:* `scope = "byollm"` rows (`key_type = "byollm"`) store the provider key as a `secret-envelope.ts` blob in `key_hash` (context `byollm:<tenantId>`), not the HMAC hash used for nlqdb-minted `sk_*`/`pk_*` keys — those stay one-way per `SK-APIKEYS-008` since we never read them back; BYO keys we must decrypt to dispatch, hence the reversible AAD-bound envelope. Concrete row schema + the `key_type` CHECK extension live in [`SK-PREMIUM-012`](../premium-tier/decisions/SK-PREMIUM-012-account-stored-byollm-storage.md); `listKeysByTenant` filters these rows out so they never appear in the bearer-key list.

## Open questions / known unknowns

- **`POST /v1/keys/:id/rotate` — Parked until the rotation slice.** Mint + hard-revoke are live; 60-day-grace rotation + webhook + the grace-window observability signal ("old key still used N days into its grace", off `last_used_at`) land together with the events-pipeline rotation event ([`SK-APIKEYS-005`](decisions/SK-APIKEYS-005-rotation-grace.md)). Until then, recover from a lost key by minting a new one and revoking the old.
- **`SK-APIKEYS-006` "sign out everywhere" — Parked until a global-sign-out endpoint exists.** The decision (revoke every `sk_mcp_…` row, leave `sk_live_` / `pk_live_` alone) is locked; Better Auth's per-session sign-out is the only path today. Wire with the dashboard affordance.
- **Origin pinning for `pk_live_` — Parked until the Phase 2 key-management UI.** `SK-APIKEYS-003` specifies per-key `allow_origins`; the `api_keys` column + enforcement land with that slice (Phase 1 accepts any origin on a `pk_live_` key).
- **`<nlq-action>` write-token shape — Parked until the Phase 2 browser-writes slice** (`GLOBAL-033`, speculative-scope → decide in the slice, not on spec). `SK-APIKEYS-003` defers browser writes to a "signed short-lived write-token"; its TTL / claim shape / per-DB-vs-per-action binding are decided when that slice ships.
- **`sk_live_` surface label — Parked until API-direct volume is a meaningful signal** (`GLOBAL-033`, silent-drift → benign mislabel, defer the cheap fix). `surfaceFromPrincipal` maps `sk_live_` → `"cli"`; raw-HTTP callers mislabel as `cli` until an `"api"` value is added to `@nlqdb/events`'s `NlqSurface` union.
