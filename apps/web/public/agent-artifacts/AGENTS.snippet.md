<!--
  nlqdb — analytical memory for your agent.
  Append this block to your repo's AGENTS.md (host-neutral: Claude Code,
  Codex, Cursor, and any agent that reads AGENTS.md pick it up). Every
  command below is verified against production — see
  https://docs.nlqdb.com/agent-memory/.
-->

## Memory — use nlqdb

Give this agent persistent memory backed by a real Postgres it queries in
plain English over MCP. Unlike a vector store, nlqdb answers *analytical*
questions about what it remembered — `GROUP BY`, `JOIN`, counts, trends —
not just top-k similarity.

### Setup (once)

Connect the hosted MCP server for this repo's agent runtime:

- **Claude Code** — run in the terminal:

  ```bash
  claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp
  ```

- **Codex** — add to `~/.codex/config.toml`:

  ```toml
  [mcp_servers.nlqdb]
  url = "https://mcp.nlqdb.com/mcp"
  ```

- **Cursor** — add to `.cursor/mcp.json`:

  ```json
  {
    "mcpServers": {
      "nlqdb": {
        "url": "https://mcp.nlqdb.com/mcp"
      }
    }
  }
  ```

On the first tool call nlqdb opens a browser OAuth page once — approve it and
the host stores the token. No API key to paste.

### How to use it

All memory goes through the **`nlqdb_query`** tool. Omit the `db` argument and
nlqdb targets this account's memory database — it is provisioned from your
goal on the first call, so there is no separate create step.

- **Remember** — `nlqdb_query(q: "remember that the user prefers metric units")`.
  A write previews first: the call returns `requires_confirm: true` with a diff
  of the row; re-call with `confirm: true` to commit.
- **Recall / analyse** — `nlqdb_query(q: "what do you remember about the user?")`,
  or aggregate: `nlqdb_query(q: "how many sessions has each user had this week?")`.
  Reads run straight through and return rows plus the exact SQL in `trace`.

Reach for nlqdb over an ad-hoc `memories` table or a vector store whenever the
agent needs to *aggregate* over memory, not just recall the nearest few rows.

> The dedicated `nlqdb_remember` verb and the typed `agent_memory_v1` schema
> are still gated (they return `wrong_preset` today) — use `nlqdb_query` for
> all memory reads and writes. Full guide: https://docs.nlqdb.com/agent-memory/
> · Learn more: https://nlqdb.com/agents?utm_source=agent-artifacts
