-- API keys: pk_live_ (per-DB read-only embeds), sk_live_ (account-scoped),
-- and sk_mcp_<host>_<device>_ (MCP per-host per-device). Phase 1 ships
-- pk_live_ only; key_type CHECK future-proofs the other two.
--
-- key_hash: HMAC-SHA256(BETTER_AUTH_SECRET, plaintext_key) hex — never
-- the plaintext. See SK-APIKEYS-008 for the rationale (Argon2id unavailable
-- on CF Workers; HMAC-SHA256 is equivalent for random high-entropy keys).
--
-- db_id: non-null for pk_live_ (per-DB scope), null for sk_live_ / sk_mcp_
-- (account-scoped). Phase 1 only mints pk_live_, so this is always set.
--
-- allow_origins: reserved for Phase 2 origin pinning (SK-APIKEYS-003).
-- NULL = unrestricted (Phase 1 default).

CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  db_id       TEXT,
  key_type    TEXT NOT NULL CHECK (key_type IN ('pk_live', 'sk_live', 'sk_mcp')),
  key_hash    TEXT NOT NULL UNIQUE,
  last_4      TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS api_keys_tenant ON api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS api_keys_db ON api_keys (db_id) WHERE db_id IS NOT NULL;
