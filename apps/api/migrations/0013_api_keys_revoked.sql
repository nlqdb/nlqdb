-- SK-MCP-014 — Durable-Object revalidation: `apps/mcp/`'s `McpAgent`
-- caches the resolved `(user_id, mcp_host, device_id, sk_mcp_key)` tuple
-- per session and re-checks `revoked_at` against `apps/api/` every 1 s on
-- the hot path. Until this slice no key row could be revoked, so no
-- column was needed; landing the revalidation contract requires the
-- column even if the dashboard revoke surface (SK-APIKEYS-006) hasn't
-- shipped yet — `GET /v1/keys/:hash/status` is the cross-Worker probe
-- the DO calls, and an absent column would mean the probe couldn't
-- distinguish "not revoked" from "feature off".
--
-- `revoked_at`: unix seconds when the key was revoked, NULL otherwise.
-- `lookupSkKey` filters `WHERE revoked_at IS NULL` per SK-MCP-009.
-- A revoked row stays in the table so the DO's status probe can
-- distinguish "revoked" from "unknown key"; the dashboard surfaces
-- revoked keys grouped separately.

ALTER TABLE api_keys ADD COLUMN revoked_at INTEGER;

-- Partial index: only the active (non-revoked) rows participate in
-- the hot-path lookup. Revoked rows still answer the `GET /v1/keys/:hash/status`
-- probe but never auth a request.
CREATE INDEX IF NOT EXISTS api_keys_active_hash
  ON api_keys (key_hash)
  WHERE revoked_at IS NULL;
