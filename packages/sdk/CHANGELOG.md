# @nlqdb/sdk

## 0.2.0

### Minor Changes

- 16e356d: Add account-stored BYOLLM credential verbs (`SK-SDK-011`): `setByollm`,
  `getByollmStatus`, and `clearByollm` wrap `POST/GET/DELETE
/v1/keys/byollm`. They persist one provider key per account (sealed at
  rest, `GLOBAL-031`) so every later session dispatches through it without
  re-sending the key — the persistent counterpart to the per-request
  `byollm` option. Signed-in only: the verbs throw unless the client was
  built with `withCredentials: true`, and the stored key is write-only
  (`last4` is the sole display field, never the key).

## 0.1.0

### Minor Changes

- bc48b58: Initial publish of `@nlqdb/sdk` to npm. Typed HTTP client for the
  nlqdb `/v1` API — zero runtime deps, runtime-agnostic (browsers,
  Node ≥ 18, Bun, Cloudflare Workers), per-method `AbortSignal`,
  auto-`Idempotency-Key` on retried mutations, OIDC trusted-publishing
  provenance.
