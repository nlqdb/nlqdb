# SK-CLI-020 — the hosted connection URL is issued once at create; it is never returned on `GET /v1/databases`, so a `nlq connection <db>` re-print verb is not built

Parent feature: [`cli/FEATURE.md`](../FEATURE.md). Sibling of the
credential-handling stance in
[`SK-CLI-019`](SK-CLI-019-db-connect-verb.md). Parent GLOBALs:
[`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md)
(connection secrets sealed at rest — the row stores only a
`connection_secret_ref`),
`GLOBAL-017` (one way to do each thing). Cross-refs:
[`SK-APIKEYS-003`](../../api-keys/FEATURE.md) (`pk_live_` keys are
read-only) and the `nlq keys rotate` open question
([`SK-APIKEYS-005`](../../api-keys/decisions/SK-APIKEYS-005-rotation-grace.md)).

- **Decision:** The hosted-Postgres connection URL is a **write-once
  credential**, handed back exactly once on the create response
  (`CreateDatabaseResult.connectionString`, `packages/sdk`). It is
  **not** added as a field on `GET /v1/databases` rows
  (`DatabaseSummaryRow`, `apps/api/src/databases/list.ts`), and the
  proposed `nlq connection <db>` verb that would re-print it is **not
  built**. A caller who has lost the URL re-obtains one through
  re-issuance/rotation, tracked with the `nlq keys rotate` /
  `SK-APIKEYS-005` grace-rotation slice — never by reading it back off a
  list.
- **Core value:** Bullet-proof, Simple
- **Why:** `GET /v1/databases` is a broad read-scoped endpoint reached by
  `pk_live_` read-only embed keys and the MCP `nlqdb_list_databases` tool
  (`requirePrincipal`, `apps/api/src/principal.ts`). Putting a live DB
  credential on it would hand the master connection string — user +
  password — to the least-privileged key class, contradicting
  `SK-APIKEYS-003` and `SK-CLI-019` ("the URL is a credential … never
  printed back"). It is also mechanically wrong: `GLOBAL-031` seals the
  URL at rest and the row keeps only `connection_secret_ref`, so the list
  path holds no plaintext to return. Standard credential practice is
  issue-once + rotate, not persistent re-fetch. The open question framed
  this as "one API field"; that field is a security regression, so the
  resolution is to *not* add it.
- **Consequence in code:** none — this is a decision to **not** widen the
  surface. `DatabaseSummaryRow` and `nlq db list` stay credential-free;
  `nlq db connect` (`SK-CLI-019`) remains the only URL-bearing verb, and
  it takes the URL in, never out. The `nlq connection` cobra stub is
  removed from the deferred-verbs list.
- **Alternatives rejected:**
  - **Add `connection_url` to `GET /v1/databases`** — returns a live
    credential to `pk_live_`/MCP read scopes on every list call; rejected
    on `SK-APIKEYS-003` + `GLOBAL-031` grounds.
  - **A create-only `GET /v1/databases/:id/connection` re-read** — still a
    persistent re-fetch of a sealed credential; re-issuance/rotation
    (`SK-APIKEYS-005`) is the one way to recover a lost URL (`GLOBAL-017`).
- **Source:** canonical here · governed by `GLOBAL-031` / `GLOBAL-017` ·
  cross-refs `SK-CLI-019`, `SK-APIKEYS-003`, `SK-APIKEYS-005`.
