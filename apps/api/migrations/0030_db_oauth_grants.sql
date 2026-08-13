-- Migration number: 0030 	 2026-08-12T14:00:00.000Z
--
-- OAuth grant backing a database connected via a provider "Connect" button
-- (SK-DBCONN-003 — Supabase first). One row per BYO database that was connected
-- through OAuth; paste-connected rows have none, and the row's absence means
-- "paste-connected, nothing to re-auth or revoke".
--
--   - `token_blob` is the sealed OAuth token (access + refresh + expiry, one
--     JSON payload) under the shared envelope (GLOBAL-031), AAD `dboauth:<dbId>`
--     — a different context from the DSN's `dbconn:<dbId>`. For the Supabase
--     Management-API transport (Option B) this token is on the HOT query path:
--     query-time opens it, refreshes when expired, and runs the read-only SQL
--     over `POST /v1/projects/{ref}/database/query`.
--   - `provider_project` is the project ref (Supabase) / project id (Neon),
--     used to address the Management API and for display.
--   - `provider_role` is the read-only role nlqdb created in the user's DB, for
--     a clean `DROP ROLE` on disconnect. NULL for the Supabase mgmt transport,
--     which creates no role (every query runs `read_only:true` instead).
--
-- FK → databases(id): a grant cannot outlive its database row. Disconnect
-- (`DELETE /v1/databases/:id`) deletes the grant first, best-effort revoking the
-- token / dropping the role.

CREATE TABLE db_oauth_grants (
  db_id            TEXT PRIMARY KEY REFERENCES databases(id),
  provider         TEXT NOT NULL,               -- 'supabase' | 'neon'
  token_blob       TEXT NOT NULL,               -- sealed access+refresh token, AAD dboauth:<dbId>
  provider_role    TEXT,                         -- RO role to DROP on disconnect (NULL for mgmt transport)
  provider_project TEXT,                         -- project ref/id, for the Management API + display
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
