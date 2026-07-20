# nlqdb agent-memory artifacts

Drop one of these into your agent's repo and its coding agent (Claude Code,
Cursor, Codex) wires nlqdb memory and uses it correctly — a real Postgres it
queries in plain English over MCP, so it can `GROUP BY`/`JOIN`/aggregate over
what it remembered, not just recall the nearest few rows.

| File | Drop it at | For |
|------|-----------|-----|
| [`AGENTS.snippet.md`](AGENTS.snippet.md) | append to your repo's `AGENTS.md` | any agent that reads `AGENTS.md` (host-neutral) |
| [`nlqdb-memory.mdc`](nlqdb-memory.mdc) | `.cursor/rules/nlqdb-memory.mdc` | Cursor |
| [`codex-config.toml`](codex-config.toml) | merge into `~/.codex/config.toml` | Codex |

Every connect command in these files is generated from one source of truth
(`apps/web/src/lib/mcp-install.ts`) and pinned by a drift test
(`apps/web/src/lib/agent-artifacts.test.ts`), so they can never fall out of
sync with the endpoint nlqdb actually serves.

Full setup guide: <https://docs.nlqdb.com/agent-memory/>.
