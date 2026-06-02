-- SK-PREMIUM-012 — account-stored BYOLLM credential rows in `api_keys`
-- (`scope = "byollm"`), the storage the documented design pins
-- (SK-PREMIUM-008, GLOBAL-026, GLOBAL-031, api-keys/FEATURE.md). A BYOLLM
-- row is a *decryptable* secret, so per api-keys/FEATURE.md it stores the
-- GLOBAL-031 sealed envelope in `key_hash` (a reversible blob, not the
-- one-way HMAC the minted `pk_*`/`sk_*` keys use) — still NOT NULL and
-- UNIQUE (a fresh random IV per seal guarantees uniqueness). New columns:
--
--   - scope    — `"byollm"` for these rows; NULL for every bearer key. The
--                discriminator (bearer lookups already filter `key_type`).
--   - provider — AI Gateway upstream slug (`openai` | `anthropic` |
--                `google-ai-studio`); the same set the header lane accepts.
--   - model    — upstream model id as the provider names it (e.g. `gpt-5.2`).
--
-- `key_type = "byollm"` is new, so the 0011 CHECK must be extended. SQLite
-- can't ALTER a CHECK in place, so this is the standard table rebuild
-- (CREATE → copy → DROP → RENAME → recreate indexes); api_keys has no FKs
-- or triggers, so the rebuild is self-contained. The copy preserves every
-- existing row unchanged (new columns default NULL). One active BYOLLM
-- credential per account is enforced by a partial UNIQUE index, matching
-- the single `accountCredential` the dispatch selector consumes
-- (SK-LLM-020); set hard-deletes the prior row first, so re-adding never
-- collides (and clearing removes the sealed blob — the instant revocation
-- GLOBAL-018 wants).

CREATE TABLE api_keys_new (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  db_id        TEXT,
  key_type     TEXT NOT NULL CHECK (key_type IN ('pk_live', 'sk_live', 'sk_mcp', 'byollm')),
  key_hash     TEXT NOT NULL UNIQUE,
  last_4       TEXT NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  mcp_host     TEXT,
  device_id    TEXT,
  last_used_at INTEGER,
  name         TEXT,
  revoked_at   INTEGER,
  scope        TEXT,
  provider     TEXT,
  model        TEXT
);

INSERT INTO api_keys_new
  (id, tenant_id, db_id, key_type, key_hash, last_4, created_at,
   mcp_host, device_id, last_used_at, name, revoked_at)
SELECT
  id, tenant_id, db_id, key_type, key_hash, last_4, created_at,
  mcp_host, device_id, last_used_at, name, revoked_at
FROM api_keys;

DROP TABLE api_keys;
ALTER TABLE api_keys_new RENAME TO api_keys;

-- Recreate the indexes the rebuild dropped (0011 + 0012 + 0013), unchanged.
CREATE INDEX api_keys_tenant ON api_keys (tenant_id);
CREATE INDEX api_keys_db ON api_keys (db_id) WHERE db_id IS NOT NULL;
CREATE INDEX api_keys_sk_lookup
  ON api_keys (tenant_id, key_type, mcp_host, device_id)
  WHERE key_type IN ('sk_live', 'sk_mcp');
CREATE INDEX api_keys_active_hash
  ON api_keys (key_hash)
  WHERE revoked_at IS NULL;

-- One active BYOLLM credential per account.
CREATE UNIQUE INDEX api_keys_byollm_one
  ON api_keys (tenant_id)
  WHERE key_type = 'byollm' AND revoked_at IS NULL;
