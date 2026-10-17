---
"@nlqdb/mcp": minor
---

Add `nlqdb_insert`: insert JSON rows exactly as sent, with no model call. A table or field the database hasn't seen is created in the same transaction, typed from the values (`SK-SCHEMA-012`).
