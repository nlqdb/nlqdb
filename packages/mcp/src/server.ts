// MCP server factory. Registers the three `SK-MCP-002` tools against
// a `NlqClient` and returns an `McpServer` ready to attach to a
// transport (stdio in slice 2; Streamable-HTTP in slice 3).
//
// `SK-MCP-007`: the same `handleTool` core feeds both transports —
// no transport-specific logic lives in this file. Transport modules
// (`stdio.ts`, future `streamable-http.ts`) only wire I/O.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NlqClient } from "@nlqdb/sdk";
import {
  describeInputShape,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  listDatabasesInputShape,
  queryInputShape,
  type ToolError,
  type ToolResult,
} from "./tools.ts";

export type ServerOptions = {
  client: NlqClient;
  // Override the advertised server name (mostly for tests). Default:
  // "@nlqdb/mcp" — the npm package name is what shows up in host
  // diagnostics so user-visible names stay aligned.
  name?: string;
  version?: string;
};

export function createServer(opts: ServerOptions): McpServer {
  const { client, name = "@nlqdb/mcp", version = "0.0.0" } = opts;

  const server = new McpServer({ name, version });

  server.registerTool(
    "nlqdb_query",
    {
      title: "Query a database in natural language",
      description:
        "Run a natural-language query against an nlqdb database. Returns rows, row count, and the compiled SQL (in trace). The database is materialised on first reference — no separate create step.",
      inputSchema: queryInputShape,
    },
    async (args) => formatResult(await handleQuery(client, args)),
  );

  server.registerTool(
    "nlqdb_list_databases",
    {
      title: "List the user's databases",
      description:
        "Enumerate databases visible to the authenticated user. Requires a user-scoped key (sk_live_ or sk_mcp_).",
      inputSchema: listDatabasesInputShape,
    },
    async () => formatResult(await handleListDatabases(client)),
  );

  server.registerTool(
    "nlqdb_describe",
    {
      title: "Describe one database",
      description:
        "Return schema metadata (slug, engine, schema name) for one database. Requires a user-scoped key (sk_live_ or sk_mcp_).",
      inputSchema: describeInputShape,
    },
    async (args) => formatResult(await handleDescribe(client, args)),
  );

  return server;
}

// `SK-MCP-006`: a typed tool error surfaces to the host LLM as one
// sentence + one next action so the agent can act on it. Success
// payloads ride `structuredContent` (and a JSON text mirror so hosts
// that don't render structured content still see something useful).
export function formatResult<T>(result: ToolResult<T>): {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
} {
  if ("err" in result) {
    return formatError(result.err);
  }
  const json = JSON.stringify(result.ok, null, 2);
  return {
    content: [{ type: "text", text: json }],
    structuredContent: result.ok as Record<string, unknown>,
  };
}

export function formatError(err: ToolError): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `${err.message} ${err.action}`,
      },
    ],
  };
}
