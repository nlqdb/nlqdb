-- SK-ONBOARD-006 — first-10-queries success counters (the GLOBAL-025
-- onboarding KPI, founder directive 2026-07-01).
--
-- Two saturating counters per `databases` row: `first10_asks` counts
-- the DB's first 10 routed /v1/ask completions (success or failure),
-- `first10_ok` the successful subset (orchestrator ok = 2xx,
-- non-refused). Bumped fire-and-forget in `apps/api/src/index.ts`
-- next to the `last_queried_at` touch; the UPDATE's
-- `first10_asks < 10` guard stops the counters at the ordinal the KPI
-- is defined over.
--
-- The KPI read is one query (run by the /daily scorecard pull):
--   SELECT SUM(first10_ok) * 1.0 / SUM(first10_asks)
--   FROM databases WHERE first10_asks > 0;

ALTER TABLE databases ADD COLUMN first10_asks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE databases ADD COLUMN first10_ok INTEGER NOT NULL DEFAULT 0;
