#!/usr/bin/env node
// Local-stdio MCP server entry. Slice 2 of `SK-MCP-010`.
//
// Host launches us as a child process (e.g. Claude Desktop spawns
// `npx @nlqdb/mcp`). We read `NLQDB_API_KEY` from the env injected
// by the host's config file (see `SK-MCP-008`), connect to stdio,
// and serve the three `SK-MCP-002` tools.
//
// Dev (monorepo): runs under Bun (`bun packages/mcp/bin/nlqdb-mcp.mjs`)
//   because `main` points at `src/index.ts` for in-repo consumers.
// Publish: `publishConfig.main` flips `main` to `dist/index.js` so
//   `node` / `npx` consumers load the bundled artifact built by
//   `bun run build`. The shebang stays `node` because that's what
//   hosts spawn.

import { runStdio } from "@nlqdb/mcp";

runStdio().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`@nlqdb/mcp: fatal: ${message}\n`);
  if (process.env.NLQDB_MCP_DEBUG && err instanceof Error && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(1);
});
