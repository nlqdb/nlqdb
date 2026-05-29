// BYOLLM key storage and retrieval (SK-PREMIUM-008).
//
// Keys are stored AES-GCM encrypted at rest using a KEK from Workers Secret
// (BYOLLM_KEK, or BETTER_AUTH_SECRET with a domain prefix as fallback for dev).
// At most one active key per (tenant, provider) — storing a new key for the
// same provider revokes the prior one so the table stays clean.
//
// Encryption: SHA-256(KEK) → 256-bit AES-GCM key. IV is random 12 bytes,
// stored prepended to the ciphertext as base64(IV ‖ ciphertext).

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

// Stores a BYOLLM key, revoking any prior active key for the same provider.
// Returns the new row id.
export async function storeBYOLLMKey(
  d1: D1Database,
  kek: string,
  tenantId: string,
  provider: BYOLLMProvider,
  plaintextKey: string,
): Promise<{ id: string }> {
  const encrypted = await encryptKey(kek, plaintextKey);
  const last4 = plaintextKey.slice(-4);
  const id = crypto.randomUUID();

  // Revoke any prior active key for this provider before insert so the
  // unique-active invariant holds. Single D1 transaction via batch.
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
export async function revokeBYOLLMKey(
  d1: D1Database,
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
  if (upd.meta.changes === 1) return "revoked";
  const row = await d1
    .prepare("SELECT 1 AS hit FROM byollm_keys WHERE id = ? AND tenant_id = ?")
    .bind(keyId, tenantId)
    .first<{ hit: number }>();
  return row ? "already_revoked" : "not_found";
}

// Resolves the active BYOLLM key for a tenant and decrypts it.
// Returns null when no active key is stored (falls through to free chain).
// `provider` is optional — when set, returns only that provider's key.
// Without `provider`, returns the first active key (alphabetical by provider).
export async function resolveBYOLLMKey(
  d1: D1Database,
  kek: string,
  tenantId: string,
  provider?: BYOLLMProvider,
): Promise<{ llmProvider: BYOLLMProvider; plaintextKey: string } | null> {
  const query = provider
    ? "SELECT llm_provider, encrypted_key FROM byollm_keys " +
      "WHERE tenant_id = ? AND llm_provider = ? AND revoked_at IS NULL LIMIT 1"
    : "SELECT llm_provider, encrypted_key FROM byollm_keys " +
      "WHERE tenant_id = ? AND revoked_at IS NULL ORDER BY llm_provider LIMIT 1";

  const row = provider
    ? await d1
        .prepare(query)
        .bind(tenantId, provider)
        .first<{ llm_provider: BYOLLMProvider; encrypted_key: string }>()
    : await d1
        .prepare(query)
        .bind(tenantId)
        .first<{ llm_provider: BYOLLMProvider; encrypted_key: string }>();

  if (!row) return null;

  const plaintextKey = await decryptKey(kek, row.encrypted_key);
  return { llmProvider: row.llm_provider, plaintextKey };
}

// ─── AES-GCM crypto ─────────────────────────────────────────────────────────

// Domain-separate the KEK from other secrets that may share the same
// underlying string (e.g. BETTER_AUTH_SECRET fallback in dev).
async function deriveAesKey(kek: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`nlqdb.byollm.kek:${kek}`),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
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
