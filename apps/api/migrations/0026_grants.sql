-- Migration number: 0026 	 2026-08-08T02:14:43.923Z
--
-- Cross-tenant read-grant control plane (SK-EKP-008, EK-06).
--
-- The grant is a platform-brokered control-plane object: the Worker checks
-- it on every granted query (fail-closed, status cached <= 30 s). It lives
-- in D1 because Neon has no cross-project sharing primitive — the broker
-- above Postgres is the share.
--
--   - `scope` is a JSON array of bare table names the grantee may read.
--     It is authoritative over role privileges (SK-EKP-008): enforcement
--     rejects any query reaching outside it at validation, before
--     execution. Schema widening never widens a grant — new tables are
--     not auto-included.
--   - `price_model` is an opaque string set by the selling flow (the
--     private `experts` surface, SK-EKP-003). nlqdb's public core stores
--     it and never interprets it — no fee logic here (SK-EKP-002).
--   - status is derived: `revoked_at IS NULL` = active (same idiom as
--     `api_keys`). Revocation fails closed within 30 s per SK-EKP-008.
--
-- v1 grants are mintable on platform-provisioned hosted DBs only — the
-- mint path rejects BYO rows (`connection_blob` / `__byo_blob__`).

CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  owner_tenant_id TEXT NOT NULL,
  owner_db_id TEXT NOT NULL,
  grantee_tenant_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  price_model TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at INTEGER
);

-- Owner dashboard ("grants I sold") and grantee lookup ("grants I hold").
CREATE INDEX idx_grants_owner_tenant ON grants (owner_tenant_id);
CREATE INDEX idx_grants_grantee_tenant ON grants (grantee_tenant_id);
-- The per-request authorization check: active grant for (grantee, db).
CREATE INDEX idx_grants_grantee_db ON grants (grantee_tenant_id, owner_db_id);
