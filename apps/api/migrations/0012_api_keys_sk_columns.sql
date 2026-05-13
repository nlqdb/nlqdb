-- MCP-010 Slice 1: extend `api_keys` to hold the per-key claims that
-- `sk_live_` and `sk_mcp_<host>_<device>_` keys need. The 0011 migration
-- already permits `key_type IN ('pk_live', 'sk_live', 'sk_mcp')`; this
-- migration adds the columns the new key types populate.
--
--   - `mcp_host`   — SK-APIKEYS-004 claim. Populated only for `sk_mcp`.
--                    The host slug (`claude-desktop`, `cursor`, `zed`, …)
--                    chosen by `nlq mcp install`.
--   - `device_id`  — SK-APIKEYS-004 claim. Populated only for `sk_mcp`.
--                    Stable per (machine, OS user); two MCP hosts on the
--                    same machine get distinct keys with the same id.
--   - `last_used_at` — SK-APIKEYS-002 display field ("Cursor on
--                      macbook-air · 3m ago"). Bumped on each successful
--                      lookup. Nullable so the freshly minted row reads
--                      as "never used" until first request.
--   - `name`       — Optional human label for `sk_live_` rows shown in
--                    the dashboard. `sk_mcp_` rows derive a label from
--                    `(mcp_host, device_id)` so this stays NULL there.
--
-- All four columns are nullable so the existing `pk_live_` rows from
-- migration 0011 keep working unmodified (db_id stays the per-DB pin).
--
-- `api_keys_sk_lookup` is the composite index `requirePrincipal` reads:
-- "Cursor on this device" → "is there a row?" stays an index hit, not
-- a tenant-wide scan, even as the per-account key count grows.

ALTER TABLE api_keys ADD COLUMN mcp_host TEXT;
ALTER TABLE api_keys ADD COLUMN device_id TEXT;
ALTER TABLE api_keys ADD COLUMN last_used_at INTEGER;
ALTER TABLE api_keys ADD COLUMN name TEXT;

CREATE INDEX IF NOT EXISTS api_keys_sk_lookup
  ON api_keys (tenant_id, key_type, mcp_host, device_id)
  WHERE key_type IN ('sk_live', 'sk_mcp');
