import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { NlqClient } from "@nlqdb/sdk";
import { trace } from "@opentelemetry/api";
import type { z } from "zod";
import {
  type DescribeInput,
  type DescribeOutput,
  describeInputShape,
  type HandlerContext,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  type ListDatabasesOutput,
  listDatabasesInputShape,
  type QueryInput,
  type QueryOutput,
  queryInputShape,
  type ToolError,
  type ToolResult,
} from "./tools.ts";

export type ServerOptions = {
  client: NlqClient;
  name?: string;
  version?: string;
  maxRowsInResponse?: number;
  listDatabasesCacheTtlMs?: number;
};

const DEFAULT_MAX_ROWS = 200;
const DEFAULT_LIST_CACHE_TTL_MS = 5000;

// Minimal shape of the SDK's tool-handler `extra` arg — only fields we touch.
type ToolExtra = { signal?: AbortSignal };

// Non-recursive signature for `server.registerTool` — see the bind
// cast inside `createServer` for the rationale.
type ToolResponse = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};
// biome-ignore lint/suspicious/noExplicitAny: caller-narrowed via the per-handler `args: SpecificType` annotation
type ToolHandler = (args: any, extra: ToolExtra) => Promise<ToolResponse>;
type ToolDef = {
  title?: string;
  description?: string;
  inputSchema?: Record<string, z.ZodTypeAny>;
  annotations?: ToolAnnotations;
};
type RegisterTool = (name: string, def: ToolDef, handler: ToolHandler) => void;

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
  const listCache = createListDatabasesCache(client, listDatabasesCacheTtlMs);
  // SDK 1.29's `registerTool` is a deeply-generic overload set that
  // trips TS2589 when its inference walks our zod shapes (the
  // `.describe()` chains return `ZodEffects`). One cast at the binding
  // skips the recursion; runtime semantics are unchanged.
  const registerTool = server.registerTool.bind(server) as unknown as RegisterTool;

  registerTool(
    "nlqdb_query",
    {
      title: "Query your agent's memory in natural language",
      description:
        "Query your agent's structured memory in natural language — a real database it can GROUP BY / JOIN / aggregate over, not just recall. Returns rows + the compiled SQL (in trace). The database is materialised on first reference — no separate create tool. Destructive plans return requires_confirm: true + a diff; re-call with confirm: true to commit.",
      inputSchema: queryInputShape,
      // SK-MCP-002 — static hint is the worst case (read+write); runtime `requires_confirm` is the real gate.
      annotations: { destructiveHint: true },
    },
    async (args: QueryInput, extra: ToolExtra) => {
      return runTool("nlqdb_query", extra.signal, async (ctx) => {
        const result = await handleQuery(client, args, ctx);
        return formatQueryResult(result, maxRowsInResponse);
      });
    },
  );

  registerTool(
    "nlqdb_list_databases",
    {
      title: "List your agent's memory databases",
      description:
        "List the memory databases your agent can query, scoped to the authenticated user. Requires a user-scoped key (sk_live_ or sk_mcp_). Returns engine per row.",
      inputSchema: listDatabasesInputShape,
      annotations: { readOnlyHint: true },
    },
    async (_args: unknown, extra: ToolExtra) => {
      return runTool("nlqdb_list_databases", extra.signal, async (ctx) => {
        const result = await handleListDatabases(client, ctx);
        return formatResult<ListDatabasesOutput>(result);
      });
    },
  );

  registerTool(
    "nlqdb_describe",
    {
      title: "Describe one memory database",
      description:
        "Inspect the shape of one of your agent's memory databases. Return schema metadata (slug, engine, schema name) for one database. Requires a user-scoped key (sk_live_ or sk_mcp_).",
      inputSchema: describeInputShape,
      annotations: { readOnlyHint: true },
    },
    async (args: DescribeInput, extra: ToolExtra) => {
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

// GLOBAL-014: one span per external-call boundary; no-op when no exporter is registered.
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

export type ListDatabasesCache = {
  get: () => Promise<{ databases: Awaited<ReturnType<NlqClient["listDatabases"]>>["databases"] }>;
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
