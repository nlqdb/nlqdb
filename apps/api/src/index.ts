import { env } from "cloudflare:workers";
import { authEventsTotal, redactPii, setupTelemetry } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { recordAnonAdoption } from "./anon-adopt.ts";
import { buildAskDeps, buildEventEmitter } from "./ask/build-deps.ts";
import { classifyKind } from "./ask/classifier.ts";
import { orchestrateAsk } from "./ask/orchestrate.ts";
import type { AskError, OrchestrateEvent } from "./ask/types.ts";
import { auth, REVOCATION_KEY_PREFIX } from "./auth.ts";
import { askFnFromDemoFixtures, DEMO_DB_ID } from "./chat/demo-shortcut.ts";
import { postChatMessage } from "./chat/orchestrate.ts";
import { makeChatStore } from "./chat/store.ts";
import { buildDemoResult, makeRateLimiter as makeDemoRateLimiter } from "./demo.ts";
import { parseGoalDbBody, parseJsonBody } from "./http.ts";
import { makeRequireSession, type RequireSessionVariables } from "./middleware.ts";
import { cryptoProvider, stripe as stripeClient } from "./stripe/client.ts";
import { processWebhook } from "./stripe/webhook.ts";
import { joinWaitlist } from "./waitlist.ts";

const SERVICE_VERSION = "0.1.0";

// `Cloudflare.Env` is augmented in src/env.d.ts — using it directly
// (rather than a parallel local `Bindings` type) keeps the two from
// drifting when bindings are added.
const app = new Hono<{ Bindings: Cloudflare.Env; Variables: RequireSessionVariables }>();

// Cross-subdomain CORS allow-list. Sign-in (`/api/auth/*`) and chat
// (`/v1/chat/*`) are called from `nlqdb.com` (Pages) into
// `app.nlqdb.com` (Worker) with `credentials: include` so the
// session cookie (`.nlqdb.com` scope) round-trips. Browsers reject
// `credentials: include` against `origin: *`, so the allow-list is
// explicit. `pages.dev` previews + localhost dev origins included
// so the same flows work pre-merge and during `wrangler dev`.
//
// /v1/demo/* keeps its own permissive `*` policy (no credentials,
// public read). /v1/ask stays uncovered for now — revisit when
// third-party `<nlq-data>` embeds with `pk_live_` keys land
// (Phase 1, separate slice).
const CORS_ALLOWED_ORIGINS = [
  "https://nlqdb.com",
  "https://www.nlqdb.com",
  "https://nlqdb-web.pages.dev",
  /^https:\/\/pr-\d+\.nlqdb-web\.pages\.dev$/,
  "http://localhost:4321",
  "http://localhost:8787",
];

const credentialedCors = cors({
  origin: (origin) => {
    if (!origin) return null;
    for (const allowed of CORS_ALLOWED_ORIGINS) {
      if (typeof allowed === "string" ? allowed === origin : allowed.test(origin)) {
        return origin;
      }
    }
    return null;
  },
  credentials: true,
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  maxAge: 86400,
});

app.use("/api/auth/*", credentialedCors);
app.use("/v1/chat/*", credentialedCors);

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

// Per-request telemetry install + flush. setupTelemetry is idempotent
// — first call per isolate wins; later calls return the cached handle.
// Setup MUST happen before `next()` so handlers' `startActiveSpan` calls
// have a registered global provider. forceFlush MUST happen after
// `next()` so spans created during handler execution are in the
// BatchSpanProcessor buffer when the export fires. Skipped entirely
// when either OTLP secret is unset (local dev / tests).
app.use("*", async (c, next) => {
  const { GRAFANA_OTLP_ENDPOINT, GRAFANA_OTLP_AUTHORIZATION } = c.env;
  const telemetry =
    GRAFANA_OTLP_ENDPOINT && GRAFANA_OTLP_AUTHORIZATION
      ? setupTelemetry({
          serviceName: "nlqdb-api",
          serviceVersion: SERVICE_VERSION,
          otlpEndpoint: GRAFANA_OTLP_ENDPOINT,
          authorization: GRAFANA_OTLP_AUTHORIZATION,
        })
      : undefined;
  await next();
  if (telemetry) {
    c.executionCtx.waitUntil(telemetry.forceFlush());
  }
});

app.get("/v1/health", (c) =>
  c.json({
    status: "ok",
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    bindings: {
      kv: typeof c.env.KV !== "undefined",
      db: typeof c.env.DB !== "undefined",
      events_queue: typeof c.env.EVENTS_QUEUE !== "undefined",
      assets: typeof c.env.ASSETS !== "undefined",
    },
  }),
);

// `POST /v1/ask` (Slice 6).
//
// Content negotiation (docs/architecture.md §13 (HTTP API happy path in .claude/skills/ask-pipeline/SKILL.md) / line 624):
//   - Accept: text/event-stream → SSE { plan → rows → summary }
//   - Accept: application/json → JSON without summary (skips an LLM hop)
//   - Default → JSON with summary
//
// JWT plug-in point: when the plan cache or query execution moves
// to a separate service (Fly machine, Hyperdrive), mint a 30s
// internal JWT here (docs/architecture.md §4.4) and verify it on the receiving
// end. In-isolate today, so signing would be cargo-culting (see
// commit 1a body for the rationale).
app.post("/v1/ask", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.ask", async (span) => {
    const session = c.var.session;
    span.setAttribute("nlqdb.user.id", session.user.id);

    const parsed = await parseGoalDbBody(c);
    if (!parsed.ok) {
      span.end();
      return c.json(parsed.error.body, parsed.error.status);
    }
    // Redacted preview for trace search without leaking PII into spans.
    span.setAttribute("nlqdb.ask.goal_preview", redactPii(parsed.body.goal).slice(0, 200));

    const accept = c.req.header("accept") ?? "";
    const wantsSse = accept.includes("text/event-stream");
    const wantsJsonOnly = accept.includes("application/json") && !accept.includes("*/*");

    // Goal-kind classifier (SK-HDC-001 + SK-ASK-001) — runs only
    // when `dbId` is absent. dbId-present requests are unambiguous
    // query/write goals against the named db; classifier adds zero
    // value there. v0 is a token-set heuristic; LLM swap-in is a
    // follow-up (see classifier.ts header).
    if (!parsed.body.dbId) {
      const classification = classifyKind(parsed.body.goal);
      span.setAttribute("nlqdb.ask.kind", classification.kind);
      span.setAttribute("nlqdb.ask.kind_reason", classification.reason);
      if (classification.kind === "create") {
        // Route to the typed-plan create pipeline. SSE is not yet
        // implemented for create (the orchestrator is await-blocking,
        // not stream-emitting); a follow-up will add per-step events
        // mirroring the orchestrateAsk pattern.
        //
        // Dynamic import defers libpg-query's WASM initialization to
        // the first create request. Static import pulls it into the
        // Worker startup path, which breaks the workerd integration-test
        // sandbox (libpg-query reads the .wasm via fs at init time;
        // wrangler's esbuild inlines it for production but the test
        // runner loads TypeScript source directly).
        const { buildDbCreateDeps } = await import("./db-create/build-deps.ts");
        const { orchestrateDbCreate } = await import("./db-create/orchestrate.ts");
        try {
          const { deps: createDeps, secretRef } = buildDbCreateDeps(c.env);
          const result = await orchestrateDbCreate(createDeps, {
            goal: parsed.body.goal,
            tenantId: session.user.id,
            secretRef,
          });
          if (!result.ok) {
            // Map create-error envelope to HTTP status. infer/compile/
            // ddl/embed_failed map to 422 (the goal made it through
            // routing but the pipeline rejected it); provision_failed
            // maps to 500 (real infra failure, not user error).
            const statusCode = result.error.kind === "provision_failed" ? 500 : 422;
            return c.json({ error: result.error }, statusCode);
          }
          return c.json({
            kind: "create" as const,
            db: result.dbId,
            schemaName: result.schemaName,
            pkLive: result.pkLive,
            plan: result.plan,
            sampleRows: result.sampleRows,
          });
        } finally {
          span.end();
        }
      }
      // kind=query|write but no dbId — needs the per-surface
      // resolution path (REST 409 + candidate_dbs / CLI prompt /
      // MCP elicitation per SK-HDC-005 / SK-ASK-003). That whole
      // surface lands in the next slice; for today we surface the
      // ambiguity as a structured 400 so the client can render it.
      span.end();
      return c.json(
        {
          error: {
            status: "db_id_required" as const,
            message:
              "No db specified — include a dbId or phrase your goal as a create request (e.g. 'an orders tracker').",
          },
        },
        400,
      );
    }

    const deps = buildAskDeps(c.env);
    const orchestrateReq = {
      goal: parsed.body.goal,
      dbId: parsed.body.dbId,
      userId: session.user.id,
    };

    if (wantsSse) {
      // try/finally so the parent span always closes even if a stream
      // write rejects (browser DC) or the orchestrator throws past the
      // structured-error envelope. Mirror the JSON-mode error shape:
      // SSE `data` is `{ error: AskError }` so SSE + JSON consumers
      // share a parser.
      return streamSSE(c, async (stream) => {
        try {
          const outcome = await orchestrateAsk(deps, orchestrateReq, {
            onEvent: async (event) => {
              await stream.writeSSE({ event: event.type, data: serializeEvent(event) });
            },
          });
          if (!outcome.ok) {
            await stream.writeSSE({
              event: "error",
              data: JSON.stringify({ error: outcome.error }),
            });
          } else {
            await stream.writeSSE({ event: "done", data: JSON.stringify({ status: "ok" }) });
          }
        } finally {
          span.end();
        }
      });
    }

    try {
      const outcome = await orchestrateAsk(deps, orchestrateReq, {
        skipSummary: wantsJsonOnly,
      });
      if (!outcome.ok) {
        const httpStatus = errorStatus(outcome.error.status);
        // RFC 9110 X-RateLimit-* headers (SK-RL-004 / GLOBAL-002 parity).
        if (outcome.error.status === "rate_limited") {
          const { limit, count, resetAt } = outcome.error;
          const now = Math.floor(Date.now() / 1000);
          c.header("X-RateLimit-Limit", String(limit));
          c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
          c.header("X-RateLimit-Reset", String(resetAt));
          c.header("Retry-After", String(Math.max(0, resetAt - now)));
        }
        return c.json({ error: outcome.error }, httpStatus);
      }
      return c.json(outcome.result);
    } finally {
      span.end();
    }
  });
});

// `POST /v1/demo/ask` — public, unauthenticated, canned fixtures.
// Backs the live `<nlq-data>` on the marketing homepage (and any
// third-party `endpoint=".../v1/demo/ask"` embed). CORS-permissive
// so cross-origin embeds work; per-IP rate-limited so it can't be
// abused as a free LLM stand-in. See src/demo.ts for fixtures +
// limiter.
//
// Note on CORS: must echo the request origin + `credentials: true`,
// not `origin: "*"`. The `<nlq-data>` element always sends
// `credentials: include` (packages/elements/src/fetch.ts:76) and
// browsers reject `credentials: include` paired with `Origin: *`.
// Echoing the origin is functionally "allow any" for this endpoint
// — there's no auth, no cookies are read on the server side, and
// the rate limiter keys off `cf-connecting-ip` not session.
app.use(
  "/v1/demo/*",
  cors({
    origin: (origin) => origin ?? null,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "OPTIONS"],
    maxAge: 86400,
  }),
);

// `POST /v1/waitlist` — public, unauthenticated, idempotent. Backs
// the homepage waitlist form while the chat surface is tabled.
// Returns 200 for any well-formed email (privacy: never reveal
// list membership). Per-IP throttle (5/min) defends against abuse.
//
// CORS: tightened to the same allow-list as `/api/auth/*` — the form
// only ever loads from nlqdb.com / pages.dev previews / localhost dev.
// (Earlier slice used reflect-any-origin in line with /v1/demo/* but
// there's no third-party-embed contract here, so the narrower posture
// keeps random sites from probing the rate-limit / abuse path from
// the browser.)
app.use("/v1/waitlist", credentialedCors);

app.post("/v1/waitlist", async (c) => {
  const body = await parseJsonBody<{ email?: unknown }>(c);
  if (!body.ok) return c.json({ error: { status: "invalid_email" } }, 400);
  const result = await joinWaitlist(
    {
      db: c.env.DB,
      kv: c.env.KV,
      events: buildEventEmitter(c.env.EVENTS_QUEUE),
    },
    body.body.email,
    c.req.header("cf-connecting-ip") ?? null,
    "web",
  );
  // Fire-and-forget: 200 ships before the queue producer resolves.
  // Nested guards so a future 200-shaped variant without `pendingEmit`
  // can't silently end up unhandled.
  if (result.status === 200) {
    if (result.pendingEmit) {
      c.executionCtx.waitUntil(result.pendingEmit);
    }
  }
  return c.json(result.body, result.status);
});

app.post("/v1/demo/ask", async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.demo.ask", async (span) => {
    const ipHeader = c.req.header("cf-connecting-ip");
    if (!ipHeader) {
      // In production behind CF this header is always set. A miss
      // means dev, vitest, or a routing change stripping the header
      // — log so it surfaces in operator triage if it ever starts
      // happening on the public edge.
      console.warn("demo/ask: missing cf-connecting-ip; falling back to 'unknown' bucket");
    }
    const clientIp = ipHeader ?? "unknown";
    const limiter = makeDemoRateLimiter(c.env.KV);
    const verdict = await limiter.hit(clientIp);
    if (!verdict.ok) {
      span.setAttribute("nlqdb.demo.outcome", "rate_limited");
      span.end();
      // RFC 9110 X-RateLimit-* headers (SK-RL-004 / GLOBAL-002 parity).
      const now = Math.floor(Date.now() / 1000);
      const resetAt = now + verdict.retryAfter;
      c.header("Retry-After", String(verdict.retryAfter));
      c.header("X-RateLimit-Limit", String(verdict.limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(resetAt));
      return c.json({ error: { status: "rate_limited" } }, 429);
    }

    const parsed = await parseGoalDbBody(c);
    if (!parsed.ok) {
      span.setAttribute("nlqdb.demo.outcome", "invalid_request");
      span.end();
      return c.json(parsed.error.body, parsed.error.status);
    }

    const result = buildDemoResult(parsed.body.goal);
    span.setAttribute("nlqdb.demo.outcome", "ok");
    span.setAttribute("nlqdb.demo.goal_length", parsed.body.goal.length);
    span.setAttribute("nlqdb.demo.goal_preview", redactPii(parsed.body.goal).slice(0, 200));
    span.end();
    return c.json(result);
  });
});

// `POST /v1/stripe/webhook` (Slice 7).
//
// No `requireSession` — Stripe authenticates via signature, not cookies.
// Raw body must be read with `c.req.text()` (NOT `c.req.json()`); the
// parser would normalize whitespace and break HMAC verification.
//
// 503 vs 400 vs 200:
//   - 503 if `STRIPE_WEBHOOK_SECRET` isn't configured at all (deployment
//     misconfig — Stripe retries land here too, which lets us see drops)
//   - 400 if signature is missing or invalid (no retry helps — secret
//     rotation, replay-window expiry, body tamper)
//   - 200 once the event is recorded in `stripe_events` (idempotent)
//
// R2 archive runs in `ctx.waitUntil` so 200 ships before the put completes.
app.post("/v1/stripe/webhook", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "secret_unconfigured" }, 503);
  }
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature") ?? null;

  const result = await processWebhook(
    {
      signer: stripeClient.webhooks,
      cryptoProvider,
      webhookSecret: c.env.STRIPE_WEBHOOK_SECRET,
      db: c.env.DB,
      r2: c.env.ASSETS,
      events: buildEventEmitter(c.env.EVENTS_QUEUE),
    },
    rawBody,
    signature,
  );

  if (result.status === 200 && result.archive) {
    c.executionCtx.waitUntil(result.archive);
  }
  return c.json(result.body, result.status);
});

// Chat surface (Slice 10 — docs/architecture.md §3.2 "Signed-in surface").
//
// Two endpoints, both `requireSession`-gated. Stateless — every call
// re-reads from D1, no in-isolate caching. The chat is one rolling
// conversation per user; multi-thread / per-DB scoping is deferred
// to Phase 1 alongside the anonymous-DB-adoption flow.
//
// `POST /v1/chat/messages` validates input → calls `postChatMessage`
// (which runs `orchestrateAsk` and persists user + assistant rows on
// success). The chat orchestrator returns `Rejected` for `rate_limited`
// or `db_not_found` errors — the handler maps those to 4xx via the
// shared `errorStatus()` mapper, identical to `/v1/ask`. Other
// outcomes (success or post-execute failure) get persisted + 200,
// because the user did engage and the history is meaningful.
//
// Telemetry: `nlqdb.chat.turn` parent span per request, attributes
// `nlqdb.user.id` + `nlqdb.chat.outcome` (`persisted` | `rejected` |
// `invalid_request`). Mirrors the `nlqdb.ask` envelope so chat turns
// appear in the same span tree as their underlying /v1/ask runs.
// Anonymous-mode token adoption — POSTed by `/app` on first signed-in
// load if `nlqdb:anon-token` is in localStorage. Idempotent.
app.post("/v1/anon/adopt", requireSession, async (c) => {
  const session = c.var.session;
  const body = await parseJsonBody<{ token?: unknown }>(c);
  if (!body.ok || typeof body.body.token !== "string") {
    return c.json({ error: { status: "invalid_body" } }, 400);
  }
  const result = await recordAnonAdoption(c.env.DB, session.user.id, body.body.token);
  if (!result.ok) {
    // Map internal-only reasons to a stable public string. The
    // `internal` reason describes a server-side failure mode the
    // client can't act on; surface it as `adopt_failed` so external
    // dashboards / docs don't have to track infra detail.
    const publicStatus =
      result.reason === "invalid_token"
        ? "invalid_token"
        : result.reason === "token_taken"
          ? "token_taken"
          : "adopt_failed";
    const httpStatus =
      result.reason === "invalid_token" ? 400 : result.reason === "token_taken" ? 409 : 500;
    return c.json({ error: { status: publicStatus } }, httpStatus);
  }
  return c.json({ adopted: result.adopted });
});

app.get("/v1/chat/messages", requireSession, async (c) => {
  const session = c.var.session;
  const store = makeChatStore(c.env.DB);
  const messages = await store.list(session.user.id);
  return c.json({ messages });
});

app.post("/v1/chat/messages", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.chat.turn", async (span) => {
    const session = c.var.session;
    span.setAttribute("nlqdb.user.id", session.user.id);

    const parsed = await parseGoalDbBody(c);
    if (!parsed.ok) {
      span.setAttribute("nlqdb.chat.outcome", "invalid_request");
      span.end();
      return c.json(parsed.error.body, parsed.error.status);
    }

    // TEMPORARY (Slice 11 retires): `dbId="demo"` short-circuits to
    // canned fixtures so signed-in users with zero DBs aren't stuck
    // hitting `db_not_found` on every chat send. See
    // `chat/demo-shortcut.ts` for the rationale.
    const isDemo = parsed.body.dbId === DEMO_DB_ID;
    const askFn = isDemo
      ? askFnFromDemoFixtures()
      : (req: Parameters<Parameters<typeof postChatMessage>[0]["ask"]>[0]) =>
          orchestrateAsk(buildAskDeps(c.env), req);

    const outcome = await postChatMessage(
      {
        store: makeChatStore(c.env.DB),
        // Production wires the real orchestrator. The chat orchestrator
        // takes `ask` as a dep so unit tests can stub it without
        // standing up rate-limiter / plan-cache / LLM router seams.
        // TODO(slice 11): swap to streaming once SSE chat lands; for
        // now the response shape is request/response.
        ask: askFn,
        now: () => Date.now(),
        newId: () => crypto.randomUUID(),
      },
      { userId: session.user.id, goal: parsed.body.goal, dbId: parsed.body.dbId },
    );
    if (isDemo) span.setAttribute("nlqdb.chat.demo_shortcut", true);

    if (!outcome.ok) {
      span.setAttribute("nlqdb.chat.outcome", "rejected");
      span.setAttribute("nlqdb.chat.reject_status", outcome.error.status);
      span.end();
      const httpStatus = errorStatus(outcome.error.status);
      if (outcome.error.status === "rate_limited") {
        const { limit, count, resetAt } = outcome.error;
        const now = Math.floor(Date.now() / 1000);
        c.header("X-RateLimit-Limit", String(limit));
        c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
        c.header("X-RateLimit-Reset", String(resetAt));
        c.header("Retry-After", String(Math.max(0, resetAt - now)));
      }
      return c.json({ error: outcome.error }, httpStatus);
    }
    span.setAttribute("nlqdb.chat.outcome", "persisted");
    span.setAttribute("nlqdb.chat.assistant_kind", outcome.assistant.result.kind);
    span.end();
    return c.json({ user: outcome.user, assistant: outcome.assistant });
  });
});

function serializeEvent(event: OrchestrateEvent): string {
  return JSON.stringify(event);
}

// Typed over `AskError["status"]` so adding a new error variant fails
// the compile here rather than silently falling through to 400. 422
// for `schema_unavailable` mirrors REST convention for "request was
// well-formed but the server can't act on it" (the goal+dbId parsed,
// but introspection couldn't fetch a schema this time).
function errorStatus(status: AskError["status"]): 400 | 404 | 422 | 429 | 502 {
  switch (status) {
    case "db_not_found":
      return 404;
    case "rate_limited":
      return 429;
    case "schema_unavailable":
      return 422;
    case "db_unreachable":
    case "db_misconfigured":
    case "llm_failed":
      return 502;
    case "sql_rejected":
      return 400;
  }
}

// Better Auth catch-all (docs/architecture.md §4.1, PERFORMANCE §4 row 5).
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
