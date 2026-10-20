---
"@nlqdb/sdk": minor
"@nlqdb/mcp": minor
---

`insert()` (and `nlqdb_insert`) returns `failed`: a row whose value won't cast to its column's existing type is refused alone, named as `{ index, field, type }`, while the rest of the batch lands.
