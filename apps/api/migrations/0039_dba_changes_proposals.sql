-- GLOBAL-043 item 4 — a proposal is a ledger row before it is applied, not a
-- second table (SK-MIGRATE-003). The attach door writes each Tier 0 proposal
-- as a 'proposed' row; the hosted-path rows above it were committed as they
-- were written, hence the 'applied' default.

ALTER TABLE dba_changes ADD COLUMN status TEXT NOT NULL DEFAULT 'applied'; -- 'proposed' | 'applied'
ALTER TABLE dba_changes ADD COLUMN proposal TEXT; -- the Proposal JSON (attach rows only)
