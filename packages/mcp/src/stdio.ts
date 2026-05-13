// Stdio transport entry point. Slice 2 of `SK-MCP-010` — local MCP
// server running as a child process of the host (Claude Desktop,
// Cursor, etc. spawn it via `command: "npx", args: ["@nlqdb/mcp"]`
// from their config file, see `SK-MCP-008`).
//
// Auth precedence (`SK-MCP-006` open-question closure):
//   env NLQDB_API_KEY > host-config-passed env > device key on keychain
// In this slice only the env-var path exists; keychain lookup lands
// with the CLI (slice 4 in `cli/FEATURE.md`).

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@nlqdb/sdk";
import { createServer } from "./server.ts";

// Mirror of `package.json#version`. Update in lockstep on every
// release. Hand-maintaining keeps Node 20-22, Bun, and the tsc
// build pipeline aligned without import-attribute portability gotchas.
const PACKAGE_NAME = "@nlqdb/mcp";
const PACKAGE_VERSION = "0.0.0";

export type StdioOptions = {
  // Override of `process.env.NLQDB_API_KEY` for tests. Production
  // reads from the parent process's env (the host injects it via
  // the config file's `env` block — see `SK-MCP-008`).
  apiKey?: string;
  // Base URL override; defaults to the SDK's default. Tests and
  // self-hosted deployments set this.
  baseUrl?: string;
};

// Accepted key prefixes per `api-keys/FEATURE.md` + `SK-MCP-004`.
// `pk_live_` works today; `sk_live_` + `sk_mcp_` land with slice 1.
// `nlqdb_` reserved for any future shape.
const KEY_PREFIXES = ["pk_live_", "sk_live_", "sk_mcp_", "nlqdb_"];

export async function runStdio(opts: StdioOptions = {}): Promise<void> {
  const apiKey = opts.apiKey ?? process.env["NLQDB_API_KEY"];

  if (!apiKey) {
    // Fail loudly on stderr (the host's logs capture this). One
    // sentence + one next action per `GLOBAL-012`.
    process.stderr.write(
      '@nlqdb/mcp: NLQDB_API_KEY is not set. Run `nlq mcp install` or pass `env: { NLQDB_API_KEY: "…" }` in the host config.\n',
    );
    process.exit(1);
  }

  const looksValid = KEY_PREFIXES.some((p) => apiKey.startsWith(p));
  if (!looksValid) {
    // Early-fail on a typo before any tool call. We don't print the
    // observed key (sensitive) — only its prefix (first 8 chars or
    // up to first underscore) so a user debugging a stray newline /
    // quote in their config can locate the problem.
    const preview = apiKey.slice(0, Math.min(8, apiKey.length));
    process.stderr.write(
      `@nlqdb/mcp: NLQDB_API_KEY has an unexpected prefix (saw '${preview}…'). Expected one of: ${KEY_PREFIXES.join(", ")}. Check the host config for stray quotes or whitespace.\n`,
    );
    process.exit(1);
  }

  const client = createClient({
    apiKey,
    ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
  });

  const server = createServer({
    client,
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
