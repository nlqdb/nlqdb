import { env } from "cloudflare:workers";
import { createPostgresAdapter } from "@nlqdb/db";
import { authEventsTotal, setupTelemetry } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { makeFirstQueryTracker } from "./ask/first-query.ts";
import { orchestrateAsk } from "./ask/orchestrate.ts";
import { makePlanCache } from "./ask/plan-cache.ts";
import { makeRateLimiter } from "./ask/rate-limit.ts";
import { DbConfigError, type DbRecord, type OrchestrateEvent } from "./ask/types.ts";
import { auth, REVOCATION_KEY_PREFIX } from "./auth.ts";
import { resolveDb } from "./db-registry.ts";
import { getLLMRouter } from "./llm-router.ts";
import { makeRequireSession, type RequireSessionVariables } from "./middleware.ts";

type Bindings = {
  KV: KVNamespace;
  DB: D1Database;
  // Telemetry: both must be set to ship to Grafana Cloud OTLP.
  // Locally these are empty, so setup is skipped — the test suite
  // installs an in-memory exporter instead (see @nlqdb/otel/test).
  GRAFANA_OTLP_ENDPOINT?: string;
  GRAFANA_OTLP_AUTHORIZATION?: string;
};

const SERVICE_VERSION = "0.1.0";

const app = new Hono<{ Bindings: Bindings; Variables: RequireSessionVariables }>();

// Session gate for `/v1/*` routes. Captures `auth.api.getSession`
// (cookieCache fast path → secondaryStorage → D1) + the KV revocation
// lookup at module load; the callbacks fire per request. See
// src/middleware.ts and PERFORMANCE §4 row 6.
const requireSession = makeRequireSession({
  getSession: async (req) => {
    const result = await auth.api.getSession({ headers: req.headers });
    if (!result) return null;
    return {
      user: { id: result.user.id, email: result.user.email },
      session: { token: result.session.token, userId: result.session.userId },
    };
  },
  isRevoked: async (token) => {
    const hit = await env.KV.get(`${REVOCATION_KEY_PREFIX}${token}`);
    return hit !== null;
  },
});

// Per-request telemetry install + flush. Idempotent — first request
// wins, subsequent calls return the cached handle. Skipped locally
// when either secret is unset.
app.use("*", async (c, next) => {
  const { GRAFANA_OTLP_ENDPOINT, GRAFANA_OTLP_AUTHORIZATION } = c.env;
  if (GRAFANA_OTLP_ENDPOINT && GRAFANA_OTLP_AUTHORIZATION) {
    const telemetry = setupTelemetry({
      serviceName: "nlqdb-api",
      serviceVersion: SERVICE_VERSION,
      otlpEndpoint: GRAFANA_OTLP_ENDPOINT,
      authorization: GRAFANA_OTLP_AUTHORIZATION,
    });
    c.executionCtx.waitUntil(telemetry.forceFlush());
  }
  await next();
});

app.get("/v1/health", (c) =>
  c.json({
    status: "ok",
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    bindings: {
      kv: typeof c.env.KV !== "undefined",
      db: typeof c.env.DB !== "undefined",
    },
  }),
);

// `POST /v1/ask` (Slice 6).
//
// Content negotiation (DESIGN §14.6 / line 624):
//   - Accept: text/event-stream → SSE { plan → rows → summary }
//   - Accept: application/json → JSON without summary (skips an LLM hop)
//   - Default → JSON with summary
//
// JWT plug-in point: when the plan cache or query execution moves
// to a separate service (Fly machine, Hyperdrive), mint a 30s
// internal JWT here (DESIGN §4.4) and verify it on the receiving
// end. In-isolate today, so signing would be cargo-culting (see
// commit 1a body for the rationale).
app.post("/v1/ask", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.ask", async (span) => {
    const session = c.var.session;
    span.setAttribute("nlqdb.user.id", session.user.id);

    let body: { goal?: unknown; dbId?: unknown };
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      span.end();
      return c.json({ error: "invalid_json" }, 400);
    }
    if (typeof body.goal !== "string" || body.goal.trim().length === 0) {
      span.end();
      return c.json({ error: "goal_required" }, 400);
    }
    if (typeof body.dbId !== "string" || body.dbId.length === 0) {
      span.end();
      return c.json({ error: "dbId_required" }, 400);
    }

    const accept = c.req.header("accept") ?? "";
    const wantsSse = accept.includes("text/event-stream");
    const wantsJsonOnly = accept.includes("application/json") && !accept.includes("*/*");

    const deps = {
      resolveDb: (id: string, tenantId: string) => resolveDb(c.env.DB, id, tenantId),
      planCache: makePlanCache(c.env.KV),
      llm: getLLMRouter(),
      exec: buildExec,
      rateLimiter: makeRateLimiter(c.env.DB),
      firstQuery: makeFirstQueryTracker(c.env.KV),
    };
    const orchestrateReq = { goal: body.goal, dbId: body.dbId, userId: session.user.id };

    if (wantsSse) {
      return streamSSE(c, async (stream) => {
        const outcome = await orchestrateAsk(deps, orchestrateReq, {
          onEvent: async (event) => {
            await stream.writeSSE({ event: event.type, data: serializeEvent(event) });
          },
        });
        if (!outcome.ok) {
          await stream.writeSSE({ event: "error", data: JSON.stringify(outcome.error) });
        } else {
          await stream.writeSSE({ event: "done", data: JSON.stringify({ status: "ok" }) });
        }
        span.end();
      });
    }

    const outcome = await orchestrateAsk(deps, orchestrateReq, {
      skipSummary: wantsJsonOnly,
    });
    span.end();
    if (!outcome.ok) {
      const status = errorStatus(outcome.error.status);
      return c.json({ error: outcome.error }, status);
    }
    return c.json(outcome.result);
  });
});

// Resolves the DB row's `connection_secret_ref` to a connection URL
// from env. Phase 0 ships one shared Postgres (PLAN line 87), so the
// ref is typically "DATABASE_URL". Throws `DbConfigError` if the ref
// doesn't resolve — operator config bug, distinct from a transient
// "Neon is down" failure.
async function buildExec(db: DbRecord, sql: string) {
  const url = (env as unknown as Record<string, string | undefined>)[db.connectionSecretRef];
  if (!url) {
    throw new DbConfigError(
      `connection_secret_ref ${JSON.stringify(db.connectionSecretRef)} did not resolve in env (db_id=${db.id})`,
    );
  }
  const adapter = createPostgresAdapter({ connectionString: url });
  return adapter.execute(sql);
}

function serializeEvent(event: OrchestrateEvent): string {
  return JSON.stringify(event);
}

function errorStatus(status: string): 400 | 404 | 429 | 502 {
  if (status === "db_not_found") return 404;
  if (status === "rate_limited") return 429;
  if (status === "db_unreachable" || status === "db_misconfigured" || status === "llm_failed") {
    return 502;
  }
  return 400;
}

// Better Auth catch-all (DESIGN §4.1, PERFORMANCE §4 row 5).
//
// Span naming: callbacks get `nlqdb.auth.oauth.callback` (one span per
// IdP code-exchange); every other `/api/auth/*` request — session
// reads, sign-in init, sign-out — gets `nlqdb.auth.verify`. The
// `nlqdb.auth.events.total{type, outcome}` counter increments once per
// request, classifying outcome by HTTP status (2xx/3xx = success,
// otherwise failure).
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const url = new URL(c.req.url);
  const isCallback = url.pathname.startsWith("/api/auth/callback/");
  const provider = isCallback ? url.pathname.split("/")[4] : undefined;
  const spanName = isCallback ? "nlqdb.auth.oauth.callback" : "nlqdb.auth.verify";
  const eventType = isCallback ? "oauth_callback" : "verify";
  // Tracer fetched per request — same pattern as @nlqdb/db / @nlqdb/llm.
  // Picks up whichever provider is registered now (test or production).
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan(spanName, async (span) => {
    if (provider) span.setAttribute("nlqdb.auth.provider", provider);
    try {
      const response = await auth.handler(c.req.raw);
      const outcome = response.status < 400 ? "success" : "failure";
      span.setAttribute("http.response.status_code", response.status);
      authEventsTotal().add(1, { type: eventType, outcome });
      return response;
    } catch (err) {
      authEventsTotal().add(1, { type: eventType, outcome: "failure" });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
});

export default app;
