# @nlqdb/mcp

Analytical memory for AI agents, over MCP — a real Postgres your agent can
`GROUP BY` / `JOIN` / aggregate over in natural language, not just a recall
store. This package is the **local stdio** transport: it reads an API key from
the environment, so it works headless (CI, Docker, air-gapped, coding agents
that can't open a browser).

Don't want a local process? Point your host at the hosted server
`https://mcp.nlqdb.com/mcp` instead — OAuth in the browser, nothing to install.

## Install

Create an `sk_live_…` key at
[app.nlqdb.com/app/keys](https://app.nlqdb.com/app/keys), then add this to your
MCP host's config:

```json
{
  "mcpServers": {
    "nlqdb": {
      "command": "npx",
      "args": ["-y", "@nlqdb/mcp"],
      "env": { "NLQDB_API_KEY": "sk_live_…" }
    }
  }
}
```

`sk_live_…` is account-scoped and reaches every tool. A `pk_live_…` key is
pinned to one database and can only call `nlqdb_query`.

## Tools

| Tool | Does |
|---|---|
| `nlqdb_query` | Ask in plain English; returns rows plus the compiled SQL. The database materialises on first reference — there is no create tool. |
| `nlqdb_remember` | Write a typed memory row the agent can query later. |
| `nlqdb_list_databases` | List your databases. |
| `nlqdb_describe` | Describe a database's schema. |
| `nlqdb_connect_database` | Attach your own Postgres or ClickHouse. |

Destructive plans (INSERT/UPDATE/DELETE/DDL) come back as
`requires_confirm: true` with a diff — re-call with `confirm: true` to commit.
`NLQDB_MCP_DEBUG=1` prints stack traces on fatal errors.

## More

Per-host config blocks and one-click installs:
[docs.nlqdb.com/mcp](https://docs.nlqdb.com/mcp/) ·
[what agent memory buys you](https://nlqdb.com/agents/?utm_source=npm) ·
[design + contributing](https://github.com/nlqdb/nlqdb/blob/main/docs/features/mcp-server/FEATURE.md)
