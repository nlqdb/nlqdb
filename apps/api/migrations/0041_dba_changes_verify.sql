-- GLOBAL-043 items 4 and 7 (Tier 3) — verify after the window. An apply keeps
-- its fingerprint's cumulative counters at build time (`verify_from`); the
-- `dba_verify` job diffs them against a fresh read once the window has passed,
-- records the verdict and, on a > 10 % worse p95 est., runs the inverse.
-- `status` gains 'reverted'.

ALTER TABLE dba_changes ADD COLUMN verify_from TEXT; -- StatementCounters JSON; NULL = nothing to diff
ALTER TABLE dba_changes ADD COLUMN verification TEXT; -- Verification JSON, set once
ALTER TABLE dba_changes ADD COLUMN verified_at INTEGER;
