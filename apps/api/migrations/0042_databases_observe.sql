-- GLOBAL-043 item 7 (Tier 1) — the scheduled observer on attached Postgres
-- DBs. `pg_stat_statements` is cumulative, so the `dba_observe` job keeps one
-- snapshot of its counters per DB and diffs the next one against it; the
-- window's Tier 1 proposals land in `dba_changes` like the attach door's.

ALTER TABLE databases ADD COLUMN observe_from TEXT; -- { fingerprint: [calls, totalMs, sumSquaresMs] }; NULL = no baseline yet
ALTER TABLE databases ADD COLUMN observed_at INTEGER; -- last observe attempt; orders the job's batch
