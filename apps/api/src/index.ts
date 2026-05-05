import { env } from "cloudflare:workers";
import { authEventsTotal, redactPii, setupTelemetry } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { recordAnonAdoption } from "./anon-adopt.ts";
import { makeGlobalAnonLimiter } from "./anon-global-cap.ts";
import { makeAnonRateLimiter } from "./anon-rate-limit.ts";
import { buildAskDeps, buildEventEmitter } from "./ask/build-deps.ts";
import { classifyKind } from "./ask/classifier.ts";
import { orchestrateAsk } from "./ask/orchestrate.ts";
import type { AskError, OrchestrateEvent } from "./ask/types.ts";
import { auth, REVOCATION_KEY_PREFIX } from "./auth.ts";
import { askFnFromDemoFixtures, DEMO_DB_ID } from "./chat/demo-shortcut.ts";
import { postChatMessage } from "./chat/orchestrate.ts";
import { makeChatStore } from "./chat/store.ts";
import { parseAskBody, parseGoalDbBody, parseJsonBody } from "./http.ts";
import { getLLMRouter } from "./llm-router.ts";
import { makeRequireSession, type RequireSessionVariables } from "./middleware.ts";
import {
  makeRequirePrincipal,
  type Principal,
  type RequirePrincipalVariables,
} from "./principal.ts";
import { cryptoProvider, stripe as stripeClient } from "./stripe/client.ts";
import { processWebhook } from "./stripe/webhook.ts";
import { verifyTurnstile } from "./turnstile.ts";
import { joinWaitlist } from "./waitlist.ts";

const SERVICE_VERSION = "0.1.0";

// `Cloudflare.Env` is augmented in src/env.d.ts — using it directly
// (rather than a parallel local `Bindings` type) keeps the two from
// drifting when bindings are added.
const app = new Hono<{
  Bindings: Cloudflare.Env;
  Variables: RequireSessionVariables & RequirePrincipalVariables;
}>();

// Cross-subdomain CORS allow-list. Sign-in (`/api/auth/*`), chat
// (`/v1/chat/*`), and the unified `/v1/ask` are called from
// `nlqdb.com` (Pages) into `app.nlqdb.com` (Worker). Cookie-session
// callers ride `credentials: include` so the `.nlqdb.com`-scoped
// session cookie round-trips; browsers reject `credentials: include`
// against `origin: *`, so the allow-list is explicit. Anon-bearer
// callers (Authorization: Bearer anon_*, the marketing hero post-
// SK-WEB-008) ride the same allow-list — the bearer is read from
// the request header, not a cookie, but the marketing surfaces are
// always on the explicit allow-listed origins.
//
// Preview surfaces (SK-AUTH-013): Workers-Versions preview URLs land
// at `<short-version-id>-nlqdb-web.omer-hochman.workers.dev`; the
// account-subdomain anchor keeps the regex scoped to our own account.
// Pages-preview PRs use `pr-<N>.nlqdb-web.pages.dev`.
//
// `/v1/demo/*` was retired with /v1/demo/ask (SK-WEB-008). Third-
// party `<nlq-data>` embeds with `pk_live_` keys are still a
// separate slice — those land with per-key origin pinning, not a
// permissive `*` blanket.
const CORS_ALLOWED_ORIGINS = [
  "https://nlqdb.com",
  "https://www.nlqdb.com",
  "https://nlqdb-web.pages.dev",
  /^https:\/\/pr-\d+\.nlqdb-web\.pages\.dev$/,
  /^https:\/\/[a-f0-9]{8}-nlqdb-web\.omer-hochman\.workers\.dev$/,
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
  allowHeaders: ["Content-Type", "Authorization", "cf-turnstile-response"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  maxAge: 86400,
});

app.use("/api/auth/*", credentialedCors);
app.use("/v1/ask", credentialedCors);
app.use("/v1/chat/*", credentialedCors);
app.use("/v1/databases", credentialedCors);
app.use("/v1/databases/*", credentialedCors);

// Session gate for `/v1/*` routes. Captures `auth.api.getSession`
// (cookieCache fast path → secondaryStorage → D1) + the KV revocation
// lookup at module load; the callbacks fire per request. See
// src/middleware.ts and PERFORMANCE §4 row 6.
const sessionResolver = {
  getSession: async (req: Request) => {
    const result = await auth.api.getSession({ headers: req.headers });
    if (!result) return null;
    return {
      user: { id: result.user.id, email: result.user.email },
      session: { token: result.session.token, userId: result.session.userId },
    };
  },
  isRevoked: async (token: string) => {
    const hit = await env.KV.get(`${REVOCATION_KEY_PREFIX}${token}`);
    return hit !== null;
  },
};

const requireSession = makeRequireSession(sessionResolver);

// `/v1/ask` accepts either a cookie session OR `Authorization:
// Bearer anon_<token>` (SK-ANON-001 + SK-ANON-006). The resolver
// is shared with `requireSession` — same getSession + isRevoked
// callbacks, principal middleware just adds the anon-bearer fork.
const requirePrincipal = makeRequirePrincipal(sessionResolver);

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
// Content negotiation (docs/architecture.md §13 (HTTP API happy path in docs/features/ask-pipeline/FEATURE.md) / line 624):
//   - Accept: text/event-stream → SSE { plan → rows → summary }
//   - Accept: application/json → JSON without summary (skips an LLM hop)
//   - Default → JSON with summary
//
// JWT plug-in point: when the plan cache or query execution moves
// to a separate service (Fly machine, Hyperdrive), mint a 30s
// internal JWT here (docs/architecture.md §4.4) and verify it on the receiving
// end. In-isolate today, so signing would be cargo-culting (see
// commit 1a body for the rationale).
app.post("/v1/ask", requirePrincipal, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.ask", async (span) => {
    const principal = c.var.principal as Principal;
    span.setAttribute("nlqdb.principal.kind", principal.kind);
    span.setAttribute("nlqdb.principal.id", principal.id);

    const parsed = await parseAskBody(c);
    if (!parsed.ok) {
      span.end();
      return c.json(parsed.error.body, parsed.error.status);
    }
    span.setAttribute("nlqdb.ask.goal_preview", redactPii(parsed.body.goal).slice(0, 200));

    const accept = c.req.header("accept") ?? "";
    const wantsSse = accept.includes("text/event-stream");
    const wantsJsonOnly = accept.includes("application/json") && !accept.includes("*/*");

    // Anon-tier gates (SK-ANON-004 / SK-ANON-010 / SK-RL-006). Two
    // layers, two distinct user-facing outcomes:
    //
    //   1. Global anon cap (100/hr / 1000/day / 10k/month, summed
    //      across ALL anon traffic) — when tripped, return 401
    //      auth_required so the surface stashes the prompt and
    //      redirects to sign-in (SK-ANON-010 / SK-ANON-011). The
    //      user becomes accountable + their pending prompt replays
    //      post-OAuth.
    //   2. Per-IP query bucket (30/min) — when tripped, return 429
    //      with X-RateLimit-* headers. Bot-speed defense; the user
    //      hasn't burned the global budget so sign-in won't help.
    //
    // Cookie-session traffic skips both layers — the per-user D1
    // limiter inside `orchestrateAsk` already covers it.
    if (principal.kind === "anon") {
      const globalLimiter = makeGlobalAnonLimiter(c.env.KV);
      const globalPeek = await globalLimiter.peek();
      if (!globalPeek.ok) {
        span.setAttribute("nlqdb.ask.outcome", "auth_required_global_cap");
        span.setAttribute("nlqdb.ask.global_window", globalPeek.window);
        span.end();
        return c.json(
          {
            error: {
              status: "auth_required" as const,
              code: "anon_global_cap" as const,
              window: globalPeek.window,
              resetAt: globalPeek.resetAt,
              signInUrl: buildSignInUrl(c.req.header("referer")),
              action: "Sign in to continue — your prompt is saved.",
            },
          },
          401,
        );
      }

      const ip = c.req.header("cf-connecting-ip") ?? "unknown";
      const anonLimiter = makeAnonRateLimiter(c.env.KV);
      const verdict = await anonLimiter.checkQuery(ip);
      // RFC 9110 X-RateLimit-* parity with the authed path
      // (SK-RL-004 / GLOBAL-002). Emitted on success too so the
      // surface can render headroom before the user hits the wall.
      const now = Math.floor(Date.now() / 1000);
      c.header("X-RateLimit-Limit", String(verdict.limit));
      c.header("X-RateLimit-Remaining", String(Math.max(0, verdict.limit - verdict.count)));
      c.header("X-RateLimit-Reset", String(verdict.resetAt));
      if (!verdict.ok) {
        span.setAttribute("nlqdb.ask.outcome", "rate_limited_ip");
        span.end();
        c.header("Retry-After", String(Math.max(0, verdict.resetAt - now)));
        return c.json(
          {
            error: {
              status: "rate_limited" as const,
              limit: verdict.limit,
              count: verdict.count,
              resetAt: verdict.resetAt,
            },
          },
          429,
        );
      }

      // Record the global counter only after BOTH gates clear and
      // the request is actually about to be served. Per-IP bucket
      // already incremented inside `checkQuery`.
      // Fire-and-forget: the response doesn't wait on the increment.
      c.executionCtx.waitUntil(globalLimiter.record());
    }

    // Goal-kind classifier (SK-HDC-001 + SK-ASK-001) — runs only when
    // `dbId` is absent. Uses router.classify (cheap LLM tier) with
    // full provider-chain failover. All providers failing → 502.
    if (!parsed.body.dbId) {
      let classification: Awaited<ReturnType<typeof classifyKind>>;
      try {
        classification = await classifyKind(getLLMRouter(), parsed.body.goal);
      } catch {
        span.setAttribute("nlqdb.ask.outcome", "classifier_failed");
        span.end();
        return c.json({ error: { status: "llm_failed" as const } }, 502);
      }
      span.setAttribute("nlqdb.ask.kind", classification.kind);
      span.setAttribute("nlqdb.ask.kind_reason", classification.reason);
      if (classification.kind === "create") {
        // Anon-create gating before we burn an LLM hop and a Neon
        // schema: per-IP create cap (5/hr, SK-ANON-004) + Turnstile
        // burst gate (3-in-5min → 428, SK-ANON-007). Authed-create
        // limits (20/day per account) are not implemented yet — this
        // PR ships the anon side that needs the gate to land at all.
        if (principal.kind === "anon") {
          const ip = c.req.header("cf-connecting-ip") ?? "unknown";
          const anonLimiter = makeAnonRateLimiter(c.env.KV);
          const peek = await anonLimiter.peekCreate(ip);
          // X-RateLimit-* parity (SK-RL-004 / GLOBAL-002) — same
          // header set for the create-cap bucket as for query.
          const now = Math.floor(Date.now() / 1000);
          c.header("X-RateLimit-Limit", String(peek.limit));
          c.header("X-RateLimit-Remaining", String(Math.max(0, peek.limit - peek.count)));
          c.header("X-RateLimit-Reset", String(peek.resetAt));
          if (!peek.ok) {
            span.setAttribute("nlqdb.ask.outcome", "create_cap_ip");
            span.end();
            c.header("Retry-After", String(Math.max(0, peek.resetAt - now)));
            return c.json(
              {
                error: {
                  status: "rate_limited" as const,
                  limit: peek.limit,
                  count: peek.count,
                  resetAt: peek.resetAt,
                },
              },
              429,
            );
          }
          if (peek.needsChallenge) {
            const turnstileToken = c.req.header("cf-turnstile-response") ?? null;
            const verify = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET, ip);
            // Fail-open when the secret is unset (dev / pre-config).
            // Any other failure (`invalid` / `verify_failed`) returns
            // 428 challenge_required so the surface re-renders the
            // widget. SK-ANON-007.
            const allowed = verify.ok || verify.reason === "unconfigured";
            if (!allowed) {
              span.setAttribute("nlqdb.ask.outcome", "challenge_required");
              span.end();
              return c.json(
                {
                  error: {
                    status: "challenge_required" as const,
                    code: "challenge_required" as const,
                    action: "Complete the browser challenge to continue.",
                  },
                },
                428,
              );
            }
          }
          // Record AFTER any challenge clears — otherwise the
          // counter ratchets up on every blocked attempt and the
          // user is stuck behind the gate forever.
          await anonLimiter.recordCreate(ip);
        }

        // Dynamic import defers libpg-query's WASM initialization to
        // the first create request — see commit 1a body for the
        // rationale.
        const { buildDbCreateDeps } = await import("./db-create/build-deps.ts");
        const { orchestrateDbCreate } = await import("./db-create/orchestrate.ts");
        try {
          const { deps: createDeps, secretRef } = buildDbCreateDeps(c.env);
          const result = await orchestrateDbCreate(createDeps, {
            goal: parsed.body.goal,
            tenantId: principal.id,
            secretRef,
          });
          if (!result.ok) {
            // infer/compile/ddl/embed_failed → 422; provision_failed → 500.
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
      // kind=query|write without dbId — surfaces the ambiguity per
      // SK-HDC-005 / SK-ASK-003. The full per-surface resolution
      // (409 + candidate_dbs / CLI prompt / MCP elicitation) is a
      // separate slice.
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
      userId: principal.id,
    };

    if (wantsSse) {
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

// `POST /v1/demo/ask` was retired here per SK-WEB-008. The marketing
// surface and any third-party `<nlq-data>` embed now hit `/v1/ask`
// with an `Authorization: Bearer anon_<token>` header (the bearer is
// minted in localStorage by `apps/web/src/lib/anon.ts` and applies
// to every surface — `<nlq-data>`, the hero, /app/new). The carousel
// in `apps/web/src/components/Carousel.astro` is the only static-
// fixture surface that remains; it ships pre-rendered HTML for
// shapes the LLM might also produce, no fetch involved.
//
// `apps/api/src/demo.ts`'s `buildDemoResult` is still imported by
// `apps/api/src/chat/demo-shortcut.ts`; that shortcut is itself
// scheduled for retirement once /v1/chat/messages migrates to real
// LLM (its file header names the slice).

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

// Sign-in URL the global-anon-cap response hands the surface
// (SK-ANON-010). The `return` query-param round-trips the page the
// user was on; the surface is responsible for stashing the prompt
// in localStorage before redirecting (SK-ANON-011 — the prompt
// itself never travels through the URL or the server).
//
// Default web origin is `https://nlqdb.com`; overridden via
// `MAGIC_LINK_WEB_ORIGIN` so dev / staging point at the local Astro
// dev server instead of prod.
function buildSignInUrl(referer: string | undefined): string {
  const origin = env.MAGIC_LINK_WEB_ORIGIN ?? "https://nlqdb.com";
  const url = new URL("/sign-in", origin);
  if (referer) {
    try {
      const refUrl = new URL(referer);
      // Only allow same-origin returns — never let an attacker craft
      // a 401 response that hands the surface an off-domain redirect.
      if (refUrl.origin === origin) {
        url.searchParams.set("return", refUrl.pathname + refUrl.search);
      }
    } catch {
      // Malformed referer header — fall through to no return param.
    }
  }
  return url.toString();
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
