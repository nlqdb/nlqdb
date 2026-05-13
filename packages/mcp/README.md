# @nlqdb/mcp

Model Context Protocol server for nlqdb — local-stdio transport
(slice 2 of `SK-MCP-010`). Tools: `nlqdb_query`,
`nlqdb_list_databases`, `nlqdb_describe`. See
[`docs/features/mcp-server/FEATURE.md`](../../docs/features/mcp-server/FEATURE.md)
for the full design.

## Auth posture (slice 2)

- `nlqdb_query` works end-to-end against a `pk_live_*` key (pinned to
  one database). Destructive plans (INSERT/UPDATE/DELETE/DDL) return
  `requires_confirm: true` + a `diff` — re-call with `confirm: true`
  to commit (`SK-TRUST-001`).
- `nlqdb_list_databases` and `nlqdb_describe` require user-scoped
  auth (`sk_live_*` or `sk_mcp_*`). Until slice 1 ships those keys,
  both surface a typed `auth_required` tool error in the
  `SK-MCP-006` shape — one sentence + one next action.

## Install (manual; pre-slice-4)

`nlq mcp install` (slice 4) is the supported install path. Until it
ships, add this to your host's MCP config (see `SK-MCP-008` for the
per-host config path):

```json
{
  "mcpServers": {
    "nlqdb": {
      "command": "npx",
      "args": ["@nlqdb/mcp"],
      "env": { "NLQDB_API_KEY": "pk_live_…" }
    }
  }
}
```

`NLQDB_MCP_DEBUG=1` in the env prints stack traces on fatal errors.

## Build pipeline

- **Monorepo dev:** `main` points at `src/index.ts`; Bun loads `.ts`
  directly. Run tests via `bun run --filter @nlqdb/mcp test`.
- **Publish artifact:** `bun run build` emits `dist/index.js` (single
  ESM bundle with `@nlqdb/sdk` inlined; npm deps kept external).
  `publishConfig` flips `main` and `exports` to `dist/index.js` so
  `npx @nlqdb/mcp` works under Node 20+ from npm.

CI runs the build for the `mcp` matrix entry and asserts `dist/index.js`
is produced; the bundle stays out of git (`.gitignore`'s `dist/`).

## Lockfile invariant (SK-MCP-005)

`@nlqdb/mcp` has zero database drivers in its lockfile. CI
(`scripts/lockfile-guard.sh` + `.github/lockfile-allowlist.json`)
fails any PR that adds `pg` / `postgres` / `redis` / similar. All
data access goes through `/v1/*` via `@nlqdb/sdk`.
