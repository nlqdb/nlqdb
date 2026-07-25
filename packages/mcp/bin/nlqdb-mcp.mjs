#!/usr/bin/env node
import { existsSync } from "node:fs";

// Bun loads the TypeScript source directly, so in-workspace the FLOW-005 stdio
// walker exercises fresh source with no build step; everything else loads the
// bundled `dist/`. The probe targets `stdio.ts` because npm force-packs the
// `main` file (`src/index.ts`) into the tarball without its imports — so a
// tarball run under bun must take the `dist/` path too.
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
