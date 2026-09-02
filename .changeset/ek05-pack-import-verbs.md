---
"@nlqdb/sdk": minor
---

Add the shared pack-import runner verbs to the SDK (`SK-SDK-014`, EK-05
runner-reuse gap 1): `client.packImports.{create,get,advance,retry,delete}`
wrap the `/v1/packs/imports/*` journey (`SK-PIVOT-021`). Unlike the grant
verbs these are **bearer-drivable by construction** — `advance`/`retry`/
`delete` accept an account-scoped `sk_live_`/`sk_mcp_` key (`SK-PIVOT-010`),
so the private `experts` marketplace embeds the hosted runner headlessly over
the SDK (`SK-EKP-003` option B) instead of importing a rail; `create`/`get`
are the public preflight (`GLOBAL-007`). Mutations auto-key for idempotent
retries.
