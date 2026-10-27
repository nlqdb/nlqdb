-- GLOBAL-043 items 4–5 — the apply / reject verbs record who decided a
-- proposal, when, and (on a reject) the reason given, on its ledger row.
-- `status` gains 'rejected'.

ALTER TABLE dba_changes ADD COLUMN decided_by TEXT; -- 'user:<id>' | 'sk_live:<keyId>' | 'sk_mcp:<keyId>'
ALTER TABLE dba_changes ADD COLUMN decided_at INTEGER;
ALTER TABLE dba_changes ADD COLUMN reject_reason TEXT;
