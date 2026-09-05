-- SK-SCHEMA-010 — the KPI-1 instrument (GLOBAL-041 first-insert inference
-- rate): two non-saturating per-DB counters over the `/v1/ask` write path,
-- the SK-GTM-011 counter shape reused for the engine's headline number.
--
-- KPI 1 = writes that reference an unseen table/field and land with NO user
-- action, over all such writes. `asks_extend_failed` is the denominator less
-- the numerator: a write whose plan referenced an unobserved table hit the
-- schema-mismatch path (Defense A pre-flight or Defense B exec 42P01/3F000)
-- and was rejected — the exact demand widen-on-write exists to absorb.
-- `asks_extend_ok` is the numerator: an extend-needed write the engine
-- absorbed inline. It is wired but stays 0 until Phase A's `kind=extend`
-- routing lands (pivot-autonomous-dba.md §4 steps 1-6) — at which point the
-- rate climbs off its honest floor with no further schema change here.
--
-- Both are bumped fire-and-forget in the same UPDATE as the SK-GTM-011 ask
-- counters (`apps/api/src/index.ts` `bumpAskCounters`), off the response
-- path, gated on the orchestrator's `extendNeeded` flag, and excluded for
-- nlqdb's own stranger-test walker (SK-ONBOARD-007). NULL is impossible —
-- DEFAULT 0 backfills every row.
--
-- The KPI-1 read (surfaced by `computeGtmMetrics` as `engine`):
--   SELECT SUM(asks_extend_ok) * 1.0
--          / NULLIF(SUM(asks_extend_ok) + SUM(asks_extend_failed), 0)
--   FROM databases;

ALTER TABLE databases ADD COLUMN asks_extend_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE databases ADD COLUMN asks_extend_failed INTEGER NOT NULL DEFAULT 0;
