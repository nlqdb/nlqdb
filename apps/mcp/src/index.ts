// Hosted MCP Worker — `mcp.nlqdb.com` connector URL. Slice 3b of `SK-MCP-010`:
// `OAuthProvider` from `@cloudflare/workers-oauth-provider` owns `/authorize`,
// `/token`, `/register`, `/.well-known/*` (`SK-MCP-011` dynamic client
// registration; `SK-MCP-012` single `mcp` scope). `apiHandler` routes `/mcp/*`
// through `NlqdbMcpAgent` — a `McpAgent` Durable Object per OAuth grant that
// holds the bound `sk_mcp_*` bearer and revalidates it every 1 s (`SK-MCP-014`).
// `defaultHandler` (./oauth-bridge.ts) handles `/authorize` by redirecting to
// `app.nlqdb.com` for Better Auth login + consent, then redeems the one-shot
// bridge code (`SK-MCP-013`). Slice 3c hardens auth-failure observability +
// rate-limit; TODO below.

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

// Re-export the DO class so wrangler's `[[durable_objects.bindings]]` finds it.
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
    // TODO(slice 3c): OAuthProvider's 401/403 rejections on `/mcp` never
    // enter an OTel span — wrap its `onError` or add a pre-gate counter.
    return oauth.fetch(req, env, ctx);
  },
} satisfies ExportedHandler<Env>;
