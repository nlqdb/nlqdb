---
"@nlqdb/sdk": minor
---

`client.listChanges(dbId)` returns every schema change the DBA made on a database (`GET /v1/databases/:id/changes`), newest first, each with the statement that undoes it.
