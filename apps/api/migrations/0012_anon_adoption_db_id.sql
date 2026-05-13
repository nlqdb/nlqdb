-- SK-ANON-014 — record the migrated dbId on the adoption row so the
-- post-signin landing can pin the adopted DB synchronously (`?db=<id>`)
-- instead of waiting for the LeftRail's `/v1/databases` fetch and
-- relying on the "newest by created_at" heuristic.
--
-- Populated by `recordAnonAdoption` on first adoption (read from the
-- `UPDATE databases ... RETURNING id` clause). Read back on replay so
-- the defense-in-depth `/api/auth/anon-adopt-now` call from
-- `/auth/post-signin` can surface the dbId even when the Better Auth
-- `after`-middleware was the actual adopter.
--
-- Nullable: legacy rows pre-dating this migration have no dbId, and
-- the SK-ANON-012 sanity rule "max 1 anon DB per device" means the
-- per-token dbId is unique when present. We deliberately do NOT add a
-- foreign-key constraint to `databases(id)` — the sweep job
-- (`docs/runbook.md §9`) may evict the anon DB before adoption fires
-- on legacy devices, and a dangling row is harmless (the client falls
-- back to the existing newest-DB heuristic).

ALTER TABLE anon_adoptions ADD COLUMN database_id TEXT;
