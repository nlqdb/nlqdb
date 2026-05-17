# P2 — The Agent Builder

> Canonical persona definition: [`docs/research/personas.md`](../../../docs/research/personas.md#p2--the-agent-builder)

**Real-life journey (Jordan, building a research agent with Claude Desktop):**

1. Runs `nlq mcp install` — the CLI detects Claude Desktop's config path and writes the `nlqdb` MCP server entry.
2. Restarts Claude Desktop. The `nlqdb_create_database`, `nlqdb_query`, `nlqdb_list_databases` tools appear in the agent's tool palette.
3. At session start the agent calls `nlqdb_create_database("session_abc123")` and begins storing structured rows (claims, sources, user corrections).
4. The agent calls `nlqdb_query("session_abc123", "find claims about climate change with weak sources")` mid-session and gets back rows + an SQL trace.
5. At session end the agent either calls `nlqdb_delete_database` (drop) or leaves it (persist).

This is the "[Phase 1 success](../../../docs/research/personas.md#p2--the-agent-builder) — MCP server is installed in 3+ agent products and the #1 use case in our logs is 'agent giving itself memory'" path.

## Surface coverage matrix

| Step | Surface | Runner | File |
|------|---------|--------|------|
| 1 — `nlq mcp detect` enumerates installed hosts; `nlq mcp install` errors gracefully (today's pre-device-flow state) | CLI | Go `testscript` | [`tests/e2e/cli/scripts/p2_mcp_detect.txtar`](../../e2e/cli/scripts/p2_mcp_detect.txtar) |
| 2 — `nlqdb` MCP server exposes the three tools (SK-MCP-002) | MCP | Inspector headless + in-memory transport | [`tests/e2e/mcp/p2_agent_tools.test.ts`](../../e2e/mcp/p2_agent_tools.test.ts) |
| 3 — `nlqdb_create_database` creates an isolated DB | MCP | Inspector + cassette | [`tests/e2e/mcp/p2_agent_tools.test.ts`](../../e2e/mcp/p2_agent_tools.test.ts) |
| 4 — `nlqdb_query` returns rows + trace | MCP | Inspector + cassette | [`tests/e2e/mcp/p2_agent_tools.test.ts`](../../e2e/mcp/p2_agent_tools.test.ts) |
| 4 — trace pane carries the SQL the agent emitted (GLOBAL-023) | MCP | Inspector + cassette | [`tests/e2e/mcp/p2_agent_tools.test.ts`](../../e2e/mcp/p2_agent_tools.test.ts) |
| 5 — MCP tool errors are one-sentence + next-action (GLOBAL-012) | MCP | Inspector + cassette | [`tests/e2e/mcp/p2_agent_tools.test.ts`](../../e2e/mcp/p2_agent_tools.test.ts) |

## GLOBALs this journey verifies end-to-end

- **GLOBAL-008** (one Better Auth identity) — the same API key bound to Jordan works across CLI + MCP.
- **GLOBAL-010** (keychain credentials) — `nlq mcp install` does not embed the secret in the MCP config; it lives in the keychain, surfaced via env (`NLQDB_API_KEY`).
- **GLOBAL-012** (one-sentence errors) — MCP tool errors are short + actionable.
- **GLOBAL-017** (one way to do each thing) — three tools, not thirty.
- **GLOBAL-023** (trust-UX baseline) — SQL trace shipped on every reply so the agent can audit itself.

## How to run just this persona

```bash
gh workflow run e2e.yml -f surface=cli
gh workflow run e2e.yml -f surface=mcp
```
