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

export type StdioOptions = {
  // Override of `process.env.NLQDB_API_KEY` for tests. Production
  // reads from the parent process's env (the host injects it via
  // the config file's `env` block — see `SK-MCP-008`).
  apiKey?: string;
  // Base URL override; defaults to `https://api.nlqdb.com`. Tests
  // and self-hosted deployments set this.
  baseUrl?: string;
};

export async function runStdio(opts: StdioOptions = {}): Promise<void> {
  const apiKey = opts.apiKey ?? process.env["NLQDB_API_KEY"];
  if (!apiKey) {
    // Fail loudly on stderr (the host's logs capture this); the
    // host LLM never sees stderr, but the user debugging an install
    // does. One sentence + one next action per `GLOBAL-012`.
    process.stderr.write(
      '@nlqdb/mcp: NLQDB_API_KEY is not set. Run `nlq mcp install` or pass `env: { NLQDB_API_KEY: "…" }` in the host config.\n',
    );
    process.exit(1);
  }

  const client = createClient({
    apiKey,
    ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
  });

  const server = createServer({ client });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
