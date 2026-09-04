-- SK-GTM-011 — non-saturating per-DB ask counters, split by surface, so
-- `SK-PIVOT-016` criterion 1 ("≥ 100 real asks through the public MCP
-- surface") becomes a live-countable number instead of a saturated lower
-- bound. `first10_asks` (migration 0020) stops at 10 by design and carries
-- no per-ask surface, so neither it nor the create-time `source_surface`
-- (migration 0033) can isolate the MCP-only ask total.
--
-- `asks_total` counts every routed /v1/ask completion (ok or error) for the
-- DB; `asks_mcp` the subset whose principal was a public-MCP (`sk_mcp_`)
-- key (surfaceFromPrincipal === "mcp"). Both bumped fire-and-forget in the
-- same UPDATE as the first-10 counters (`apps/api/src/index.ts`), off the
-- response path, and excluded for nlqdb's own stranger-test walker
-- (SK-ONBOARD-007). NULL is impossible — DEFAULT 0 backfills every row.
--
-- The criterion-1 read is one query over the workload (run by the launch
-- gate on `/app/admin`, SK-GTM-008):
--   SELECT SUM(asks_mcp) FROM databases WHERE <agent_memory_v1 prefix>;

ALTER TABLE databases ADD COLUMN asks_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE databases ADD COLUMN asks_mcp INTEGER NOT NULL DEFAULT 0;
