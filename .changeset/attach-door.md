---
"@nlqdb/sdk": minor
---

`client.attach({ connectionUrl })` attaches a Postgres you already run (`POST /v1/attach`) and returns its first proposals: indexes the DBA would build, each with the statement that undoes it and its ledger id. `databases.connect` returns the same `proposals` for a Postgres. `listChanges` rows now carry `status` (`proposed` | `applied`) and the proposal's `reason`.
