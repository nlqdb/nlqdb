# @nlqdb/mcp

Model Context Protocol server for nlqdb — local-stdio transport
(slice 2 of `SK-MCP-010`). Tools: `nlqdb_query`,
`nlqdb_list_databases`, `nlqdb_describe`. See
[`docs/features/mcp-server/FEATURE.md`](../../docs/features/mcp-server/FEATURE.md)
for the full design.

## Auth posture (slice 2)

- `nlqdb_query` works end-to-end against a `pk_live_*` key (pinned to
  one database).
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

## Lockfile invariant (SK-MCP-005)

`@nlqdb/mcp` has zero database drivers in its lockfile. CI
(`scripts/lockfile-guard.sh` + `.github/lockfile-allowlist.json`)
fails any PR that adds `pg` / `postgres` / `redis` / similar. All
data access goes through `/v1/*` via `@nlqdb/sdk`.
