-- BYOLLM key storage per SK-PREMIUM-008: user-provided LLM provider keys,
-- encrypted at rest with AES-GCM using a Workers-Secret KEK.
--
-- Separate table rather than reusing api_keys: no key_hash lookup, no db_id
-- scope, and we need an llm_provider discriminant column. Avoids a
-- CHECK-constraint migration on api_keys.
--
-- encrypted_key: base64(12-byte IV ‖ AES-GCM ciphertext) — see byollm-keys.ts.
-- last_4: last 4 plaintext chars for dashboard display (mirrors api_keys).
-- One-active-key invariant enforced by UNIQUE partial index in 0017.

CREATE TABLE IF NOT EXISTS byollm_keys (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  llm_provider  TEXT NOT NULL CHECK (llm_provider IN ('anthropic', 'openai', 'gemini', 'openrouter')),
  encrypted_key TEXT NOT NULL,
  last_4        TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at    INTEGER
);
