#!/usr/bin/env node
// Local-stdio MCP server entry. Slice 2 of `SK-MCP-010`.
//
// Host launches us as a child process (e.g. Claude Desktop spawns
// `npx @nlqdb/mcp`). We read `NLQDB_API_KEY` from the env injected
// by the host's config file (see `SK-MCP-008` for the per-host
// config-path map), connect to stdio, and serve the three
// `SK-MCP-002` tools.

import { runStdio } from "@nlqdb/mcp";

runStdio().catch((err) => {
  process.stderr.write(`@nlqdb/mcp: fatal: ${err?.message ?? err}\n`);
  process.exit(1);
});
