// API-key minting and lookup for all three types in `SK-APIKEYS-001`:
//
//   - `pk_live_` — per-DB read-only embed key (Phase 1, used by
//     `<nlq-data>`). Minted as a side-effect of `db.create`.
//   - `sk_live_` — account-scoped backend key (Phase 2 Slice 1 of
//     `SK-MCP-010`, used by CI / Docker / `NLQDB_API_KEY` / the HTTP API).
//     `sk_live_` is the widest key: it is the only one that may connect a
//     BYO database (`canConnectDatabase` in `principal.ts`).
//   - `sk_mcp_<host>_<device>_` — a strict subset of `sk_live_` tagged with
//     the `(mcp_host, device_id)` claims from `SK-APIKEYS-004`. One key per
//     MCP host per device, and the credential every headless MCP path
//     hands out (`SK-APIKEYS-015`). Revoked only by an explicit
//     `DELETE /v1/keys/:id` — no key type is swept by global sign-out.
//
// Hashing: HMAC-SHA256(apiKeyHmacSecret(env), plaintext_key) per
// SK-APIKEYS-008. The secret is the dedicated `API_KEY_SECRET` when set,
// else `BETTER_AUTH_SECRET` (SK-APIKEYS-014). Argon2id is unavailable in
// the CF Workers runtime; for random 128-bit keys HMAC-SHA256 is
// computationally equivalent. See SK-APIKEYS-008 for the full rationale.
//
// Security posture (every key type):
//   - plaintext_key is returned ONCE at mint time and never stored
//   - key_hash is the only persistent form; lookup is constant-time at
//     the hash layer (D1 `WHERE key_hash = ?` is an index hit)
//   - last_4 chars stored for dashboard display only (SK-APIKEYS-002)

import { isModelPreset, type ModelPreset } from "@nlqdb/llm";

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

// ─── tenant-scoped list + revoke (SK-APIKEYS-010 / SK-APIKEYS-011) ──────────

// Subset of `api_keys` columns surfaced to dashboards / `nlq keys list`.
// `keyType: "pk_live"` carries `dbId`; `"sk_mcp"` carries `(host, device)`;
// `"sk_live"` carries neither and an optional human label. `revokedAt`
// is non-null on revoked rows — the list returns active + revoked so
// surfaces can group "active" and "revoked" without a second round-trip.
export type KeyRecord = {
  id: string;
  keyType: "pk_live" | "sk_live" | "sk_mcp";
  last4: string;
  name: string | null;
  dbId: string | null;
  mcpHost: string | null;
  deviceId: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  revokedAt: number | null;
  // SK-PREMIUM-019 — per-key default `/v1/ask` model preset ("fast" | "best";
  // null = no per-key default). Only meaningful on `sk_live` / `sk_mcp` rows —
  // those are the only kinds whose `/v1/ask` calls resolve a key id (the
  // dashboard renders the picker for them alone).
  defaultModel: ModelPreset | null;
};

// Returns every key row for the tenant, newest first. Active rows
// before revoked so surfaces can render "active" + "revoked" sections
// with a single contiguous slice. Bounded by per-tenant key count
// (<50 typical; pagination upgrade trigger documented in
// `docs/features/api-keys/FEATURE.md`).
export async function listKeysByTenant(d1: D1Database, tenantId: string): Promise<KeyRecord[]> {
  const res = await d1
    .prepare(
      // `scope = "byollm"` rows are managed via `/v1/keys/byollm`, not the
      // bearer-key list — excluded so a provider key's last-4 never shows
      // up among the minted `pk_*`/`sk_*` keys (SK-PREMIUM-012).
      "SELECT id, key_type, last_4, name, db_id, mcp_host, device_id, " +
        "last_used_at, created_at, revoked_at, default_model FROM api_keys " +
        "WHERE tenant_id = ? AND key_type != 'byollm' " +
        "ORDER BY (revoked_at IS NOT NULL), created_at DESC",
    )
    .bind(tenantId)
    .all<{
      id: string;
      key_type: "pk_live" | "sk_live" | "sk_mcp";
      last_4: string;
      name: string | null;
      db_id: string | null;
      mcp_host: string | null;
      device_id: string | null;
      last_used_at: number | null;
      created_at: number;
      revoked_at: number | null;
      default_model: string | null;
    }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    keyType: r.key_type,
    last4: r.last_4,
    name: r.name,
    dbId: r.db_id,
    mcpHost: r.mcp_host,
    deviceId: r.device_id,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
    // Defensive coerce: a value outside the preset domain (a stale row) reads
    // as "no default" rather than leaking a garbage preset to the surface.
    defaultModel: isModelPreset(r.default_model) ? r.default_model : null,
  }));
}

// Active (non-revoked) count of the two `POST /v1/keys`-mintable key types
// for a tenant. Backs the per-account mint cap. Scoped to `sk_live` + `sk_mcp`
// because those are the only kinds this endpoint creates: `pk_live` is a
// side-effect of `db.create` (its own provisioning limits) and `byollm` is a
// stored credential, not a bearer key. The mint endpoint is authenticated and
// self-scoped, so this caps a tenant over-allocating its OWN keys (abuse via
// throwaway accounts, D1 bloat, revocation surface) — not a cross-tenant path.
export async function countActiveMintableKeys(d1: D1Database, tenantId: string): Promise<number> {
  const row = await d1
    .prepare(
      "SELECT COUNT(*) AS n FROM api_keys " +
        "WHERE tenant_id = ? AND key_type IN ('sk_live', 'sk_mcp') AND revoked_at IS NULL",
    )
    .bind(tenantId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export type RevokeOutcome = "revoked" | "already_revoked" | "not_found";

// Hard-revokes a key by id, tenant-scoped. Sets `revoked_at = unixepoch()`
// when the row is active; returns `"already_revoked"` when the row
// existed but was already revoked (idempotent re-DELETE per RFC 9110);
// returns `"not_found"` when the id is unknown or belongs to another
// tenant — the latter intentionally indistinguishable so a leaked id
// doesn't leak existence across tenants. Propagation to the MCP DO
// is ≤ 1 s via SK-MCP-014's revalidation probe.
//
// Race-safe: a single conditional UPDATE wins-or-no-ops atomically.
// `meta.changes === 1` means *this* call did the revoke; `=== 0`
// disambiguates "already revoked" (row exists, `revoked_at` set) from
// "not found" (row missing or other tenant) via one follow-up SELECT.
export async function revokeKeyById(
  d1: D1Database,
  tenantId: string,
  keyId: string,
): Promise<RevokeOutcome> {
  // `key_type != 'byollm'` keeps this bearer-key revoke surface from ever
  // touching a stored BYOLLM credential (those are managed via
  // `DELETE /v1/keys/byollm`); defense-in-depth, not just id non-disclosure.
  const upd = await d1
    .prepare(
      "UPDATE api_keys SET revoked_at = unixepoch() " +
        "WHERE id = ? AND tenant_id = ? AND key_type != 'byollm' AND revoked_at IS NULL",
    )
    .bind(keyId, tenantId)
    .run();
  if (upd.meta.changes === 1) return "revoked";
  const row = await d1
    .prepare(
      "SELECT 1 AS hit FROM api_keys WHERE id = ? AND tenant_id = ? AND key_type != 'byollm'",
    )
    .bind(keyId, tenantId)
    .first<{ hit: number }>();
  return row ? "already_revoked" : "not_found";
}

// ─── per-key default model (SK-PREMIUM-019) ──────────────────────────────────

// Precedence resolver for the `/v1/ask` `model` preset: an explicit request
// `model` always wins; otherwise the key's stored `default_model` applies;
// otherwise `undefined` (the caller then falls to the server default —
// hosted-premium if eligible, else the free chain). Pure so `/v1/ask` calls it
// directly and the rule is unit-tested in one place. `"auto"` is never stored
// (normalised to null on write), so a returned value is `"fast" | "best"` in
// practice, but the type stays the full `ModelPreset` for forward-compat.
export function resolveEffectiveModelPreset(
  requestModel: ModelPreset | undefined,
  keyDefaultModel: ModelPreset | null,
): ModelPreset | undefined {
  if (requestModel !== undefined) return requestModel;
  return keyDefaultModel ?? undefined;
}

// Reads a bearer key's stored `default_model` by id (the id the principal
// already resolved, so this is a single indexed lookup). Returns null for an
// unknown id, a NULL column, or a value outside the preset domain (defensive
// against a stale row). Called on the `/v1/ask` no-`model` path only.
export async function getKeyDefaultModel(
  d1: D1Database,
  keyId: string,
): Promise<ModelPreset | null> {
  const row = await d1
    .prepare("SELECT default_model FROM api_keys WHERE id = ?")
    .bind(keyId)
    .first<{ default_model: string | null }>();
  if (!row) return null;
  return isModelPreset(row.default_model) ? row.default_model : null;
}

export type SetDefaultModelOutcome = "updated" | "not_found";

// Sets (or clears, on `null`) a bearer key's `default_model`, tenant-scoped.
// Backs `POST /v1/keys/:id/default-model`. Only `sk_live` / `sk_mcp` rows carry
// a resolvable key id on the `/v1/ask` path, so the write is restricted to
// them — a `pk_live` (read-only) or `byollm` (credential) row would store an
// inert value and confuse the picker. Idempotent by construction: re-applying
// the same value matches the same row and re-writes it, so an `Idempotency-Key`
// retry (GLOBAL-005) observes the same `"updated"` outcome without a dedupe store.
export async function setKeyDefaultModel(
  d1: D1Database,
  tenantId: string,
  keyId: string,
  defaultModel: ModelPreset | null,
): Promise<SetDefaultModelOutcome> {
  const upd = await d1
    .prepare(
      "UPDATE api_keys SET default_model = ? " +
        "WHERE id = ? AND tenant_id = ? AND key_type IN ('sk_live', 'sk_mcp')",
    )
    .bind(defaultModel, keyId, tenantId)
    .run();
  return upd.meta.changes === 1 ? "updated" : "not_found";
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
// keys). The `AND key_type = 'pk_live'` filter makes that assumption
// explicit and defensive: if an sk_live/sk_mcp row ever landed on an anon
// tenant (a bug, or a future code path), adoption must not silently
// re-key an account-scoped secret onto the signing-in user.
export async function adoptApiKeys(
  d1: D1Database,
  anonTenantId: string,
  userId: string,
): Promise<void> {
  await d1
    .prepare("UPDATE api_keys SET tenant_id = ? WHERE tenant_id = ? AND key_type = 'pk_live'")
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

// Resolves the HMAC secret for all API-key hashing (SK-APIKEYS-014).
// Prefers the dedicated `API_KEY_SECRET` so key-hash HMAC and
// session-signing HMAC use independent keys — either rotates without
// invalidating the other. Falls back to `BETTER_AUTH_SECRET` when unset
// so dev / test / un-migrated deploys keep SK-APIKEYS-008's original
// behaviour. Migrate with zero re-hash by setting `API_KEY_SECRET` to the
// current `BETTER_AUTH_SECRET` value. This is the only place the choice is
// made — mint, lookup, and the SK-MCP-014 status-probe hash all route
// through it so the stored `key_hash` stays consistent across surfaces.
export function apiKeyHmacSecret(env: {
  API_KEY_SECRET?: string;
  BETTER_AUTH_SECRET: string;
}): string {
  return env.API_KEY_SECRET || env.BETTER_AUTH_SECRET;
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
