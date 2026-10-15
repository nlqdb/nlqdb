-- SK-SCHEMA-012 — the GLOBAL-041 KPI-1 instrument on the structured insert
-- (`POST /v1/insert`): non-saturating per-DB counters of inserts that named an
-- unobserved table or field, split by outcome (landed / failed). The rate is
-- SUM(ok) / SUM(ok + failed), read by `computeGtmMetrics`.

ALTER TABLE databases ADD COLUMN inserts_infer_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE databases ADD COLUMN inserts_infer_failed INTEGER NOT NULL DEFAULT 0;
