#!/usr/bin/env node
import { runStdio } from "@nlqdb/mcp";

runStdio().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`@nlqdb/mcp: fatal: ${message}\n`);
  if (process.env.NLQDB_MCP_DEBUG && err instanceof Error && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(1);
});
