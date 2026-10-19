---
"@nlqdb/sdk": minor
---

Add `client.insert({ db, table, rows })`: write JSON rows with no model call. Keys become lower_snake_case columns (`serverId` → `server_id`), and a table or field the database hasn't seen is created in the same transaction, typed from the values (`SK-SCHEMA-012`). `runSql()` now takes `params`, bound to `$1…$n` by the database and never spliced into the SQL (`SK-SDK-015`). `ApiErrorCode` drops `create_requires_session`: an `sk_live_`/`sk_mcp_` key now goal-creates through `createDatabase({ goal })` (`SK-HDC-008`).
