---
"@nlqdb/sdk": minor
---

`client.attach({ engine: "d1", accountId, databaseId, token })` attaches a Cloudflare D1 (`POST /v1/attach`) and returns its first proposals, each already in the ledger. The token travels in the request body only.
