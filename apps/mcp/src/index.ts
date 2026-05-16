// Hosted MCP Worker at `mcp.nlqdb.com` (`SK-MCP-010`). `OAuthProvider`
// owns `/authorize`, `/token`, `/register`, `/.well-known/*`;
// `NlqdbMcpAgent` (Durable Object) handles `/mcp`; `bridgeHandler`
// handles the consent-screen redirect + code redemption.

import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { setupTelemetry } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { recordOAuthError } from "./auth-failure.ts";
import { NlqdbMcpAgent } from "./mcp-agent.ts";
import { type BridgeEnv, bridgeHandler } from "./oauth-bridge.ts";

const SERVICE_NAME = "nlqdb-mcp-server";
const SERVICE_VERSION = "0.1.0";

export type Env = BridgeEnv & {
  NLQDB_API_BASE_URL?: string;
  GRAFANA_OTLP_ENDPOINT?: string;
  GRAFANA_OTLP_AUTHORIZATION?: string;
  MCP_AGENT: DurableObjectNamespace;
};

export { NlqdbMcpAgent };

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
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    });
  },
} satisfies ExportedHandler<Env>;
