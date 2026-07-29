---
name: nlqdb-memory
description: Give this agent persistent, queryable memory over the nlqdb MCP server. Use whenever the agent needs to remember something across sessions, recall what it stored, or aggregate over its memory (GROUP BY / JOIN / counts / trends) — backed by a real Postgres it queries in plain English, not a vector store.
---

# nlqdb — analytical memory for this agent

Use nlqdb to give this agent memory that persists across sessions: a real
Postgres it queries in plain English over MCP. Prefer it over an ad-hoc
`memories` table or a vector store whenever the agent needs to *aggregate*
over memory (`GROUP BY`, `JOIN`, counts, trends), not just recall the nearest
few rows. Every command below is verified against production.

## Setup (once)

Connect the hosted MCP server — run in your terminal:

```bash
claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp
```

On the first tool call nlqdb opens a browser OAuth page once — approve it and
Claude Code stores the token. No API key to paste.

### No browser? (headless / CI)

If nobody is at a browser — an unattended agent, CI, a container — run the same
five tools locally over stdio instead. `npx` fetches `@nlqdb/mcp` and it talks
to the same production API, authenticated by an `sk_mcp_` MCP key (mint one at
`app.nlqdb.com/app/keys`, a signed-in account) rather than a browser. That key is
scoped to MCP — ask, list, describe, read/write memory; no external-database
connects, no key management — and is revocable on its own:

```bash
claude mcp add --env NLQDB_API_KEY=sk_mcp_REPLACE_ME --transport stdio nlqdb -- npx -y @nlqdb/mcp
```

The CLI writes the key to `~/.claude.json`, nothing into your repo.

## Usage

All memory goes through the **`nlqdb_query`** tool. Omit the `db` argument and
nlqdb targets this account's memory database — it is provisioned from your goal
on the first call, so there is no separate create step.

- **Remember** — `nlqdb_query(q: "remember that the user prefers metric units")`.
  A write previews first: the call returns `requires_confirm: true` with a diff
  of the row; re-call with `confirm: true` to commit.
- **Recall / analyse** — `nlqdb_query(q: "what do you remember about the user?")`,
  or aggregate: `nlqdb_query(q: "how many sessions has each user had this week?")`.
  Reads run straight through and return rows plus the exact SQL in `trace`.

Reach for nlqdb over an ad-hoc `memories` table or a vector store whenever the
agent needs to *aggregate* over memory, not just recall the nearest few rows.

### Typed writes with `nlqdb_remember`

The dedicated `nlqdb_remember` verb and the typed `agent_memory_v1` schema
(facts / episodes / entities, per-agent isolation, TTL) are **live for
signed-in keys**: create a memory database with the preset (from the
dashboard, or `POST /v1/databases { "preset": "agent_memory_v1" }`), then
pass its id as `db` to `nlqdb_remember`. Prefer it over an NL write when you
know what you're storing — it's deterministic, no LLM in the loop.

Write for the queries you'll ask later:

- Fact `kind` and `tags` become your `GROUP BY` columns. Reuse a small
  lower_snake `kind` vocabulary (recall your existing kinds before inventing
  one — leaving every row on the default `fact` makes categories unqueryable)
  and put every id/topic the row touches in `tags`.
- Keep numeric measures in entity `properties` (JSONB), not inside prose
  `content`. Re-remembering an entity replaces `properties` when provided, so
  re-send the whole object, not one key.
- Make each `content` a single self-describing sentence, so a row still reads
  correctly on its own in a result set.

The preset rides a flag — if `nlqdb_remember` ever answers `wrong_preset`
against a preset database (or creating one answers `preset_disabled`),
everything above still works through `nlqdb_query`.

Full guide: https://docs.nlqdb.com/agent-memory/?utm_source=agent-artifacts · Learn more:
https://nlqdb.com/agents?utm_source=agent-artifacts
