---
"@nlqdb/sdk": minor
"@nlqdb/mcp": minor
---

`insert()` (and `nlqdb_insert`) returns `failed`: a row whose value won't cast to its column's existing type (`reason: "invalid_value"`, with `type`), or that repeats a unique value already stored or earlier in the batch (`reason: "duplicate"`), is refused alone and named as `{ index, field, reason }`, while the rest of the batch lands.
