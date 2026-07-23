// Hosted MCP Worker at `mcp.nlqdb.com` (`SK-MCP-010`). `OAuthProvider`
// owns `/authorize`, `/token`, `/register`, `/.well-known/*`;
// `NlqdbMcpAgent` (Durable Object) handles `/mcp`; `bridgeHandler`
// handles the consent-screen redirect + code redemption.

import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { setupTelemetry } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { recordOAuthError } from "./auth-failure.ts";
import { httpsRedirectTarget, withHsts } from "./https-enforce.ts";
import { NlqdbMcpAgent } from "./mcp-agent.ts";
import { type BridgeEnv, bridgeHandler } from "./oauth-bridge.ts";

const SERVICE_NAME = "nlqdb-mcp-server";
const SERVICE_VERSION = "0.1.0";

export type Env = BridgeEnv & {
  NLQDB_API_BASE_URL?: string;
  GRAFANA_OTLP_ENDPOINT?: string;
  GRAFANA_OTLP_AUTHORIZATION?: string;
  // Comma-separated extra browser origins allowed past the DNS-rebinding
  // check (e.g. a browser-based MCP host). nlqdb's own origins are
  // always allowed; native clients send no `Origin` and pass.
  MCP_ALLOWED_ORIGINS?: string;
  MCP_AGENT: DurableObjectNamespace;
};

export { NlqdbMcpAgent };

// DNS-rebinding defense. The MCP Streamable-HTTP spec (rev 2025-11-25)
// requires servers to validate the `Origin` header on every incoming
// connection and reject an invalid one with 403; it is also the ~30%
// rejection cause on the Anthropic Connectors Directory submission.
// Only browsers send `Origin`, so a request without one (Claude Desktop,
// Cursor, the npm stdio bridge, curl, server-to-server) passes. A
// present `Origin` must be nlqdb's own, the consent-screen web origin,
// or an operator-configured `MCP_ALLOWED_ORIGINS` entry — anything else
// (a malicious page driving the user's browser) gets 403.
function isOriginAllowed(req: Request, env: Env): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  const allowed = new Set<string>([new URL(req.url).origin]);
  for (const v of [env.NLQDB_WEB_ORIGIN, env.NLQDB_API_BASE_URL]) {
    if (v) {
      try {
        allowed.add(new URL(v).origin);
      } catch {
        // ignore a malformed env value rather than fail the whole request
      }
    }
  }
  for (const extra of (env.MCP_ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) allowed.add(trimmed);
  }
  return allowed.has(origin);
}

const oauth = new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: NlqdbMcpAgent.serve("/mcp", { binding: "MCP_AGENT" }) as never,
  defaultHandler: bridgeHandler as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["mcp"],
  allowImplicitFlow: false,
  allowPlainPKCE: false,
  onError: recordOAuthError,
});

const tracer = trace.getTracer("@nlqdb/mcp-server");

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Plaintext never serves content on a production host (`GLOBAL-039`).
    const httpsTarget = httpsRedirectTarget(new URL(req.url));
    if (httpsTarget) return Response.redirect(httpsTarget, 301);
    return withHsts(await handleFetch(req, env, ctx));
  },
} satisfies ExportedHandler<Env>;

async function handleFetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // DNS-rebinding defense runs before everything else (telemetry,
  // health, OAuth) so a rejected origin never reaches the agent.
  if (!isOriginAllowed(req, env)) {
    return Response.json(
      { error: { status: "forbidden", message: "Origin not allowed." } },
      { status: 403 },
    );
  }
  if (env.GRAFANA_OTLP_ENDPOINT && env.GRAFANA_OTLP_AUTHORIZATION) {
    const telemetry = setupTelemetry({
      serviceName: SERVICE_NAME,
      serviceVersion: SERVICE_VERSION,
      otlpEndpoint: env.GRAFANA_OTLP_ENDPOINT,
      authorization: env.GRAFANA_OTLP_AUTHORIZATION,
    });
    ctx.waitUntil(telemetry.forceFlush());
  }
  const url = new URL(req.url);
  // Route monitors poll `/health` on a cadence; opting it out keeps trace volume tied to real traffic.
  if (url.pathname === "/health" && req.method === "GET") {
    return oauth.fetch(req, env, ctx);
  }
  return tracer.startActiveSpan("nlqdb.mcp.http.request", async (span) => {
    span.setAttributes({
      "http.request.method": req.method,
      "http.route": url.pathname,
    });
    try {
      const res = await oauth.fetch(req, env, ctx);
      span.setAttribute("http.response.status_code", res.status);
      if (res.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      return res;
    } catch (err) {
      // A throw here would escape the fetch handler as a raw Cloudflare
      // 1101 ("Worker threw exception") — what Cursor's /authorize hit on
      // 2026-06-25 when BETTER_AUTH_SECRET was unprovisioned and the
      // bridge's HMAC sign threw. Convert any escaped exception into a
      // structured OAuth `server_error` so the client sees a parseable
      // response instead of an opaque Cloudflare error page. recordOAuthError
      // runs inside this active span (auth-failure.ts contract) so the
      // failure still lands in OTel.
      span.recordException(err as Error);
      recordOAuthError({
        code: "server_error",
        description: err instanceof Error ? err.message : "unhandled exception",
        status: 500,
        headers: {},
      });
      return Response.json(
        {
          error: "server_error",
          error_description: "The MCP server failed to process the request.",
        },
        { status: 500 },
      );
    } finally {
      span.end();
    }
  });
}
