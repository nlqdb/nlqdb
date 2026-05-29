// BYOLLM key storage and retrieval (SK-PREMIUM-008).
//
// Keys are stored AES-GCM encrypted at rest using a KEK from Workers Secret
// (BYOLLM_KEK, or BETTER_AUTH_SECRET with a domain prefix as fallback for dev).
// At most one active key per (tenant, provider) — enforced by UNIQUE partial
// index on (tenant_id, llm_provider) WHERE revoked_at IS NULL.
//
// Encryption: HKDF-SHA-256(KEK) → 256-bit AES-GCM key. IV is random 12 bytes,
// stored prepended to the ciphertext as base64(IV ‖ ciphertext).
//
// Caching: KV stores a "has active key?" TTL-60s boolean per tenant so every
// /v1/ask for tenants without BYOLLM configured avoids a D1 round-trip.

export type BYOLLMProvider = "anthropic" | "openai" | "gemini" | "openrouter";

export const BYOLLM_PROVIDERS: readonly BYOLLMProvider[] = [
  "anthropic",
  "openai",
  "gemini",
  "openrouter",
];

export function isBYOLLMProvider(value: string): value is BYOLLMProvider {
  return (BYOLLM_PROVIDERS as readonly string[]).includes(value);
}

export type BYOLLMKeyRecord = {
  id: string;
  llmProvider: BYOLLMProvider;
  last4: string;
  createdAt: number;
  revokedAt: number | null;
};

const KV_PREFIX = "byollm:tenant:";
const KV_TTL = 60; // seconds

// Stores a BYOLLM key, revoking any prior active key for the same provider.
// Invalidates the KV "has active key?" cache so the next ask picks up the change.
export async function storeBYOLLMKey(
  d1: D1Database,
  kv: KVNamespace,
  kek: string,
  tenantId: string,
  provider: BYOLLMProvider,
  plaintextKey: string,
): Promise<{ id: string }> {
  const encrypted = await encryptKey(kek, plaintextKey);
  const last4 = plaintextKey.slice(-4);
  const id = crypto.randomUUID();

  // D1 batch is wrapped in an implicit transaction — if the INSERT fails
  // (e.g. UNIQUE violation from a concurrent request), the revoke also rolls back.
  await d1.batch([
    d1
      .prepare(
        "UPDATE byollm_keys SET revoked_at = unixepoch() " +
          "WHERE tenant_id = ? AND llm_provider = ? AND revoked_at IS NULL",
      )
      .bind(tenantId, provider),
    d1
      .prepare(
        "INSERT INTO byollm_keys (id, tenant_id, llm_provider, encrypted_key, last_4) " +
          "VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, tenantId, provider, encrypted, last4),
  ]);

  // Invalidate so next ask doesn't serve a stale negative cache hit.
  await kv.delete(`${KV_PREFIX}${tenantId}`).catch(() => null);
  return { id };
}

// Returns all keys for a tenant (active + revoked), newest first.
export async function listBYOLLMKeys(
  d1: D1Database,
  tenantId: string,
): Promise<BYOLLMKeyRecord[]> {
  const res = await d1
    .prepare(
      "SELECT id, llm_provider, last_4, created_at, revoked_at FROM byollm_keys " +
        "WHERE tenant_id = ? ORDER BY (revoked_at IS NOT NULL), created_at DESC",
    )
    .bind(tenantId)
    .all<{
      id: string;
      llm_provider: BYOLLMProvider;
      last_4: string;
      created_at: number;
      revoked_at: number | null;
    }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    llmProvider: r.llm_provider,
    last4: r.last_4,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

export type RevokeOutcome = "revoked" | "already_revoked" | "not_found";

// Hard-revokes a key by id, tenant-scoped. Idempotent.
// Invalidates the KV cache so the next ask uses the free chain.
export async function revokeBYOLLMKey(
  d1: D1Database,
  kv: KVNamespace,
  tenantId: string,
  keyId: string,
): Promise<RevokeOutcome> {
  const upd = await d1
    .prepare(
      "UPDATE byollm_keys SET revoked_at = unixepoch() " +
        "WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL",
    )
    .bind(keyId, tenantId)
    .run();
  if (upd.meta.changes === 1) {
    await kv.delete(`${KV_PREFIX}${tenantId}`).catch(() => null);
    return "revoked";
  }
  const row = await d1
    .prepare("SELECT 1 AS hit FROM byollm_keys WHERE id = ? AND tenant_id = ?")
    .bind(keyId, tenantId)
    .first<{ hit: number }>();
  return row ? "already_revoked" : "not_found";
}

// Resolves the active BYOLLM key for a tenant and decrypts it.
// Uses a KV cache (TTL 60s) to avoid a D1 round-trip when the common case is
// "no key configured". Throws BYOLLMDecryptError when a row exists but the KEK
// can't decrypt it — caller must surface this as a fail-loud error per
// SK-PREMIUM-008 point 6 (never silent fallback on key errors).
// Returns null only when no active row exists.
export class BYOLLMDecryptError extends Error {
  constructor(tenantId: string) {
    super(`BYOLLM key decryption failed for tenant ${tenantId} — check BYOLLM_KEK`);
    this.name = "BYOLLMDecryptError";
  }
}

export async function resolveBYOLLMKey(
  d1: D1Database,
  kv: KVNamespace,
  kek: string,
  tenantId: string,
  provider?: BYOLLMProvider,
): Promise<{ llmProvider: BYOLLMProvider; plaintextKey: string } | null> {
  // Fast path: KV negative cache — skip D1 when we know the tenant has no key.
  // Only used when no specific provider is requested (the common dispatch path).
  if (!provider) {
    const cached = await kv.get(`${KV_PREFIX}${tenantId}`).catch(() => undefined);
    if (cached === "0") return null;
  }

  const row = provider
    ? await d1
        .prepare(
          "SELECT llm_provider, encrypted_key FROM byollm_keys " +
            "WHERE tenant_id = ? AND llm_provider = ? AND revoked_at IS NULL LIMIT 1",
        )
        .bind(tenantId, provider)
        .first<{ llm_provider: BYOLLMProvider; encrypted_key: string }>()
    : await d1
        .prepare(
          "SELECT llm_provider, encrypted_key FROM byollm_keys " +
            "WHERE tenant_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
        )
        .bind(tenantId)
        .first<{ llm_provider: BYOLLMProvider; encrypted_key: string }>();

  if (!row) {
    // Cache the negative result — common case for tenants who haven't stored a key.
    if (!provider) {
      await kv
        .put(`${KV_PREFIX}${tenantId}`, "0", { expirationTtl: KV_TTL })
        .catch(() => null);
    }
    return null;
  }

  // Decryption failure = KEK mismatch → throw so the caller can fail loud
  // (not silently route to the free chain — that's the dark pattern).
  let plaintextKey: string;
  try {
    plaintextKey = await decryptKey(kek, row.encrypted_key);
  } catch {
    throw new BYOLLMDecryptError(tenantId);
  }
  return { llmProvider: row.llm_provider, plaintextKey };
}

// ─── AES-GCM crypto with HKDF key derivation ────────────────────────────────

// HKDF-SHA-256 is the RFC 9709 standard for deriving an AES-GCM key from a
// secret. Proper extract-and-expand with a fixed info label gives stronger
// domain separation than raw SHA-256.
async function deriveAesKey(kek: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(kek),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32), // zero salt — KEK is already high-entropy
      info: new TextEncoder().encode("nlqdb.byollm.aes-gcm-key"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptKey(kek: string, plaintext: string): Promise<string> {
  const key = await deriveAesKey(kek);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return btoa(String.fromCharCode(...combined));
}

async function decryptKey(kek: string, encoded: string): Promise<string> {
  const key = await deriveAesKey(kek);
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
