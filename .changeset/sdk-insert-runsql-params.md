---
"@nlqdb/sdk": minor
---

Add `client.insert({ db, table, rows })`: write JSON rows exactly as sent, with no model call. A table or field the database hasn't seen is created in the same transaction, typed from the values (`SK-SCHEMA-012`). `runSql()` now takes `params`, bound to `$1…$n` by the database and never spliced into the SQL (`SK-SDK-015`).
