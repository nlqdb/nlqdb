# @nlqdb/mcp

Analytical memory for AI agents, over MCP — a real Postgres your agent can
`GROUP BY` / `JOIN` / aggregate over in natural language, not just a recall
store. This package is the **local stdio** transport: it reads an API key from
the environment, so it works headless (CI, Docker, air-gapped, coding agents
that can't open a browser).

Don't want a local process? Point your host at the hosted server
`https://mcp.nlqdb.com/mcp` instead — OAuth in the browser, nothing to install.

## Install

Create an `sk_mcp_…` **MCP key** at
[app.nlqdb.com/app/keys](https://app.nlqdb.com/app/keys), then add this to your
MCP host's config:

```json
{
  "mcpServers": {
    "nlqdb": {
      "command": "npx",
      "args": ["-y", "@nlqdb/mcp"],
      "env": { "NLQDB_API_KEY": "sk_mcp_…" }
    }
  }
}
```

`sk_mcp_…` is bound to one host + device and reaches every tool here except
`nlqdb_connect_database` (attaching an external database stays an account
action); revoke it on its own at `/app/keys`. An `sk_live_…` account key also
works if you need that one tool too. A `pk_live_…` key is pinned to one database
and can only call `nlqdb_query`.

## Drop-in skill — teach the agent *when* to remember

Connecting the server gives your agent the tools. It doesn't tell it what is
worth remembering, or that it can aggregate over what it stored. One command
installs a skill that does, into a repo your agent already reads:

```bash
npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory
```

Run against the live [`skills`](https://github.com/vercel-labs/skills) CLI
2026-07-27 — no account, no publish. It writes
`.agents/skills/nlqdb-memory/SKILL.md` (the cross-agent directory Cursor and
Codex read directly), a `.claude/skills/nlqdb-memory` symlink for Claude Code,
and a `skills-lock.json`. It does not write a `.cursor/rules/` file and does
not edit `AGENTS.md` — a host that reads only `AGENTS.md` needs
[`AGENTS.snippet.md`](https://nlqdb.com/agent-artifacts/AGENTS.snippet.md?utm_source=npm)
appended by hand. All four host artifacts:
[nlqdb.com/agent-artifacts](https://nlqdb.com/agent-artifacts/README.md?utm_source=npm).

## Tools

| Tool | Does |
|---|---|
| `nlqdb_query` | Ask in plain English; returns rows plus the compiled SQL. The database materialises on first reference — there is no create tool. Writes/DDL preview as a diff and commit on confirm. |
| `nlqdb_read` | Read-only version of `nlqdb_query` — SELECT/aggregate only, never writes or creates. Mark it "always allow" in your host so reads stop prompting. |
| `nlqdb_remember` | Write a typed memory row the agent can query later. |
| `nlqdb_list_databases` | List your databases. |
| `nlqdb_describe` | Describe a database's schema. |
| `nlqdb_connect_database` | Attach your own Postgres or ClickHouse. |

Destructive plans (INSERT/UPDATE/DELETE/DDL) come back as
`requires_confirm: true` with a diff — re-call with `confirm: true` to commit.
`NLQDB_MCP_DEBUG=1` prints stack traces on fatal errors.

## More

Per-host config blocks and one-click installs:
[docs.nlqdb.com/mcp](https://docs.nlqdb.com/mcp/?utm_source=npm) ·
[what agent memory buys you](https://nlqdb.com/agents/?utm_source=npm) ·
[design + contributing](https://github.com/nlqdb/nlqdb/blob/main/docs/features/mcp-server/FEATURE.md)
