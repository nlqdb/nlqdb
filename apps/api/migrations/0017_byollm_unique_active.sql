-- Enforce the one-active-key-per-(tenant, provider) invariant at the DB layer
-- rather than only at the application layer. The UNIQUE partial index makes a
-- second active row impossible so a concurrent storeBYOLLMKey can't create two
-- active rows even if the revoke+insert in batch() interleaves with another
-- concurrent request.
--
-- Note: SQLite / D1 supports partial UNIQUE indexes. The WHERE clause means
-- revoked rows (revoked_at IS NOT NULL) are excluded, so a tenant can have many
-- historical rows for the same provider but only one active at a time.

CREATE UNIQUE INDEX IF NOT EXISTS byollm_keys_one_active
  ON byollm_keys (tenant_id, llm_provider)
  WHERE revoked_at IS NULL;
