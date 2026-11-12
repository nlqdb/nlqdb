---
"@nlqdb/mcp": minor
---

`nlqdb_connect_database` attaches a Cloudflare D1: `engine: "d1"` with `account_id`, `database_id` and an API `token` (sealed server-side, never echoed back) returns the DBA's first D1 proposals, decided with `nlqdb_apply_proposal` / `nlqdb_reject_proposal`; `nlqdb_list_proposals` shows verify's D1 verdict (mean time and rows read per run).
