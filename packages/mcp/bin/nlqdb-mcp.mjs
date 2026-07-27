#!/usr/bin/env node
import { existsSync } from "node:fs";

// Bun loads the TypeScript source directly, so in-workspace the FLOW-005 stdio
// walker exercises fresh source with no build step; everything else — including
// a published tarball under bun, where `files` packs no `src/` — loads `dist/`.
const source = new URL("../src/stdio.ts", import.meta.url);
const { runStdio } = await (globalThis.Bun !== undefined && existsSync(source)
  ? import(source.href)
  : import("../dist/index.js"));

runStdio().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`@nlqdb/mcp: fatal: ${message}\n`);
  if (process.env.NLQDB_MCP_DEBUG && err instanceof Error && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(1);
});
