-- Optional persona slug on waitlist signup; values from `WAITLIST_PERSONAS` in `apps/api/src/waitlist.ts` (mirrors `docs/research/personas.md`).

ALTER TABLE waitlist ADD COLUMN persona TEXT;
