---
"@nlqdb/sdk": minor
"@nlqdb/mcp": minor
---

`insert()` takes `key` (and `nlqdb_insert` a `key` field): rows upsert on those fields, so a re-run import or a changed vote never duplicates. The key's first use adds a unique index, reported as `index` on the result.
