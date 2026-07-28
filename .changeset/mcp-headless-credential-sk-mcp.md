---
"@nlqdb/mcp": patch
---

Name the MCP-scoped `sk_mcp_` key as the headless credential, not the
full-account `sk_live_`. The README and the no-key stderr hint both told a
reader to paste an account-wide secret into a host config, because until
`SK-APIKEYS-015` (2026-07-28) `/app/keys` could not mint anything narrower. It
can now, so the guidance points there: an MCP key reaches every tool this server
exposes except `nlqdb_connect_database`, is bound to one host + device, and is
revocable on its own. The `connect_requires_account` error also stops suggesting
`sk_mcp_` — that key can never satisfy it, so a host following the old action
retried the same 403 forever.
