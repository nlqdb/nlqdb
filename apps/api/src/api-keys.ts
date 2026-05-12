// pk_live_ key minting and lookup (SK-APIKEYS-001, SK-APIKEYS-008).
//
// Phase 1 ships pk_live_ only (per-DB, read-only, used by <nlq-data>).
// sk_live_ and sk_mcp_ ship in Phase 2 alongside the dashboard key-
// management UI and the CLI/MCP install flow.
//
// Hashing: HMAC-SHA256(BETTER_AUTH_SECRET, plaintext_key) per SK-APIKEYS-008.
// Argon2id is unavailable in the CF Workers runtime; for random 128-bit keys
// HMAC-SHA256 is computationally equivalent. See SK-APIKEYS-008 for full rationale.
//
// Security posture:
//   - plaintext_key is returned ONCE at mint time and never stored
//   - key_hash is the only persistent form; lookup is constant-time at the hash layer
//   - last_4 chars stored for dashboard display only (SK-APIKEYS-002)

export const PK_LIVE_PREFIX = "pk_live_";

// Mints a new pk_live_ key, stores the hash in D1, and returns the plaintext.
// The caller is responsible for returning it to the user exactly once.
// Throws on D1 write failure — callers should catch and surface as a mint_failed
// envelope rather than letting it propagate as a 500 on the create path.
export async function mintPkLiveKey(
  d1: D1Database,
  secret: string,
  dbId: string,
  tenantId: string,
): Promise<string> {
  // 128 bits of CSPRNG randomness encoded as 32 lowercase hex chars.
  const tail = randomHex(16);
  const plaintext = `${PK_LIVE_PREFIX}${tail}`;
  const hash = await hmacHex(secret, plaintext);
  const id = crypto.randomUUID();
  await d1
    .prepare(
      "INSERT INTO api_keys (id, tenant_id, db_id, key_type, key_hash, last_4) " +
        "VALUES (?, ?, ?, 'pk_live', ?, ?)",
    )
    .bind(id, tenantId, dbId, hash, plaintext.slice(-4))
    .run();
  return plaintext;
}

// Looks up a pk_live_ key by its plaintext value.
// Returns null when the key doesn't exist or the prefix is wrong.
// Constant-time at the hash level — the D1 `WHERE key_hash = ?` lookup
// does an index scan, not a full table scan, so timing doesn't leak row count.
export async function lookupPkLiveKey(
  d1: D1Database,
  secret: string,
  key: string,
): Promise<{ dbId: string; tenantId: string } | null> {
  if (!key.startsWith(PK_LIVE_PREFIX)) return null;
  const hash = await hmacHex(secret, key);
  const row = await d1
    .prepare("SELECT db_id, tenant_id FROM api_keys WHERE key_hash = ? AND key_type = 'pk_live'")
    .bind(hash)
    .first<{ db_id: string; tenant_id: string }>();
  if (!row) return null;
  return { dbId: row.db_id, tenantId: row.tenant_id };
}

// On anon-DB adoption (SK-ANON-003), re-keys every pk_live_ row for the
// anonymous tenant to the newly-signed-in user so the key keeps working
// post sign-in. Idempotent: the WHERE clause is a no-op on a replay.
export async function adoptApiKeys(
  d1: D1Database,
  anonTenantId: string,
  userId: string,
): Promise<void> {
  await d1
    .prepare("UPDATE api_keys SET tenant_id = ? WHERE tenant_id = ?")
    .bind(userId, anonTenantId)
    .run();
}

// ─── crypto helpers ──────────────────────────────────────────────────────────

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
