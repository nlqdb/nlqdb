# @nlqdb/sdk

## 0.7.0

### Minor Changes

- 7983aeb: `client.attach({ connectionUrl })` attaches a Postgres you already run (`POST /v1/attach`) and returns its first proposals: indexes the DBA would build, each with the statement that undoes it and its ledger id. `databases.connect` returns the same `proposals` for a Postgres. `listChanges` rows now carry `status` (`proposed` | `applied`) and the proposal's `reason`.

## 0.6.0

### Minor Changes

- fb84d42: `client.listChanges(dbId)` returns every schema change the DBA made on a database (`GET /v1/databases/:id/changes`), newest first, each with the statement that undoes it.

## 0.5.0

### Minor Changes

- b0e1c29: `insert()` takes `key` (and `nlqdb_insert` a `key` field): rows upsert on those fields, so a re-run import or a changed vote never duplicates. The key's first use adds a unique index, reported as `index` on the result.
- a9eca70: `insert()` (and `nlqdb_insert`) returns `failed`: a row whose value won't cast to its column's existing type (`reason: "invalid_value"`, with `type`), or that repeats a unique value already stored or earlier in the batch (`reason: "duplicate"`), is refused alone and named as `{ index, field, reason }`, while the rest of the batch lands.
- 81533af: Add `client.insert({ db, table, rows })`: write JSON rows with no model call. Keys become lower*snake_case columns (`serverId` → `server_id`), and a table or field the database hasn't seen is created in the same transaction, typed from the values (`SK-SCHEMA-012`). `runSql()` now takes `params`, bound to `$1…$n` by the database and never spliced into the SQL (`SK-SDK-015`). `ApiErrorCode` drops `create_requires_session`: an `sk_live*`/`sk*mcp*`key now goal-creates through`createDatabase({ goal })` (`SK-HDC-008`).

## 0.4.0

### Minor Changes

- b7fbdcf: Add the shared pack-import runner verbs to the SDK (`SK-SDK-014`, EK-05
  runner-reuse gap 1): `client.packImports.{create,get,advance,retry,delete}`
  wrap the `/v1/packs/imports/*` journey (`SK-PIVOT-021`). Unlike the grant
  verbs these are **bearer-drivable by construction** — `advance`/`retry`/
  `delete` accept an account-scoped `sk_live_`/`sk_mcp_` key (`SK-PIVOT-010`),
  so the private `experts` marketplace embeds the hosted runner headlessly over
  the SDK (`SK-EKP-003` option B) instead of importing a rail; `create`/`get`
  are the public preflight (`GLOBAL-007`). Mutations auto-key for idempotent
  retries.

## 0.3.0

### Minor Changes

- a0ba928: Add the cross-tenant read-grant verbs to the SDK (`SK-EKP-008`, EK-06 box 5):
  `mintGrant`, `listGrants`, and `revokeGrant` wrap the `/v1/grants` control
  plane. They are session-only — like the key verbs, they throw synchronously
  unless the client was built with `withCredentials: true`, so a leaked
  `sk_live_` bearer can never open one tenant's knowledge DB to another. Mints
  and revokes auto-key the mutation for idempotent retries. This closes the
  `GLOBAL-003` SDK gap for grants; the `nlq` CLI is the one remaining client
  surface (MCP and elements are out of scope by design for a session-only
  control-plane action).

## 0.2.2

### Patch Changes

- 1a95ee7: Fix the published package being impossible to import. Every released version
  (0.1.0, 0.2.0, 0.2.1) published `main`/`types`/`exports` pointing at
  `./src/index.ts` while the tarball shipped only `dist/`, so
  `import "@nlqdb/sdk"` threw `ERR_MODULE_NOT_FOUND` after a clean install. The
  corrected entrypoints lived in `publishConfig`, but overriding package.json
  fields from there is a pnpm feature that npm ignores (npm/cli#7586), so they
  never reached the registry. A `prepack` hook now applies them, and
  `npm-tarball-entrypoint-integrity.test.ts` fails if any publishable package's
  entrypoints fall outside its own `files` allowlist.
- cd81a07: Give the npm package page a way in. The README — the page npmjs.com renders —
  documented every verb but linked nowhere: a developer who discovered the
  canonical HTTP client on npm had no path to the product, the docs, or the API
  key the `## Auth` section assumes they already hold. Added a lead-in linking
  `nlqdb.com`, `docs.nlqdb.com/sdk`, and `app.nlqdb.com/app/keys`, with the two
  landing URLs `?utm_source=npm`-tagged so a click-through stops converting as
  `direct` (SK-GTM-007). Guarded by `test/readme.test.ts`.

## 0.2.1

### Patch Changes

- bf1f85e: Document the full public surface and make BYOLLM validation errors actionable.

  - Every `NlqClient` method, `createClient`, and `NlqdbApiError` now carry JSDoc
    (endpoint summary, response discriminator, retry/idempotency behaviour, key
    error codes, and auth requirements) so it surfaces in IDE hover and to coding
    agents.
  - `byollm` construction errors now name the next action (e.g. "…must not
    contain control characters — re-paste the key without hidden CR/LF
    characters.") per GLOBAL-012.
  - README clarifies the `err.code` vs `err.message` discipline: branch on
    `err.code`, treat `err.message` as debug text.

  No behaviour change beyond the validation message text.

## 0.2.0

### Minor Changes

- 16e356d: Add account-stored BYOLLM credential verbs (`SK-SDK-011`): `setByollm`,
  `getByollmStatus`, and `clearByollm` wrap `POST/GET/DELETE
/v1/keys/byollm`. They persist one provider key per account (sealed at
  rest, `GLOBAL-031`) so every later session dispatches through it without
  re-sending the key — the persistent counterpart to the per-request
  `byollm` option. Signed-in only: the verbs throw unless the client was
  built with `withCredentials: true`, and the stored key is write-only
  (`last4` is the sole display field, never the key).

## 0.1.0

### Minor Changes

- bc48b58: Initial publish of `@nlqdb/sdk` to npm. Typed HTTP client for the
  nlqdb `/v1` API — zero runtime deps, runtime-agnostic (browsers,
  Node ≥ 18, Bun, Cloudflare Workers), per-method `AbortSignal`,
  auto-`Idempotency-Key` on retried mutations, OIDC trusted-publishing
  provenance.
