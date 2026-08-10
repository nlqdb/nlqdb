-- Migration number: 0029 	 2026-08-10T00:00:00.000Z
--
-- Import drafts for the shared pack runner (SK-PIVOT-021, dogfood D-08).
--
-- One row per in-flight or completed goal-pack import. The row IS the
-- journey's memory: its `id` is the only thing that ever appears in a URL,
-- so a refresh, a back/forward, a dropped connection, an nlqdb sign-in and
-- a provider-consent redirect all resume by re-reading it. Source content,
-- provider tokens and credentials are never stored here — `state_json`
-- holds the pinned source descriptor, the scan counters, and the extracted
-- `agent_memory_v1` rows (which are memory content the user is about to
-- own, not secrets).
--
--   - `tenant_id` is NULL until the first authenticated advance claims it.
--     Deliberate: a public-source preflight must produce useful evidence
--     before an account exists (GLOBAL-007), and the opaque id is the
--     capability that lets the same browser resume it. `claim` is a
--     conditional UPDATE on `tenant_id IS NULL`, so two concurrent sign-in
--     returns cannot both take the draft.
--   - `phase` is the runner's durable checkpoint: inspecting → classifying
--     → extracting → saving → verifying → complete. A retry resumes at
--     this phase; it never restarts the import.
--   - `save_cursor` is the count of extracted records already written to
--     memory. It advances after every single write, which is what makes a
--     retry non-duplicating on the append-only `facts` table.
--   - `db_id` is the isolated agent_memory_v1 DB the import writes to. It
--     is NOT a foreign key: the alpha cleanup deletes that DB through the
--     SK-HDC-016 path and the draft must survive as the record of what
--     was imported and then removed.
--
-- Drafts are disposable product state, not a ledger: a cleanup sweep may
-- delete stale rows, which is why nothing else references this table.

CREATE TABLE pack_imports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  pack_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  db_id TEXT,
  save_cursor INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- "my imports" on the product surface, newest first.
CREATE INDEX idx_pack_imports_tenant ON pack_imports (tenant_id, created_at DESC);
-- The stale-draft sweep (unclaimed drafts age out fastest).
CREATE INDEX idx_pack_imports_updated ON pack_imports (updated_at);
