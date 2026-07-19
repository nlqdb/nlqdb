-- Migration number: 0022 	 2026-07-19T15:07:41.623Z
--
-- SK-GTM-003 — daily GTM/PMF snapshot rows (GLOBAL-038, founder
-- directive 2026-07-19: acquisition progress must be observable).
--
-- D1 stores only current state (`databases.last_queried_at` is one
-- timestamp, not a log), so week-over-week funnel trends cannot be
-- reconstructed retroactively. This table is the append-only history:
-- one row per UTC day, written idempotently (INSERT OR IGNORE keyed on
-- `day`) from two triggers — the daily `scheduled()` cron branch and,
-- belt-and-braces, every authorized `GET /v1/admin/metrics` read.
--
-- `metrics_json` is a headline subset of `computeGtmMetrics`
-- (apps/api/src/admin/gtm-metrics.ts — the canonical metric owner).
-- Shape is additive-only: new metrics land as new keys; renamed or
-- retyped fields get a NEW key and old keys stay readable. Rows are
-- never updated or deleted — the first write of a day wins.

CREATE TABLE gtm_snapshots (
  day TEXT PRIMARY KEY, -- UTC calendar day, 'YYYY-MM-DD'
  metrics_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
