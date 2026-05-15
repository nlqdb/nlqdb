// Hosted MCP Worker at `mcp.nlqdb.com` — `SK-MCP-010` slice 3a.
// Forwards every tool call to `apps/api/` via `@nlqdb/sdk`; auth-of-
// record stays there (`SK-MCP-005` / `SK-MCP-007`). Tools come from
// `packages/mcp/src/tools.ts` via `createServer` — never register
// inline (`SK-MCP-002`). Per-request fresh `McpServer` + transport:
// SDK stateless mode forbids shared instances (response-stream leak);
// promote to `McpAgent` in 3b. Uses `fetch-to-node` because the SDK's
// Streamable-HTTP transport is Node-flavoured; `nodejs_compat` supplies.

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createNlqMcpServer } from "@nlqdb/mcp";
import { setupTelemetry } from "@nlqdb/otel";
import { createClient } from "@nlqdb/sdk";
import { trace } from "@opentelemetry/api";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { requireBearer } from "./bearer-gate.ts";
import { jsonRpcError } from "./jsonrpc.ts";

const SERVICE_VERSION = "0.1.0";
const SERVER_NAME = "@nlqdb/mcp-server";

// Advertise the full Streamable-HTTP method set for probing clients;
// stateless mode (`sessionIdGenerator: undefined`) only serves POST.
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
    // Unauthenticated liveness probe — route monitor + CI smoke.
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404 });

    const auth = requireBearer(req);
    if ("err" in auth) return auth.err;
    const bearer = auth.ok;

    // TODO(slice 3c): auth failures above never enter the span, so
    // probe traffic is invisible. Add a pre-gate counter with rate-limit.
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
        return jsonRpcError({ status: 500, code: -32603, message: "Internal MCP server error." });
      } finally {
        span.end();
      }
    });
  },
} satisfies ExportedHandler<Env>;

async function dispatch(req: Request, bearer: string, env: Env): Promise<Response> {
  // GET/DELETE are session-lifecycle (3b); stateless mode is POST-only.
  if (req.method !== "POST") {
    return jsonRpcError({
      status: 405,
      code: -32000,
      message: "Method not allowed in stateless mode. Use POST.",
      headers: { allow: "POST, OPTIONS" },
    });
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
    // Clone first — `toReqRes` may have already attached to `req.body`,
    // so `req.json()` on the original would throw "Body has already been read".
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
  // TODO(slice 3b): origin-echo is fine while no credentialed flows
  // exist. When workers-oauth-provider lands, switch to an allow-list
  // keyed off the OAuth client registry — `*` is banned with credentials.
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
