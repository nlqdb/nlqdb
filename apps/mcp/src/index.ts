// Hosted MCP Worker — `mcp.nlqdb.com` connector URL per `SK-MCP-001`'s
// happy-path walkthrough. Slice 3a of `SK-MCP-010`:
//
//   • Streamable-HTTP transport (`SK-MCP-007`) at the `/mcp` route.
//   • Bearer auth at the protocol boundary: `sk_live_` / `sk_mcp_` /
//     `pk_live_` per `SK-APIKEYS-001`. Auth-of-record stays in
//     `apps/api/` — this Worker forwards the bearer via `@nlqdb/sdk`
//     and lets `apps/api/` reject mismatched keys (`SK-MCP-005`'s
//     zero-driver rule + `SK-MCP-007`'s shared orchestration).
//   • Per-request fresh `McpServer` + transport. The SDK's stateless
//     mode requires this — sharing instances across requests can leak
//     one client's response stream to another. No Durable Objects in
//     3a; promote to `McpAgent` in slice 3b.
//   • Three tools (`nlqdb_query`, `nlqdb_list_databases`,
//     `nlqdb_describe`) come from `@nlqdb/mcp`'s transport-agnostic
//     dispatcher per `SK-MCP-002` and `SK-MCP-007`. Adding tools here
//     fails review — register in `packages/mcp/src/tools.ts`.
//
// The MCP SDK's `StreamableHTTPServerTransport` is Node-flavoured
// (it consumes `node:http` IncomingMessage / ServerResponse). The
// `fetch-to-node` adapter bridges Cloudflare's Fetch API request/
// response objects to that shape; `nodejs_compat` provides the
// `node:http` types at runtime. This matches the well-trodden
// `mhart/mcp-hono-stateless` pattern. The MCP SDK's
// `webStandardStreamableHttp` variant ships in newer SDK builds but
// requires a zod bump that's outside this slice's scope.

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createNlqMcpServer } from "@nlqdb/mcp";
import { setupTelemetry } from "@nlqdb/otel";
import { createClient } from "@nlqdb/sdk";
import { trace } from "@opentelemetry/api";
import { toFetchResponse, toReqRes } from "fetch-to-node";

const SERVICE_VERSION = "0.1.0";
const SERVER_NAME = "@nlqdb/mcp-server";

// Recognised bearer prefixes — `pk_live_` works for `nlqdb_query` only
// (read-only + origin-pinned per `SK-APIKEYS-003`); `sk_live_` and
// `sk_mcp_` unlock the full surface including `nlqdb_list_databases`
// and `nlqdb_describe` (`SK-MCP-004`). The shape check here is a fast
// reject for malformed bearers; the upstream API enforces revocation,
// scope, and origin.
const KEY_PREFIXES = ["sk_live_", "sk_mcp_", "pk_live_"] as const;

// CORS-allowed methods per the Streamable-HTTP transport spec. POST
// carries JSON-RPC requests; GET opens an SSE stream for
// server-initiated events; DELETE terminates a session. Stateless mode
// (`sessionIdGenerator: undefined`) effectively limits us to POST, but
// CORS advertises the full set for clients that probe.
const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";
const ALLOWED_HEADERS = "authorization, content-type, mcp-session-id, mcp-protocol-version";

interface Env {
  NLQDB_API_BASE_URL?: string;
  GRAFANA_OTLP_ENDPOINT?: string;
  GRAFANA_OTLP_AUTHORIZATION?: string;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (env.GRAFANA_OTLP_ENDPOINT && env.GRAFANA_OTLP_AUTHORIZATION) {
      const telemetry = setupTelemetry({
        serviceName: "nlqdb-mcp-server",
        serviceVersion: SERVICE_VERSION,
        otlpEndpoint: env.GRAFANA_OTLP_ENDPOINT,
        authorization: env.GRAFANA_OTLP_AUTHORIZATION,
      });
      ctx.waitUntil(telemetry.forceFlush());
    }

    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return preflight(req);
    }

    // Liveness probe — no auth, no MCP. Lets the route monitor + CI
    // smoke tests confirm the Worker is up without burning bearer
    // credentials.
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }

    // `SK-MCP-006` envelope shape: `{ code, message, action }`. The host
    // LLM surfaces `action` as the next-step instruction so the user
    // recovers without leaving the chat. We emit it as a JSON-RPC error
    // body alongside the 401 so MCP-spec clients see a structured
    // result, not a generic "tool unavailable".
    const bearer = extractBearer(req);
    if (!bearer) {
      return authRequired(
        "missing_bearer",
        "Missing Authorization: Bearer header.",
        "Mint a key at https://app.nlqdb.com/keys and configure it on this connector.",
      );
    }
    if (!KEY_PREFIXES.some((p) => bearer.startsWith(p))) {
      return authRequired(
        "bearer_prefix_unrecognised",
        "Bearer doesn't match a known nlqdb key prefix.",
        "Use a sk_live_, sk_mcp_, or pk_live_ key from https://app.nlqdb.com/keys.",
      );
    }

    const tracer = trace.getTracer(SERVER_NAME);
    return tracer.startActiveSpan("nlqdb.mcp.http.request", async (span) => {
      span.setAttribute("http.method", req.method);
      span.setAttribute("nlqdb.mcp.bearer_prefix", bearer.slice(0, 8));
      try {
        return await dispatch(req, bearer, env);
      } catch (err) {
        const e = err as Error;
        span.recordException(e);
        span.setStatus({ code: 2, message: e.message });
        // The MCP spec requires a JSON-RPC error envelope for transport
        // failures; a bare 500 would render as "tool unavailable" in the
        // host. `internal_error` matches the JSON-RPC reserved range.
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal MCP server error." },
            id: null,
          }),
          { status: 500, headers: jsonHeaders() },
        );
      } finally {
        span.end();
      }
    });
  },
} satisfies ExportedHandler<Env>;

async function dispatch(req: Request, bearer: string, env: Env): Promise<Response> {
  // Stateless mode only handles POST (one JSON-RPC request per call).
  // GET/DELETE are session-lifecycle methods for the stateful (3b)
  // path — surface 405 explicitly so clients fall back to POST instead
  // of polling a dead SSE stream.
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed in stateless mode. Use POST." },
        id: null,
      }),
      {
        status: 405,
        headers: { ...jsonHeaders(), allow: "POST, OPTIONS" },
      },
    );
  }

  const client = createClient({
    apiKey: bearer,
    ...(env.NLQDB_API_BASE_URL ? { baseUrl: env.NLQDB_API_BASE_URL } : {}),
  });

  // Fresh server + transport per request — stateless mode forbids
  // shared instances. Promote to a session-bound McpAgent (DO-backed)
  // in slice 3b.
  const server = createNlqMcpServer({ client, name: SERVER_NAME, version: SERVICE_VERSION });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  const { req: nodeReq, res: nodeRes } = toReqRes(req);
  try {
    await server.connect(transport);
    const body: unknown = await req.json();
    await transport.handleRequest(nodeReq, nodeRes, body);
    return toFetchResponse(nodeRes);
  } finally {
    // Best-effort cleanup so isolates don't accumulate transports.
    void transport.close?.().catch(() => {});
    void server.close?.().catch(() => {});
  }
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  return m ? (m[1] ?? null) : null;
}

function preflight(req: Request): Response {
  const origin = req.headers.get("origin") ?? "*";
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": ALLOWED_METHODS,
      "access-control-allow-headers": ALLOWED_HEADERS,
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });
}

function authRequired(code: string, message: string, action: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message, data: { code, action } },
      id: null,
    }),
    {
      status: 401,
      headers: {
        ...jsonHeaders(),
        "www-authenticate": 'Bearer realm="nlqdb-mcp"',
      },
    },
  );
}

function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json; charset=utf-8" };
}
