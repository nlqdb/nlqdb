// GLOBAL-005 — KV idempotency dedupe for resource-minting endpoints
// (`byo_connect`, `keys_mint`, `grants_mint`, `pack_*`, `supabase_select`, …).
// Shared so every mutating handler replays a prior success under the same
// `(scope, tenant, key)` instead of minting a second resource. 24h TTL
// (SK-IDEMP-008). The stored body must be redacted of any one-time secret
// (SK-APIKEYS-013) — the plaintext key is returned on the first response only.
//
// KV (not D1 ON CONFLICT, SK-IDEMP-005) is a deliberate match to the existing
// connect/mint endpoints: it replays retries and sequential double-submits.
// Two genuinely-concurrent requests can still both miss the lookup; that window
// is the same accepted bound as `POST /v1/db/connect`.

export async function idempotencyLookup(
  kv: KVNamespace,
  scope: string,
  tenantId: string,
  key: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!key) return null;
  return (await kv.get(`${scope}:${tenantId}:${key}`, "json")) as Record<string, unknown> | null;
}

export function idempotencyStore(
  ctx: Pick<ExecutionContext, "waitUntil">,
  kv: KVNamespace,
  scope: string,
  tenantId: string,
  key: string | undefined,
  body: Record<string, unknown>,
): void {
  if (!key) return;
  // Fire-and-forget: a KV write failure must not fail an already-committed
  // mint/provision.
  ctx.waitUntil(
    kv
      .put(`${scope}:${tenantId}:${key}`, JSON.stringify(body), { expirationTtl: 86_400 })
      .catch(() => {}),
  );
}
