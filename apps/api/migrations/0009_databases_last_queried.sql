-- SK-ANON-002 / SK-ANON-012 — anon-DB sweep prerequisite.
--
-- Adds `last_queried_at` to the `databases` registry. The sweep job
-- (`apps/api/src/db-sweep/sweep.ts`) uses it to evict stale anon DBs
-- (90-day TTL) and to pick oldest-first under cap pressure. Backfill
-- existing rows from `updated_at` so a freshly-migrated database has
-- a defensible value for the next sweep window — without backfill,
-- `last_queried_at IS NULL` would either always-evict or never-evict
-- depending on the COALESCE direction, both wrong.
--
-- Touched on every successful /v1/ask in `apps/api/src/index.ts`
-- (fire-and-forget UPDATE under `ctx.waitUntil`). Authed users'
-- timestamps are also useful for the dashboard's "recent activity"
-- read; sweeps that scope to anon DBs don't touch authed rows.
--
-- The partial index keys on the column for tenant_id LIKE 'anon:%'
-- so the sweep's ORDER BY scan stays cheap as the table grows. SQLite
-- partial-index syntax is `WHERE <expr>`; LIKE in a partial index is
-- supported (D1 / SQLite >= 3.8).

ALTER TABLE databases ADD COLUMN last_queried_at INTEGER;
UPDATE databases SET last_queried_at = updated_at WHERE last_queried_at IS NULL;
CREATE INDEX idx_databases_anon_last_queried
  ON databases (last_queried_at)
  WHERE tenant_id LIKE 'anon:%';
