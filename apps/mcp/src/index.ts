// Hosted MCP Worker at `mcp.nlqdb.com` (`SK-MCP-010` slice 3b).
// `OAuthProvider` owns `/authorize`, `/token`, `/register`,
// `/.well-known/*`; `NlqdbMcpAgent` (Durable Object) handles `/mcp`;
// `bridgeHandler` handles the consent-screen redirect + code redemption.

import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { setupTelemetry } from "@nlqdb/otel";
import { NlqdbMcpAgent } from "./mcp-agent.ts";
import { type BridgeEnv, bridgeHandler } from "./oauth-bridge.ts";

const SERVICE_VERSION = "0.1.0";

export type Env = BridgeEnv & {
  NLQDB_API_BASE_URL?: string;
  GRAFANA_OTLP_ENDPOINT?: string;
  GRAFANA_OTLP_AUTHORIZATION?: string;
  MCP_AGENT: DurableObjectNamespace;
};

// Wrangler's `[[durable_objects.bindings]]` resolves the class by name from the Worker's exports.
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
});

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
    // TODO(slice 3c): OAuthProvider's 401/403 rejections never enter an OTel span.
    return oauth.fetch(req, env, ctx);
  },
} satisfies ExportedHandler<Env>;
