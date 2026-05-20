-- Persona selection on waitlist signup. Optional self-identification
-- from a fixed list anchored in `docs/research/personas.md` (P1–P6).
-- Value is the slugged persona id (e.g. `solo-builder`, `agent-builder`,
-- `data-analyst`, `backend-engineer`, `student`, `analytics-engineer`,
-- `other`); existing rows stay NULL (pre-feature signups had no choice).
-- Validation lives in `apps/api/src/waitlist.ts` — the column is plain
-- TEXT so the list can evolve without a migration.

ALTER TABLE waitlist ADD COLUMN persona TEXT;
