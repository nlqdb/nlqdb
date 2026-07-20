-- SK-GTM-007 — first-touch acquisition source on the created DB row.
-- JSON object captured at create time from the web client
-- ({ utm_source, utm_medium, utm_campaign, ref, landing }); rides
-- adoption's tenant re-key untouched, so a stranger signup stays
-- attributable to the channel that produced it. NULL = created before
-- the instrument or via a surface that doesn't capture (CLI/SDK/MCP).
ALTER TABLE databases ADD COLUMN source_json TEXT;
