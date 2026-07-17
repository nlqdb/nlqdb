# SK-PIVOT-003 — MCP tool + package descriptions carry the agent-memory framing

- **Decision:** The MCP server's tool descriptions, `title`s, and the
  `packages/mcp` npm description signal "analytical memory your agent can
  query" — because the MCP tool list is where an AI agent/host *discovers*
  what nlqdb is, and it currently says nothing about memory.
- **Core value:** Goal-first, Creative
- **Why:** When a host (Claude Desktop, Cursor, VS Code) lists nlqdb's tools,
  the one-line descriptions are the entire pitch to the agent. Today
  `nlqdb_query` reads "Run a natural-language query…" — accurate but invisible
  to the memory use case.
- **Consequence in code:** `packages/mcp/src/server.ts` tool `description`s
  gain a memory-shaped lead clause without losing the contract text (rows +
  compiled SQL, materialise-on-reference, `requires_confirm` diff);
  `package.json` + `mcp.mdx` match. Copy only, no behaviour/schema change.
  Read `mcp-server/FEATURE.md` first (GLOBAL-003 parity).
- **Alternatives rejected:** Rename tools to `nlqdb_remember`/`nlqdb_recall` —
  breaks `SK-MCP-002` + parity tests for cosmetic gain. · Leave generic —
  forfeits the highest-leverage agent-facing surface.
