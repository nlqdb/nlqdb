---
"@nlqdb/sdk": minor
---

Add the cross-tenant read-grant verbs to the SDK (`SK-EKP-008`, EK-06 box 5):
`mintGrant`, `listGrants`, and `revokeGrant` wrap the `/v1/grants` control
plane. They are session-only — like the key verbs, they throw synchronously
unless the client was built with `withCredentials: true`, so a leaked
`sk_live_` bearer can never open one tenant's knowledge DB to another. Mints
and revokes auto-key the mutation for idempotent retries. This closes the
`GLOBAL-003` SDK gap for grants; the `nlq` CLI is the one remaining client
surface (MCP and elements are out of scope by design for a session-only
control-plane action).
