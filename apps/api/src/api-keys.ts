// API-key minting and lookup for all three types in `SK-APIKEYS-001`:
//
//   - `pk_live_` — per-DB read-only embed key (Phase 1, used by
//     `<nlq-data>`). Minted as a side-effect of `db.create`.
//   - `sk_live_` — account-scoped backend key (Phase 2 Slice 1 of
//     `SK-MCP-010`, used by CI / Docker / `NLQDB_API_KEY` / the HTTP API).
//   - `sk_mcp_<host>_<device>_` — like `sk_live_` but tagged with the
//     `(mcp_host, device_id)` claims from `SK-APIKEYS-004`. One key per
//     MCP host per device; SK-APIKEYS-006 calls for "sign out
//     everywhere" to revoke only this type (the helper lands with
//     the dashboard slice — see api-keys/FEATURE.md Open questions).
//
// Hashing: HMAC-SHA256(BETTER_AUTH_SECRET, plaintext_key) per
// SK-APIKEYS-008. Argon2id is unavailable in the CF Workers runtime;
// for random 128-bit keys HMAC-SHA256 is computationally equivalent.
// See SK-APIKEYS-008 for the full rationale.
//
// Security posture (every key type):
//   - plaintext_key is returned ONCE at mint time and never stored
//   - key_hash is the only persistent form; lookup is constant-time at
//     the hash layer (D1 `WHERE key_hash = ?` is an index hit)
//   - last_4 chars stored for dashboard display only (SK-APIKEYS-002)

export const PK_LIVE_PREFIX = "pk_live_";
export const SK_LIVE_PREFIX = "sk_live_";
export const SK_MCP_PREFIX = "sk_mcp_";

export type SkKeyLookup =
  | { kind: "sk_live"; tenantId: string; keyId: string }
  | { kind: "sk_mcp"; tenantId: string; keyId: string; mcpHost: string; deviceId: string };

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
  const plaintext = `${PK_LIVE_PREFIX}${randomHex(16)}`;
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
// Returns null when the key doesn't exist, the prefix is wrong, or the
// row is revoked (SK-MCP-014). Constant-time at the hash level — the D1
// `WHERE key_hash = ?` lookup does an index scan, not a full table scan,
// so timing doesn't leak row count.
export async function lookupPkLiveKey(
  d1: D1Database,
  secret: string,
  key: string,
): Promise<{ dbId: string; tenantId: string } | null> {
  if (!key.startsWith(PK_LIVE_PREFIX)) return null;
  const hash = await hmacHex(secret, key);
  const row = await d1
    .prepare(
      "SELECT db_id, tenant_id FROM api_keys " +
        "WHERE key_hash = ? AND key_type = 'pk_live' AND revoked_at IS NULL",
    )
    .bind(hash)
    .first<{ db_id: string; tenant_id: string }>();
  if (!row) return null;
  return { dbId: row.db_id, tenantId: row.tenant_id };
}

// ─── sk_live_ ────────────────────────────────────────────────────────────────

// Mints a new sk_live_ key. Per SK-APIKEYS-001 these are account-scoped
// (no db_id) full-scope backend secrets. `name` is the optional
// human label rendered in the dashboard ("CI on GitHub Actions").
export async function mintSkLiveKey(
  d1: D1Database,
  secret: string,
  tenantId: string,
  name: string | null,
): Promise<{ id: string; plaintext: string }> {
  const plaintext = `${SK_LIVE_PREFIX}${randomHex(16)}`;
  const hash = await hmacHex(secret, plaintext);
  const id = crypto.randomUUID();
  await d1
    .prepare(
      "INSERT INTO api_keys (id, tenant_id, db_id, key_type, key_hash, last_4, name) " +
        "VALUES (?, ?, NULL, 'sk_live', ?, ?, ?)",
    )
    .bind(id, tenantId, hash, plaintext.slice(-4), name)
    .run();
  return { id, plaintext };
}

// ─── sk_mcp_ ─────────────────────────────────────────────────────────────────

// Mints a new sk_mcp_<host>_<device>_ key. Per SK-APIKEYS-004 these
// carry `(mcp_host, device_id)` claims so the dashboard can show "Cursor
// on macbook-air ran 14 queries today" and revocation is precise.
//
// The on-the-wire shape includes the host/device for human readability
// in shell history / config files; the claims also live in their own
// columns so lookup never needs to parse the token.
export async function mintSkMcpKey(
  d1: D1Database,
  secret: string,
  tenantId: string,
  mcpHost: string,
  deviceId: string,
): Promise<{ id: string; plaintext: string }> {
  const plaintext = `${SK_MCP_PREFIX}${normaliseSlug(mcpHost)}_${normaliseSlug(deviceId)}_${randomHex(16)}`;
  const hash = await hmacHex(secret, plaintext);
  const id = crypto.randomUUID();
  await d1
    .prepare(
      "INSERT INTO api_keys (id, tenant_id, db_id, key_type, key_hash, last_4, mcp_host, device_id) " +
        "VALUES (?, ?, NULL, 'sk_mcp', ?, ?, ?, ?)",
    )
    .bind(id, tenantId, hash, plaintext.slice(-4), mcpHost, deviceId)
    .run();
  return { id, plaintext };
}

// ─── lookup (sk_live + sk_mcp) ───────────────────────────────────────────────

// Resolves a `Bearer sk_*` token to its tenant + claims. Returns null
// on prefix mismatch, unknown key, or revoked row (a future revoke flag
// will join on this same query). One call covers both sk_live_ and
// sk_mcp_ since the dispatch is on the stored `key_type`, not on the
// caller's parsing of the prefix — that keeps the principal middleware
// off the hot path of two separate queries.
export async function lookupSkKey(
  d1: D1Database,
  secret: string,
  key: string,
): Promise<SkKeyLookup | null> {
  if (!key.startsWith(SK_LIVE_PREFIX) && !key.startsWith(SK_MCP_PREFIX)) return null;
  const hash = await hmacHex(secret, key);
  // `revoked_at IS NULL` filter implements SK-MCP-009's revocation
  // contract at the source: any 1 s isolate cache / DO revalidator
  // built atop this query inherits the filter for free.
  const row = await d1
    .prepare(
      "SELECT id, tenant_id, key_type, mcp_host, device_id FROM api_keys " +
        "WHERE key_hash = ? AND key_type IN ('sk_live', 'sk_mcp') AND revoked_at IS NULL",
    )
    .bind(hash)
    .first<{
      id: string;
      tenant_id: string;
      key_type: "sk_live" | "sk_mcp";
      mcp_host: string | null;
      device_id: string | null;
    }>();
  if (!row) return null;
  if (row.key_type === "sk_live") {
    return { kind: "sk_live", tenantId: row.tenant_id, keyId: row.id };
  }
  // SK-APIKEYS-004 requires both claims on sk_mcp rows; a mis-migrated
  // row missing either is rejected (better than auth'ing a malformed key).
  if (!row.mcp_host || !row.device_id) return null;
  return {
    kind: "sk_mcp",
    tenantId: row.tenant_id,
    keyId: row.id,
    mcpHost: row.mcp_host,
    deviceId: row.device_id,
  };
}

// ─── key status (SK-MCP-014 hot-path revalidation) ─────────────────────────

// Returns the revocation state for a key identified by its HMAC hash.
// Used by `apps/mcp/`'s `McpAgent` Durable Object: the DO caches the
// resolved key + claims for 1 s and re-probes this endpoint on every
// tool call past the TTL. Returning `null` (unknown hash) and
// `{ revoked: true }` (known but revoked) are distinct: the DO drops
// its cache + closes the session on the latter and surfaces an
// `SK-MCP-006` error envelope. Caller passes the HMAC, never the
// plaintext — keeps key material out of cross-Worker URLs.
export async function getKeyStatusByHash(
  d1: D1Database,
  keyHash: string,
): Promise<{ revoked: boolean; revokedAt: number | null } | null> {
  const row = await d1
    .prepare(
      "SELECT revoked_at FROM api_keys WHERE key_hash = ? AND key_type IN ('sk_live', 'sk_mcp')",
    )
    .bind(keyHash)
    .first<{ revoked_at: number | null }>();
  if (!row) return null;
  return { revoked: row.revoked_at !== null, revokedAt: row.revoked_at };
}

// Throttled to one write per minute per key — `last_used_at` is a
// dashboard display field, not an audit trail, so a hot client running
// 100 req/s shouldn't generate 100 writes/s on a shared row. The WHERE
// clause keeps the write a no-op when we bumped recently, so the
// throttle is enforced in SQLite (single round-trip, no isolate state).
// Errors are swallowed: a failed bump must not surface as a `waitUntil`
// uncaught rejection in the runtime log, and the key is already valid.
const LAST_USED_BUMP_THROTTLE_SECONDS = 60;

export async function bumpKeyLastUsed(d1: D1Database, keyId: string): Promise<void> {
  try {
    await d1
      .prepare(
        "UPDATE api_keys SET last_used_at = unixepoch() " +
          "WHERE id = ? AND (last_used_at IS NULL OR last_used_at < unixepoch() - ?)",
      )
      .bind(keyId, LAST_USED_BUMP_THROTTLE_SECONDS)
      .run();
  } catch {
    // Intentionally silent — see block comment above.
  }
}

// ─── adoption + global signout ───────────────────────────────────────────────

// On anon-DB adoption (SK-ANON-003), re-keys every pk_live_ row for the
// anonymous tenant to the newly-signed-in user so the key keeps working
// post sign-in. Idempotent: the WHERE clause is a no-op on a replay.
//
// Only pk_live_ rows exist on anon tenants (anon users can't mint sk_*
// keys), so the WHERE filter is implicit — an anon tenant never has a
// row with key_type IN ('sk_live', 'sk_mcp') to re-key.
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

// HMAC-SHA256 hex. Exported so external callers (e.g. the OAuth bridge
// mint path) can hash plaintext keys for `getKeyStatusByHash` probes
// without re-implementing the primitive.
export async function hmacHex(secret: string, message: string): Promise<string> {
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

// Strips characters that would collide with `_`, the token's field
// separator, so `sk_mcp_<host>_<device>_…` stays parseable when read
// out of shell history or a host's config file.
function normaliseSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}
