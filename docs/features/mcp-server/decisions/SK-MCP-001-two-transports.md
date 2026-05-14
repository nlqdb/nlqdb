# SK-MCP-001 — Two transports: hosted (default) and local stdio (npm fallback)

- **Decision:** The MCP server ships in two flavours. **Hosted at `mcp.nlqdb.com`** is the default — a Cloudflare Worker on Workers Free + Durable Objects (`McpAgent` class), OAuth-authenticated, paste-the-URL-into-the-host's-config install. **Local stdio via `npm @nlqdb/mcp`** is the fallback for offline / privacy-sensitive / CLI-everything workflows. Both share the same `/v1/ask` orchestration; neither holds DB credentials.
- **Core value:** Free, Effortless UX, Bullet-proof
- **Why:** Hosted gives "zero install, paste a URL" — the lowest-friction path on hosts that support MCP connectors (Claude Desktop *Connectors*, Cursor / Zed / Windsurf MCP settings). Local stdio is the escape hatch for users who refuse to send their queries through a hosted Worker. One transport would force every user into one tradeoff; two keeps the default frictionless and the escape hatch always available (`GLOBAL-015` energy applied to MCP).
- **Consequence in code:** `packages/mcp/` carries both transports behind a shared tool-handler core. The hosted Worker lives at `apps/api/` (or a sibling Worker) wired through the `McpAgent` Durable Object pattern. Each transport is independently testable; tool semantics are identical.
- **Alternatives rejected:**
  - Hosted only — cuts off the offline / privacy-sensitive segment of P2 (the Agent Builder).
  - Local only — every host requires `npx`, every update needs the user to bump a version; misses the "paste a URL" moment.
