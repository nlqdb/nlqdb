# @nlqdb/mcp

## 0.3.0

### Minor Changes

- b0e1c29: `insert()` takes `key` (and `nlqdb_insert` a `key` field): rows upsert on those fields, so a re-run import or a changed vote never duplicates. The key's first use adds a unique index, reported as `index` on the result.
- a9eca70: `insert()` (and `nlqdb_insert`) returns `failed`: a row whose value won't cast to its column's existing type (`reason: "invalid_value"`, with `type`), or that repeats a unique value already stored or earlier in the batch (`reason: "duplicate"`), is refused alone and named as `{ index, field, reason }`, while the rest of the batch lands.

## 0.2.0

### Minor Changes

- bf06c96: Add `nlqdb_insert`: insert JSON rows exactly as sent, with no model call. A table or field the database hasn't seen is created in the same transaction, typed from the values (`SK-SCHEMA-012`).

## 0.1.1

### Patch Changes

- 5cc4bd1: Name the MCP-scoped `sk_mcp_` key as the headless credential, not the
  full-account `sk_live_`. The README and the no-key stderr hint both told a
  reader to paste an account-wide secret into a host config, because until
  `SK-APIKEYS-015` (2026-07-28) `/app/keys` could not mint anything narrower. It
  can now, so the guidance points there: an MCP key reaches every tool this server
  exposes except `nlqdb_connect_database`, is bound to one host + device, and is
  revocable on its own. The `connect_requires_account` error also stops suggesting
  `sk_mcp_` — that key can never satisfy it, so a host following the old action
  retried the same 403 forever.
- e4d740a: Add the drop-in skill install path to the README npmjs.com renders. The
  package page told a reader how to connect the server but not how to make
  their agent _use_ it — the one command that installs the `nlqdb-memory`
  skill (`npx skills add …`, run live 2026-07-27) was published on three
  nlqdb-hosted surfaces and none of the ones npm serves. Its docs link is
  now `?utm_source=npm`-tagged too, so a click-through from the package page
  stops converting as `direct`.
- 7579430: Rewrite the README that npmjs.com renders as the package page. `0.1.0` shipped
  the internal contributor notes: it told readers `nlqdb_list_databases` and
  `nlqdb_describe` don't work yet (slice 1 has shipped), listed four of the five
  tools, and gave an install snippet without `-y` — so `npx` prompts and a
  headless host hangs. Replaced with the real headless setup, the full tool
  table, and a `?utm_source=npm` product link. First publish through the
  Trusted Publisher configured on 2026-07-26.
