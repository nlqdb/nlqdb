-- BYOLLM key storage per SK-PREMIUM-008: user-provided LLM provider keys,
-- encrypted at rest with AES-GCM using a Workers-Secret KEK.
--
-- Separate table rather than reusing api_keys because the usage pattern is
-- fundamentally different: no key_hash lookup (we never auth via these keys),
-- no db_id scope, and we need an llm_provider discriminant column. A dedicated
-- table avoids a CHECK-constraint migration on api_keys.
--
-- encrypted_key: base64(12-byte IV ‖ AES-GCM ciphertext) — see byollm-keys.ts.
-- last_4: last 4 plaintext chars stored for dashboard display (mirrors api_keys).
-- At most one active key per (tenant_id, llm_provider) pair — enforced at the
-- application layer (storeBYOLLMKey revokes the prior active row before insert).

CREATE TABLE IF NOT EXISTS byollm_keys (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  llm_provider  TEXT NOT NULL CHECK (llm_provider IN ('anthropic', 'openai', 'gemini', 'openrouter')),
  encrypted_key TEXT NOT NULL,
  last_4        TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at    INTEGER
);

-- Hot-path lookup: active key for a tenant (dispatch precedence step 2).
CREATE INDEX IF NOT EXISTS byollm_keys_tenant_active
  ON byollm_keys (tenant_id, llm_provider)
  WHERE revoked_at IS NULL;
