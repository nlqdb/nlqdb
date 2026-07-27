import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@nlqdb/sdk";
import { createServer } from "./server.ts";

// A literal, not a JSON import — import attributes aren't portable across the Node, Bun and Workers
// runtimes this module loads in. `scripts/sync-source-versions.mjs` rewrites it during
// `changeset version`; a unit test pins it to package.json#version so the two can't drift silently.
const PACKAGE_NAME = "@nlqdb/mcp";
export const PACKAGE_VERSION = "0.1.0";

const KEY_PREFIXES = ["pk_live_", "sk_live_", "sk_mcp_", "nlqdb_"];

export type StdioOptions = {
  apiKey?: string;
  baseUrl?: string;
};

export async function runStdio(opts: StdioOptions = {}): Promise<void> {
  const apiKey = opts.apiKey ?? process.env["NLQDB_API_KEY"];

  if (!apiKey) {
    process.stderr.write(
      // Names sk_live_ because that is the one a user can mint themselves; sk_mcp_ is OAuth-mint-only (SK-APIKEYS-009).
      "@nlqdb/mcp: NLQDB_API_KEY is not set. Easiest: point your host at the hosted server (https://mcp.nlqdb.com/mcp — OAuth, no key needed). For local stdio, create an sk_live_ key at https://app.nlqdb.com/app/keys and set env NLQDB_API_KEY in the host config.\n",
    );
    process.exit(1);
  }

  if (!KEY_PREFIXES.some((p) => apiKey.startsWith(p))) {
    // Print only the prefix (never the full key) so a user can spot a stray quote/whitespace without leaking the secret to logs.
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
