import { setupTelemetry } from "@nlqdb/otel";

type Env = {
  KV: KVNamespace;
  DB: D1Database;
  // Telemetry: both must be set to ship to Grafana Cloud OTLP.
  // Locally these are empty, so setup is skipped — the test suite
  // installs an in-memory exporter instead (see @nlqdb/otel/test).
  GRAFANA_OTLP_ENDPOINT?: string;
  GRAFANA_OTLP_AUTHORIZATION?: string;
};

const SERVICE_VERSION = "0.1.0";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (env.GRAFANA_OTLP_ENDPOINT && env.GRAFANA_OTLP_AUTHORIZATION) {
      const telemetry = setupTelemetry({
        serviceName: "nlqdb-api",
        serviceVersion: SERVICE_VERSION,
        otlpEndpoint: env.GRAFANA_OTLP_ENDPOINT,
        authorization: env.GRAFANA_OTLP_AUTHORIZATION,
      });
      ctx.waitUntil(telemetry.forceFlush());
    }

    const url = new URL(request.url);

    if (url.pathname === "/v1/health") {
      return Response.json({
        status: "ok",
        version: SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        bindings: {
          kv: typeof env.KV !== "undefined",
          db: typeof env.DB !== "undefined",
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
