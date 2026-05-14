// Hosted MCP Worker — `mcp.nlqdb.com` connector URL per `SK-MCP-001`'s
// happy-path walkthrough. Slice 3a of `SK-MCP-010`:
//
//   • Streamable-HTTP transport (`SK-MCP-007`) at the `/mcp` route.
//   • Bearer auth at the protocol boundary — see `./bearer-gate.ts`.
//     Auth-of-record stays in `apps/api/`; this Worker forwards via
//     `@nlqdb/sdk` per `SK-MCP-005` + `SK-MCP-007`.
//   • Per-request fresh `McpServer` + transport. The SDK's stateless
//     mode requires this — sharing instances across requests can leak
//     one client's response stream to another. No Durable Objects in
//     3a; promote to `McpAgent` in slice 3b.
//   • Three tools (`nlqdb_query`, `nlqdb_list_databases`,
//     `nlqdb_describe`) come from `@nlqdb/mcp`'s transport-agnostic
//     dispatcher per `SK-MCP-002`. Adding tools here fails review —
//     register in `packages/mcp/src/tools.ts`.
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
import { requireBearer } from "./bearer-gate.ts";

const SERVICE_VERSION = "0.1.0";
const SERVER_NAME = "@nlqdb/mcp-server";

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

    if (req.method === "OPTIONS") return preflight(req);

    const url = new URL(req.url);
    // Liveness probe — no auth, no MCP. Lets the route monitor + CI
    // smoke tests confirm the Worker is up without burning bearer
    // credentials.
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404 });

    const auth = requireBearer(req);
    if ("err" in auth) return auth.err;
    const bearer = auth.ok;

    // TODO(slice 3c): auth-failure paths above this line never enter a
    // span, so probe / misconfigured-key traffic is invisible to OTel.
    // Add a pre-gate counter (or start the span before requireBearer
    // and tag failures) when rate-limit + observability hardening lands.
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
        // JSON-RPC envelope for transport failures — a bare 500 would
        // render as "tool unavailable" in the host. -32603 is the
        // JSON-RPC reserved `internal_error` code.
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

  const server = createNlqMcpServer({ client, name: SERVER_NAME, version: SERVICE_VERSION });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  const { req: nodeReq, res: nodeRes } = toReqRes(req);
  try {
    await server.connect(transport);
    // Clone before reading the body: `toReqRes(req)` may attach to
    // `req.body`'s ReadableStream lazily, and a direct `req.json()` on
    // the original `Request` after that attachment risks
    // `TypeError: Body has already been read`. Cloning tees the stream
    // so both copies are independently readable. The body is JSON-RPC
    // (small), so the tee allocation is negligible.
    const body: unknown = await req.clone().json();
    await transport.handleRequest(nodeReq, nodeRes, body);
    return toFetchResponse(nodeRes);
  } finally {
    // Best-effort cleanup so isolates don't accumulate transports.
    void transport.close?.().catch(() => {});
    void server.close?.().catch(() => {});
  }
}

function preflight(req: Request): Response {
  // Echoing the request origin (or `*` fallback) is correct for the
  // current slice — every request is bearer-authenticated; no cookies,
  // no credentials.
  // TODO(slice 3b): when `workers-oauth-provider` adds credentialed
  // flows (OAuth session cookies on the authorize/callback routes),
  // CORS-spec forbids `Access-Control-Allow-Origin: *` for credentialed
  // requests. Replace this with an allow-list keyed off the OAuth
  // client registry when slice 3b lands.
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

function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json; charset=utf-8" };
}
