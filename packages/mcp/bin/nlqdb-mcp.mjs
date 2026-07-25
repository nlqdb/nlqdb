#!/usr/bin/env node
// Entrypoint for both worlds, keyed on the runtime because that is what
// actually differs: bun reads the TypeScript source directly, node cannot.
// In-workspace the FLOW-005 stdio walker spawns this under bun, so it always
// exercises fresh source with no build step. A published tarball is run by node
// via `npx` — and npm ignores `publishConfig` main/exports overrides (a
// pnpm-only feature), so the package's own entrypoint still points at `src/`
// there. Load the bundled `dist/` that ships in the same tarball instead.
const { runStdio } =
  globalThis.Bun === undefined ? await import("../dist/index.js") : await import("@nlqdb/mcp");

runStdio().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`@nlqdb/mcp: fatal: ${message}\n`);
  if (process.env.NLQDB_MCP_DEBUG && err instanceof Error && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
  process.exit(1);
});
