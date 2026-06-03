# SK-SDK-011 — account-stored BYOLLM verbs: `setByollm` / `getByollmStatus` / `clearByollm`

Parent feature: [`sdk/FEATURE.md`](../FEATURE.md). Per-request counterpart:
[`SK-SDK-010`](./SK-SDK-010-byollm-client-option.md). Storage + routes:
[`SK-PREMIUM-012`](../../premium-tier/decisions/SK-PREMIUM-012-account-stored-byollm-storage.md).
Parent GLOBALs: [`GLOBAL-001`](../../../decisions/GLOBAL-001-sdk-only-http-client.md),
[`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md).

- **Decision:** The SDK exposes three verbs over the account-stored BYOLLM
  lane (`POST/GET/DELETE /v1/keys/byollm`, `SK-PREMIUM-012`):
  `setByollm({ provider, model, key })` upserts the single per-account
  credential; `getByollmStatus()` returns
  `{ configured: false } | { configured: true; credential: { provider, model, last4, updatedAt } }`;
  `clearByollm()` hard-clears it (`{ ok: true; cleared }`). The credential
  reuses the `ByollmCredential` input type; the key is write-only — no verb
  returns it (`last4` is the only display field, `SK-APIKEYS-002`). All
  three are signed-in only and throw at call time unless the client was
  built with `withCredentials: true`. `setByollm` validates non-empty parts
  before the request (the colon / control-char guards `SK-SDK-010`'s header
  lane needs don't apply — these travel as JSON fields).
- **Core value:** Effortless UX, Bullet-proof, Free
- **Why:** `SK-SDK-010` covers the *per-request* lane (a key on every
  `ask()`); the account-stored lane (the persistent credential the web
  `/app/keys` UI and the API already expose) had no SDK verb — the
  `GLOBAL-003` gap tracked in `premium-tier/FEATURE.md`. Without it the SDK
  can't store or revoke a BYOLLM key, so an SDK-only integrator is forced to
  hand-roll fetch against `/v1/keys/byollm`, defeating `GLOBAL-001` (the SDK
  is the only HTTP client). The call-time session guard mirrors
  `SK-SDK-010`'s construction guard: fail loud (`GLOBAL-012`) rather than let
  the API 401 a bearer call.
- **Consequence in code:** `packages/sdk/src/index.ts` exports
  `ByollmStoredCredential`, `ByollmStatusResponse`, `ByollmSetResult`,
  `ClearByollmResult`; adds the three methods to `NlqClient` and the returned
  client; `assertSession()` enforces `withCredentials`. `SK-SDK-006`
  auto-`Idempotency-Key` and `SK-SDK-008` wire-retry apply to the POST/DELETE
  mutations. Tests assert the wire method/URL/credentials, the empty +
  configured status shapes, the idempotency header, the session-guard throws,
  the empty-part throw, and a `503 byollm_unavailable` surfacing as
  `NlqdbApiError`.
- **Alternatives rejected:**
  - Fold the stored lane into the `byollm` option — conflates a persistent
    credential (set once, server-sealed) with a per-call routing hint; the
    two lanes have different lifecycles and `SK-PREMIUM-012` already
    separates them server-side.
  - Return the stored key from `getByollmStatus()` — breaks `SK-APIKEYS-002`
    (no plaintext retrieval); `last4` is the only honest display field.
  - Skip the call-time session guard and let the API 401 — worse DX than a
    one-sentence local throw, and `SK-SDK-010` already set the fail-loud
    precedent.
- **Source:** canonical here · `SK-PREMIUM-012` (account-stored storage +
  routes) · `SK-SDK-010` (per-request lane) · `GLOBAL-001` / `GLOBAL-003`.
