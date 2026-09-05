-- SK-SCHEMA-010 — the GLOBAL-041 KPI-1 instrument (first-insert inference
-- rate): non-saturating per-DB counters of writes that referenced an
-- unobserved table, split by outcome (absorbed inline / rejected as
-- `schema_mismatch`). Bumped in the same fire-and-forget UPDATE as the
-- SK-GTM-011 counters (`apps/api/src/index.ts` `bumpAskCounters`); the
-- rate is SUM(ok) / SUM(ok + failed), read by `computeGtmMetrics`.

ALTER TABLE databases ADD COLUMN asks_extend_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE databases ADD COLUMN asks_extend_failed INTEGER NOT NULL DEFAULT 0;
