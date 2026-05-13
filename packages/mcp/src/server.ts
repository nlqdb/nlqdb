// MCP server factory. Registers the three `SK-MCP-002` tools against
// a `NlqClient` and returns an `McpServer` ready to attach to a
// transport (stdio in slice 2; Streamable-HTTP in slice 3).
//
// `SK-MCP-007`: the same `handleTool` core feeds both transports —
// no transport-specific logic lives in this file. Transport modules
// (`stdio.ts`, future `streamable-http.ts`) only wire I/O.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NlqClient } from "@nlqdb/sdk";
import { trace } from "@opentelemetry/api";
import {
  type DescribeOutput,
  describeInputShape,
  describeOutputShape,
  type HandlerContext,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  type ListDatabasesOutput,
  listDatabasesInputShape,
  listDatabasesOutputShape,
  type QueryOutput,
  queryInputShape,
  queryOutputShape,
  type ToolError,
  type ToolResult,
} from "./tools.ts";

export type ServerOptions = {
  client: NlqClient;
  // Server identity reported in MCP `initialize`. Default name is the
  // npm package name; default version is "0.0.0" only as a fallback —
  // production callers (`stdio.ts`, slice-3 worker) pass the real
  // `package.json#version`.
  name?: string;
  version?: string;
  // Cap rows returned in a single `nlqdb_query` response to bound LLM
  // context cost. Default 200; surface the full count via
  // `totalRowCount` + `rowsTruncated: true`.
  maxRowsInResponse?: number;
  // `handleDescribe` memoises listDatabases by default to avoid an
  // O(N-describes) hit on `/v1/databases`. TTL in ms; default 5000.
  listDatabasesCacheTtlMs?: number;
};

const DEFAULT_MAX_ROWS = 200;
const DEFAULT_LIST_CACHE_TTL_MS = 5000;

const tracer = trace.getTracer("@nlqdb/mcp");

export function createServer(opts: ServerOptions): McpServer {
  const {
    client,
    name = "@nlqdb/mcp",
    version = "0.0.0",
    maxRowsInResponse = DEFAULT_MAX_ROWS,
    listDatabasesCacheTtlMs = DEFAULT_LIST_CACHE_TTL_MS,
  } = opts;

  const server = new McpServer({ name, version });

  // Per-server isolate cache for `listDatabases`. Keeps a multi-
  // `nlqdb_describe` agent loop from re-hitting the API on every
  // call (SK-MCP-009: low-RPS, but the API budget is finite).
  const listCache = createListDatabasesCache(client, listDatabasesCacheTtlMs);

  server.registerTool(
    "nlqdb_query",
    {
      title: "Query a database in natural language",
      description:
        "Run a natural-language query against an nlqdb database. Returns rows + the compiled SQL (in trace). The database is materialised on first reference — no separate create tool. Destructive plans return requires_confirm: true + a diff; re-call with confirm: true to commit.",
      inputSchema: queryInputShape,
      outputSchema: queryOutputShape,
    },
    async (args, extra) => {
      return runTool("nlqdb_query", extra.signal, async (ctx) => {
        const result = await handleQuery(client, args, ctx);
        return formatQueryResult(result, maxRowsInResponse);
      });
    },
  );

  server.registerTool(
    "nlqdb_list_databases",
    {
      title: "List the user's databases",
      description:
        "Enumerate databases visible to the authenticated user. Requires a user-scoped key (sk_live_ or sk_mcp_). Returns engine per row.",
      inputSchema: listDatabasesInputShape,
      outputSchema: listDatabasesOutputShape,
    },
    async (_args, extra) => {
      return runTool("nlqdb_list_databases", extra.signal, async (ctx) => {
        const result = await handleListDatabases(client, ctx);
        return formatResult<ListDatabasesOutput>(result);
      });
    },
  );

  server.registerTool(
    "nlqdb_describe",
    {
      title: "Describe one database",
      description:
        "Return schema metadata (slug, engine, schema name) for one database. Requires a user-scoped key (sk_live_ or sk_mcp_).",
      inputSchema: describeInputShape,
      outputSchema: describeOutputShape,
    },
    async (args, extra) => {
      return runTool("nlqdb_describe", extra.signal, async (ctx) => {
        const ctxWithCache: HandlerContext = {
          ...ctx,
          listDatabasesCached: listCache.get,
        };
        const result = await handleDescribe(client, args, ctxWithCache);
        return formatResult<DescribeOutput>(result);
      });
    },
  );

  return server;
}

// One OTel span per tool call (GLOBAL-014). Records `tool.name`,
// `duration_ms`, and an `error.code` on failure. No-op when no
// exporter is registered (local-stdio default; slice-3 Worker
// supplies one).
async function runTool<T>(
  toolName: string,
  signal: AbortSignal | undefined,
  body: (ctx: HandlerContext) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(`nlqdb.mcp.tool.invoke`, async (span) => {
    span.setAttribute("nlqdb.mcp.tool.name", toolName);
    try {
      const ctx: HandlerContext = signal ? { signal } : {};
      return await body(ctx);
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: 2, message: e.message });
      throw err;
    } finally {
      span.end();
    }
  });
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
  return {
    content: [{ type: "text", text: JSON.stringify(result.ok) }],
    structuredContent: result.ok as Record<string, unknown>,
  };
}

// `nlqdb_query` may emit very large `rows` arrays; cap at
// `maxRowsInResponse` to bound LLM context cost. The full count
// stays on `totalRowCount` + `rowsTruncated: true` so the agent
// knows to refine the query or page.
export function formatQueryResult(
  result: ToolResult<QueryOutput>,
  maxRows: number,
): {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
} {
  if ("err" in result) return formatError(result.err);

  const out = result.ok;
  if (out.rows.length > maxRows) {
    const capped: QueryOutput = {
      ...out,
      rows: out.rows.slice(0, maxRows),
      rowsTruncated: true,
      totalRowCount: out.rowCount,
      rowCount: maxRows,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(capped) }],
      structuredContent: capped as Record<string, unknown>,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(out) }],
    structuredContent: out as Record<string, unknown>,
  };
}

export function formatError(err: ToolError): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  // `\n\n→ ` separator renders cleanly across hosts; the LLM also
  // parses "→" as a directive consistently.
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `${err.message}\n\n→ ${err.action}`,
      },
    ],
  };
}

// Tiny in-process TTL cache for `listDatabases`. Reused across the
// `nlqdb_describe` tool invocations in one server-isolate; resets
// when the process is restarted. Exposed for testing.
export type ListDatabasesCache = {
  get: () => Promise<{ databases: Awaited<ReturnType<NlqClient["listDatabases"]>>["databases"] }>;
  // Force refresh (test helper).
  invalidate: () => void;
};

export function createListDatabasesCache(client: NlqClient, ttlMs: number): ListDatabasesCache {
  let cached: { value: Awaited<ReturnType<NlqClient["listDatabases"]>>; expiresAt: number } | null =
    null;

  return {
    async get() {
      const now = Date.now();
      if (cached && cached.expiresAt > now) return cached.value;
      const value = await client.listDatabases();
      cached = { value, expiresAt: now + ttlMs };
      return value;
    },
    invalidate() {
      cached = null;
    },
  };
}
