import { env } from "cloudflare:workers";
import {
  ALLOWED_ENGINES,
  createPipeManagementClient,
  createTinybirdAdapter,
  type Engine,
} from "@nlqdb/db";
import { authEventsTotal, redactPii, setupTelemetry } from "@nlqdb/otel";
import {
  isValidSpanId,
  isValidTraceId,
  ROOT_CONTEXT,
  type Span,
  type SpanContext,
  SpanStatusCode,
  TraceFlags,
  trace,
} from "@opentelemetry/api";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { recordAnonAdoption } from "./anon-adopt.ts";
import {
  type AnonCreateGateDecision,
  commitAnonCreate as commitAnonCreateImpl,
  peekAnonCreateGate as peekAnonCreateGateImpl,
} from "./anon-create-gate.ts";
import { makeGlobalAnonLimiter } from "./anon-global-cap.ts";
import { makeAnonRateLimiter } from "./anon-rate-limit.ts";
import { buildSetCookie, signAnonStash } from "./anon-stash.ts";
import {
  apiKeyHmacSecret,
  bumpKeyLastUsed as bumpKeyLastUsedImpl,
  getKeyStatusByHash,
  hmacHex,
  listKeysByTenant,
  lookupPkLiveKey as lookupPkLiveKeyImpl,
  lookupSkKey as lookupSkKeyImpl,
  mintSkLiveKey,
  mintSkMcpKey,
  revokeKeyById,
} from "./api-keys.ts";
import { buildAskDeps, buildEventEmitter, buildMemoryExec } from "./ask/build-deps.ts";
import {
  BYOLLM_HEADER,
  type ByollmCredential,
  parseByollmHeader,
  resolveAskRouter,
} from "./ask/byollm.ts";
import { emitFeatureSignal } from "./ask/demand-signal.ts";
import { resolveFrontierAskRouter } from "./ask/frontier-router.ts";
import { orchestrateAsk } from "./ask/orchestrate.ts";
import { kickoffAskPrelude, resolveAnonEngineOverride, seedFromPinnedDb } from "./ask/prelude.ts";
import { makeRecentTablesStore } from "./ask/recent-tables.ts";
import { withStageRetry } from "./ask/retry.ts";
import { ROUTE_CONFIDENCE_FLOOR, routeAsk } from "./ask/route-ask.ts";
import type { AskError, OrchestrateEvent, SelectedDbEcho } from "./ask/types.ts";
import { listInbox } from "./auth/mock-email-sink.ts";
import { handleMockSignIn, mockSignInFormHtml } from "./auth/mock-idp.ts";
import { auth, REVOCATION_KEY_PREFIX } from "./auth.ts";
import {
  byollmStatus,
  clearByollmCredential,
  loadByollmCredential,
  storeByollmCredential,
} from "./byollm-account.ts";
import { askFnFromDemoFixtures, DEMO_DB_ID } from "./chat/demo-shortcut.ts";
import { postChatMessage } from "./chat/orchestrate.ts";
import { makeChatStore } from "./chat/store.ts";
import { deriveSlug, displayName, listDatabasesForTenant } from "./databases/list.ts";
import { AGENT_MEMORY_V1_VERSION, type MemoryPreset } from "./db-create/presets/agent-memory-v1.ts";
import { resolveDb } from "./db-registry.ts";
import { sweepAnonDatabases } from "./db-sweep/sweep.ts";
import { recordEvalReport, recordWishlist } from "./events-feature.ts";
import {
  isAllowedEngine,
  MAX_GOAL_LENGTH,
  parseAskBody,
  parseGoalDbBody,
  parseJsonBody,
  parseRunBody,
} from "./http.ts";
import { runIcpCluster } from "./icp-cluster.ts";
import { runIcpScore } from "./icp-score.ts";
import { runIcpScrape } from "./icp-scrape.ts";
import { getLLMRouter } from "./llm-router.ts";
import {
  orchestrateRemember,
  type RememberError,
  validateRememberInput,
} from "./memory/remember.ts";
import { makeRequireSession, type RequireSessionVariables } from "./middleware.ts";
import { handleMcpCallback, handleMcpCallbackRedeem } from "./oauth-mcp-bridge.ts";
import {
  accountTenantIdFromPrincipal,
  makeRequirePrincipal,
  type Principal,
  type RequirePrincipalVariables,
  rateLimitBucketKey,
  surfaceFromPrincipal,
} from "./principal.ts";
import { orchestrateRun, type RunError } from "./run/orchestrate.ts";
import {
  blocksNewCheckout,
  type CustomerRow,
  resolveBillingStatus,
} from "./stripe/billing-status.ts";
import { type CheckoutPlan, createCheckoutSession } from "./stripe/checkout.ts";
import { cryptoProvider, stripe as stripeClient } from "./stripe/client.ts";
import { createPortalSession } from "./stripe/portal.ts";
import { processWebhook } from "./stripe/webhook.ts";
import { verifyTurnstile } from "./turnstile.ts";
import { runWorkloadAnalyser } from "./workload-analyser/index.ts";

const SERVICE_VERSION = "0.1.0";

// `Cloudflare.Env` is augmented in src/env.d.ts — using it directly
// (rather than a parallel local `Bindings` type) keeps the two from
// drifting when bindings are added.
const app = new Hono<{
  Bindings: Cloudflare.Env;
  Variables: RequireSessionVariables & RequirePrincipalVariables;
}>();

// Triage instrumentation — log full stack on any uncaught error so
// `wrangler tail` shows the origin of opaque crashes (e.g. the
// "Cannot read properties of undefined (reading 'href')" 500 we're
// chasing). Hono's default handler `console.error(err)` truncates to
// the message in JSON tail format. Remove once that bug is closed.
app.onError((err, c) => {
  const e = err as Error;
  console.error(
    JSON.stringify({
      msg: "unhandled_error",
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
      path: c.req.path,
      method: c.req.method,
    }),
  );
  return c.text("Internal Server Error", 500);
});

// CORS allow-list. Post SK-AUTH-016 the product UI and API are
// same-origin (`app.nlqdb.com`), so product fetches don't need CORS.
// The marketing site (`nlqdb.com` / Pages) still calls `/v1/ask`
// cross-origin with an anon bearer (SK-WEB-008); that needs an
// explicit entry because `credentials: include` rejects `origin: *`.
//
// Preview environments are same-origin too (single merged worker per
// PR via `preview-app.yml`), so no preview-URL regexes are needed.
const CORS_ALLOWED_ORIGINS = [
  "https://app.nlqdb.com",
  "https://nlqdb.com",
  "https://www.nlqdb.com",
  "https://nlqdb-web.pages.dev",
  "http://localhost:4321",
  "http://localhost:8787",
];

const credentialedCors = cors({
  origin: (origin) => {
    if (!origin) return null;
    return CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null;
  },
  credentials: true,
  // `traceparent` is sent by the SK-WEB-001 error reporter on every
  // cross-origin POST to `/v1/errors/web`. Hono's CORS middleware
  // returns the literal list as `Access-Control-Allow-Headers`; if
  // the header isn't here, browsers silently abort the preflight.
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "cf-turnstile-response",
    "idempotency-key",
    "traceparent",
    // SK-LLM-021 — the signed-in-only BYOLLM lane is cookie-session, so it
    // rides this credentialed handler; without it browsers abort the preflight.
    "x-nlq-byollm-key",
  ],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  maxAge: 86400,
});

// Third-party <nlq-data> embeds send `Authorization: Bearer pk_live_*`
// from arbitrary customer origins. `credentials: true` is incompatible
// with `origin: *`, so we use a separate non-credentialed handler.
// Phase 1 skips per-key origin pinning (SK-APIKEYS-003 open question).
// Preflight has no `Authorization` header — only the requested-headers
// list — so we look for it there too.
const pkLiveCors = cors({
  origin: (origin, c) => {
    if (!origin) return null;
    const reqHeaders = c.req.header("access-control-request-headers") ?? "";
    const auth = c.req.header("authorization") ?? "";
    const looksLikePkLive =
      auth.toLowerCase().includes("pk_live_") || reqHeaders.toLowerCase().includes("authorization");
    return looksLikePkLive ? origin : null;
  },
  credentials: false,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  maxAge: 86400,
});

app.use("/api/auth/*", credentialedCors);
// `/v1/ask` is hit by both trusted origins (cookie / anon-bearer from
// the product UI + marketing site) and arbitrary third-party origins
// carrying `Bearer pk_live_*`. Chaining `cors()` middleware doesn't
// work: Hono's cors short-circuits preflight with a 204 even when its
// `origin` callback returns `null`, so the second handler never runs.
// Dispatch on origin instead.
app.use("/v1/ask", (c, next) => {
  const origin = c.req.header("origin") ?? "";
  const handler = CORS_ALLOWED_ORIGINS.includes(origin) ? credentialedCors : pkLiveCors;
  return handler(c, next);
});
app.use("/v1/chat/*", credentialedCors);
app.use("/v1/databases", credentialedCors);
app.use("/v1/databases/*", credentialedCors);
app.use("/v1/db/*", credentialedCors);

// Session gate for `/v1/*` routes. Captures `auth.api.getSession`
// (cookieCache fast path → secondaryStorage → D1) + the KV revocation
// lookup at module load; the callbacks fire per request. See
// src/middleware.ts and PERFORMANCE §4 row 6.
const sessionResolver = {
  getSession: async (req: Request) => {
    // `request: req` gives Better Auth's internal context the URL it
    // needs (a previous attempt that omitted it 500'd in production —
    // see commit b0c6ade). `asResponse: false` opts out of the
    // Response-object wrapping that Better Auth otherwise applies
    // whenever a `request` is present (`shouldReturnResponse` in
    // `to-auth-endpoints.mjs`); without it, `result` would be a
    // Response, not the typed `{ session, user } | null` shape.
    const result = await auth.api.getSession({
      headers: req.headers,
      request: req,
      asResponse: false,
    });
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

// `/v1/ask` accepts cookie sessions, `Bearer anon_<token>`,
// `Bearer pk_live_<token>`, or — once `sk_live_` / `sk_mcp_` keys
// are minted via `POST /v1/keys` — `Bearer sk_live_<…>` /
// `Bearer sk_mcp_<host>_<device>_<…>` (SK-ANON-001, SK-ANON-006,
// SK-APIKEYS-001, SK-MCP-010 slice 1).
const requirePrincipal = makeRequirePrincipal({
  ...sessionResolver,
  lookupPkLiveKey: (key) => lookupPkLiveKeyImpl(env.DB, apiKeyHmacSecret(env), key),
  lookupSkKey: (key) => lookupSkKeyImpl(env.DB, apiKeyHmacSecret(env), key),
  bumpKeyLastUsed: (keyId) => bumpKeyLastUsedImpl(env.DB, keyId),
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

// `POST /v1/errors/web` — best-effort sink for browser-side crashes
// (`SK-WEB-001`). The web layer's `ErrorBoundary` and `Base.astro`
// pre-hydration handler POST here so islanded throws and pre-React
// crashes surface in the same OTel pipeline as server errors. Auth
// is intentionally not required — we want anon-mode crashes too.
//
// Abuse safeguards (the endpoint is unauthenticated):
//   - Reject bodies > 4 KB by `Content-Length` BEFORE reading
//     (avoids tying up the isolate on a 100 MB body just to drop it).
//   - Per-isolate dedup by `hash(surface+message+stack[0..200])`
//     with a 5-minute TTL — a reload loop on the same broken state
//     creates one span, not one per reload. Memory-bounded; the LRU
//     is per-isolate so a Cloudflare cold-start gets a clean cache,
//     which is acceptable because real abuse is already shaped by
//     Cloudflare's edge rate limiter.
//   - Per-isolate cap of `WEB_ERROR_MAX_PER_MINUTE`: above that,
//     drop spans silently. The 204 stays so the client doesn't
//     retry-storm; we just don't fan out to OTel.
//
// CORS uses `credentialedCors` for its origin allowlist; the client
// fetch is `credentials: "omit"` so no cookies ride. The endpoint
// reads nothing from the session — the safeguards above are sized
// for "anyone in an allowed origin can POST text".
const ERROR_SINK_BODY_CAP_BYTES = 4096;
const ERROR_SINK_DEDUP_TTL_MS = 5 * 60 * 1000;
const ERROR_SINK_DEDUP_MAX = 512;
const ERROR_SINK_MAX_PER_MINUTE = 600;
const errorSinkSeen = new Map<string, number>();
const errorSinkRate = { windowStartedAt: 0, count: 0 };

function errorSinkFingerprint(body: Record<string, unknown>): string {
  const surface = String(body["surface"] ?? "").slice(0, 64);
  const message = String(body["message"] ?? "").slice(0, 240);
  const stackHead = typeof body["stack"] === "string" ? body["stack"].slice(0, 200) : "";
  return `${surface}::${message}::${stackHead}`;
}

function errorSinkAllow(now: number, fp: string): boolean {
  if (now - errorSinkRate.windowStartedAt > 60_000) {
    errorSinkRate.windowStartedAt = now;
    errorSinkRate.count = 0;
  }
  if (errorSinkRate.count >= ERROR_SINK_MAX_PER_MINUTE) return false;
  const seenAt = errorSinkSeen.get(fp);
  if (seenAt !== undefined && now - seenAt < ERROR_SINK_DEDUP_TTL_MS) return false;
  if (errorSinkSeen.size >= ERROR_SINK_DEDUP_MAX) {
    // Cheap eviction — clear half the entries when full. A true LRU
    // costs more bytes than the dedup is worth.
    for (const k of Array.from(errorSinkSeen.keys()).slice(0, ERROR_SINK_DEDUP_MAX / 2)) {
      errorSinkSeen.delete(k);
    }
  }
  errorSinkSeen.set(fp, now);
  errorSinkRate.count += 1;
  return true;
}

// Test-only seam — vitest sets/clears this so cases don't leak.
export function _resetErrorSinkForTests(): void {
  errorSinkSeen.clear();
  errorSinkRate.windowStartedAt = 0;
  errorSinkRate.count = 0;
}

// W3C Trace Context propagation (browser → server). Parses the
// `traceparent` header so the `nlqdb.web.error` span attaches to the
// trace the client started — that way an OTel backend (Tempo) groups
// the server-side record with whatever browser-side context the
// reporting page held. We don't register a global propagator because
// only this endpoint reads incoming `traceparent` today; the parser
// stays local and the cost is one regex per error report.
//
// Header format (W3C Trace Context v1):
//   version "-" trace_id "-" parent_id "-" trace_flags
//   00       -  32-hex    -  16-hex     -  2-hex
const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
// A well-formed v00 traceparent is exactly 55 bytes. Workers accepts
// header values up to ~16 KB; rejecting on length first means a
// hostile 16 KB `traceparent` never reaches `trim()`/`toLowerCase()`
// (each of which would walk the full string and allocate a copy).
const TRACEPARENT_MAX_LEN = 80;

export function parseTraceparent(header: string | null | undefined): SpanContext | null {
  if (!header || header.length > TRACEPARENT_MAX_LEN) return null;
  const match = TRACEPARENT_RE.exec(header.trim().toLowerCase());
  if (!match) return null;
  const [, version, traceId, spanId, flags] = match;
  if (!version || !traceId || !spanId || !flags) return null;
  // Only `00` is defined today; later versions MAY append fields, but
  // the spec says receivers MUST ignore them and treat the prefix as
  // v00. Until a v01 exists, restrict to v00 to avoid silently mis-
  // parsing future syntax.
  if (version !== "00") return null;
  if (!isValidTraceId(traceId) || !isValidSpanId(spanId)) return null;
  return {
    traceId,
    spanId,
    traceFlags: (Number.parseInt(flags, 16) & TraceFlags.SAMPLED) as TraceFlags,
    isRemote: true,
  };
}

// Classify the incoming `traceparent` for an observability attribute.
// `missing` and `malformed` are the two failure modes a dashboard
// needs to distinguish — a fleet-wide jump in `malformed` means a
// browser change broke our minter; a jump in `missing` means an old
// cached bundle is still in the wild.
function classifyTraceparent(header: string | null | undefined): "valid" | "missing" | "malformed" {
  if (!header) return "missing";
  return parseTraceparent(header) ? "valid" : "malformed";
}

app.use("/v1/errors/web", credentialedCors);
app.post("/v1/errors/web", async (c) => {
  try {
    const lenHeader = c.req.header("content-length");
    if (lenHeader && Number.parseInt(lenHeader, 10) > ERROR_SINK_BODY_CAP_BYTES) {
      return c.body(null, 204);
    }
    const raw = await c.req.raw.clone().text();
    if (raw.length > ERROR_SINK_BODY_CAP_BYTES) {
      return c.body(null, 204);
    }
    const body = JSON.parse(raw) as Record<string, unknown>;
    const fp = errorSinkFingerprint(body);
    if (!errorSinkAllow(Date.now(), fp)) {
      return c.body(null, 204);
    }
    const tracer = trace.getTracer("@nlqdb/api");
    const traceparentHeader = c.req.header("traceparent");
    const parentSpanContext = parseTraceparent(traceparentHeader);
    const parentContext = parentSpanContext
      ? trace.setSpanContext(ROOT_CONTEXT, parentSpanContext)
      : ROOT_CONTEXT;
    tracer.startActiveSpan("nlqdb.web.error", {}, parentContext, (span) => {
      // try/finally so a throw in `redactPii` (defensive — its regex
      // pipeline is hardened, but the outer `try/catch` would still
      // leave the span unended on the BatchSpanProcessor, where most
      // backends render it as "in progress" forever).
      try {
        // The browser sink is unauthenticated and accepts any string
        // the page can put in `e.message` / `e.stack` — user prompts,
        // recovered URLs, and 5xx response bodies all routinely
        // contain PII (emails, Bearer tokens, API keys, phone
        // numbers). Every string that becomes a span attribute is
        // routed through `redactPii` before truncation so spans (and
        // any downstream exporter) never see raw PII. `surface` is
        // set by our own code today ("ChatPanel" / "CreateForm" /
        // "boot") but the request body is network-controlled, so we
        // redact + cap it too rather than trusting the client.
        span.setAttribute(
          "nlqdb.web.surface",
          redactPii(String(body["surface"] ?? "unknown")).slice(0, 64),
        );
        span.setAttribute(
          "nlqdb.web.message",
          redactPii(String(body["message"] ?? "")).slice(0, 240),
        );
        if (typeof body["href"] === "string") {
          span.setAttribute("nlqdb.web.href", redactPii(body["href"]).slice(0, 240));
        }
        if (typeof body["stack"] === "string") {
          span.setAttribute("nlqdb.web.stack", redactPii(body["stack"]).slice(0, 2048));
        }
        if (typeof body["componentStack"] === "string") {
          span.setAttribute(
            "nlqdb.web.componentStack",
            redactPii(body["componentStack"]).slice(0, 2048),
          );
        }
        // Propagation health — `valid` lets a Tempo dashboard count
        // how often browser → server traceparent chained; `missing`
        // vs `malformed` distinguishes "old cached bundle" from
        // "browser change broke our minter". Low cardinality (3
        // values) so it's metric-label safe.
        span.setAttribute("nlqdb.web.traceparent_observed", classifyTraceparent(traceparentHeader));
      } finally {
        span.end();
      }
    });
  } catch {
    // Best-effort — never let the error sink itself fail loudly.
  }
  return c.body(null, 204);
});

// Mock IdP routes (SK-AUTH-018). Active only when env.MOCK_IDP === "1";
// in production the flag is unset and these routes 404. The override on
// `/auth/sign-in` is intentional — in mock mode the form replaces the
// static Astro sign-in page bundled into the [assets] binding.
if (env.MOCK_IDP === "1") {
  app.get("/auth/sign-in", (c) => c.html(mockSignInFormHtml(new URL(c.req.url).origin)));
  app.get("/api/auth/mock-sign-in", (c) => handleMockSignIn(c));
  app.get("/api/dev/inbox", async (c) => c.json(await listInbox(c.env.KV)));
}

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
    const surface = surfaceFromPrincipal(principal);
    span.setAttribute("nlqdb.principal.kind", principal.kind);
    span.setAttribute("nlqdb.principal.id", principal.id);
    span.setAttribute("nlqdb.surface", surface);

    const parsed = await parseAskBody(c);
    if (!parsed.ok) {
      span.end();
      return c.json(parsed.error.body, parsed.error.status);
    }
    span.setAttribute("nlqdb.ask.goal_preview", redactPii(parsed.body.goal).slice(0, 200));

    // SK-LLM-016 step 1 — per-request BYOLLM key (signed-in only). When
    // `x-nlq-byollm-key` is present the query path (route + plan +
    // summarize) dispatches through the user's own provider key at 0%
    // markup (GLOBAL-026) instead of the free chain; the create/DDL path
    // stays on the free chain this slice (tracked in premium-tier). Anon /
    // API-key principals may not carry it: a raw provider key must ride a
    // first-party session, never a header an un-audited MCP host or
    // `pk_live_` embed could replay (SK-PREMIUM-008 point 8). The
    // credential never enters a span/log — only the bounded
    // `llm.byollm_provider` slug does (resolveAskRouter).
    let byollmCredential: ByollmCredential | null = null;
    const byollmHeaderRaw = c.req.header(BYOLLM_HEADER);
    if (byollmHeaderRaw !== undefined && byollmHeaderRaw.trim() !== "") {
      if (principal.kind !== "user") {
        span.setAttribute("nlqdb.ask.outcome", "byollm_requires_session");
        span.end();
        return c.json(
          {
            error: {
              status: "byollm_requires_session" as const,
              message: `${BYOLLM_HEADER} requires a signed-in session; sign in to use your own LLM key.`,
            },
          },
          400,
        );
      }
      const parsedKey = parseByollmHeader(byollmHeaderRaw);
      if (!parsedKey.ok) {
        span.setAttribute("nlqdb.ask.outcome", "byollm_invalid_key");
        span.end();
        return c.json(
          { error: { status: "invalid_byollm_key" as const, message: parsedKey.message } },
          400,
        );
      }
      byollmCredential = parsedKey.credential;
    }

    const accept = c.req.header("accept") ?? "";
    const wantsSse = accept.includes("text/event-stream");
    const wantsJsonOnly = accept.includes("application/json") && !accept.includes("*/*");

    // SK-APIKEYS-003: pk_live_ keys are read-only and scoped to one DB.
    // Auto-fill dbId from the principal if the caller omitted it, and
    // block any non-query kind at parse time so the create path is never
    // reached. Rate limiting uses the authed bucket (not the anon gates).
    if (principal.kind === "pk_live") {
      if (!parsed.body.dbId) {
        parsed.body.dbId = principal.dbId;
      }
    }

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
        // SK-EVENTS-010: anon-tier rate-limit hit → demand-signal.
        // Fire-and-forget through ctx.waitUntil so the 429 doesn't
        // wait on the queue enqueue.
        c.executionCtx.waitUntil(
          buildEventEmitter(c.env.EVENTS_QUEUE).emit({
            name: "feature.requested.heavier_tier",
            principalId: principal.id,
            surface,
          }),
        );
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

      // SK-ANON-012 — per-device cap. Fires at the TOP of /v1/ask so
      // it gates ALL anon traffic (any kind), not just creates. The
      // 1st anon call lets routeAsk classify normally; on success we
      // commit (count → 1). The 2nd anon call lands here, peek
      // returns ok=false, and we 401 with the auth_required envelope
      // — the surface stashes pending + redirects to sign-in. Without
      // this top-level peek, routeAsk would auto-target the user's
      // single anon DB on the 2nd call (`single_db_auto_target`) and
      // run a query against it, bypassing the auth-wall the worksheet
      // designed for the hero flow.
      const devicePeek = await anonLimiter.peekDevice(principal.id);
      if (!devicePeek.ok) {
        span.setAttribute("nlqdb.ask.outcome", "auth_required_device_cap");
        span.end();
        return c.json(
          {
            error: {
              status: "auth_required" as const,
              code: "anon_device_cap" as const,
              signInUrl: buildSignInUrl(c.req.header("referer")),
              action: "Sign in to create another database — your draft is saved.",
            },
          },
          401,
        );
      }

      // Record the global counter only after BOTH gates clear and
      // the request is actually about to be served. Per-IP bucket
      // already incremented inside `checkQuery`. The per-device cap
      // commits later, after the orchestrator returns ok (WS5 fix C).
      // Fire-and-forget: the response doesn't wait on the increment.
      c.executionCtx.waitUntil(globalLimiter.record());
    }

    // dbId resolution (SK-ASK-009): when absent, one cheap-tier
    // `routeAsk` call decides `{kind, targetDbId, referencedTables}`
    // from the goal + dbset + recent-tables MRU. `kind=create` (or
    // any kind with 0 DBs for the tenant) routes the create path;
    // otherwise we use the picked `targetDbId` if confidence ≥
    // ROUTE_CONFIDENCE_FLOOR (0.7) — below it the handler returns
    // `409 candidate_dbs`. The 1-DB auto-target stays a deterministic
    // shortcut (the tenant has nowhere else to go).
    let selectedDbEcho: SelectedDbEcho | null = null;

    // Anon-create gate, split into peek + commit (WS5 fix C). Peek
    // runs at gate-entry on `runCreatePath`; commit only runs after
    // the orchestrator returns `result.ok === true`. Failed creates
    // (ambiguous_goal / plan_invalid / compile_failed / …) no longer
    // burn the per-IP create cap. Both halves no-op for non-anon
    // principals (SK-ANON-006 keeps `principal.kind` out of the
    // orchestrator). The peek/commit pure logic lives in
    // `anon-create-gate.ts`; this closure adapts the typed decision
    // into a Hono Response and emits the X-RateLimit-* headers.
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const gateDeps = {
      limiter: makeAnonRateLimiter(c.env.KV),
      verifyTurnstile,
    };
    const peekAnonCreateGate = async (): Promise<Response | null> => {
      const decision = await peekAnonCreateGateImpl(gateDeps, {
        principalKind: principal.kind,
        principalId: principal.id,
        ip,
        turnstileSecret: c.env.TURNSTILE_SECRET,
        turnstileToken: c.req.header("cf-turnstile-response") ?? null,
      });
      return decisionToResponse(c, span, decision);
    };
    const commitAnonCreate = async (): Promise<void> => {
      await commitAnonCreateImpl(gateDeps, {
        principalKind: principal.kind,
        principalId: principal.id,
      });
    };

    // libpg-query WASM init guard — needs `__filename` / `__dirname`
    // to be defined on the global object before the dynamic import.
    // See header of `apps/api/src/ask/sql-validate-ddl.ts`.
    const ensureLibpgWasmGlobals = (): void => {
      const g = globalThis as unknown as { __filename?: string; __dirname?: string };
      if (typeof g.__filename === "undefined") g.__filename = "worker";
      if (typeof g.__dirname === "undefined") g.__dirname = "/";
    };

    // Format a `DbCreateResult` as the JSON response from `runCreatePath`.
    const formatCreateJsonResponse = (
      result: import("./db-create/types.ts").DbCreateResult,
    ): Response => {
      if (!result.ok) {
        // infer/compile/ddl/embed_failed → 422; provision_failed → 500.
        const statusCode = result.error.kind === "provision_failed" ? 500 : 422;
        return c.json({ error: result.error }, statusCode);
      }
      return c.json({
        kind: "create" as const,
        db: result.dbId,
        displayName: displayName(result.dbId),
        schemaName: result.schemaName,
        engine: result.engine,
        pkLive: result.pkLive,
        plan: result.plan,
        sampleRows: result.sampleRows,
      });
    };

    // SK-DB-010 / WS5 fix B — explicit body.engine wins; anon falls
    // back to postgres (skips the cheap-tier classifier LLM); authed
    // stays undefined so the classifier runs.
    const engineOverride: Engine | undefined = resolveAnonEngineOverride(
      parsed.body.engine,
      principal.kind,
    );

    // Helper closure for the create path — invoked when classifier
    // says `kind=create`, OR when the tenant has 0 DBs and the kind
    // wasn't create (architecture §3.6.4: "0 dbs → CREATE"). Anon-
    // create gating is enforced before the LLM/Neon work runs; the
    // per-device counter (SK-ANON-012) increments only on
    // `result.ok === true` (WS5 fix C).
    const runCreatePath = async (): Promise<Response> => {
      const gateResp = await peekAnonCreateGate();
      if (gateResp) return gateResp;

      // Dynamic import defers libpg-query's WASM initialization to
      // the first create request — see commit 1a body for the
      // rationale.
      //
      // libpg-query@17.x ships an Emscripten-generated WASM loader
      // whose `ENVIRONMENT_IS_NODE` branch calls `fs.readFileSync`
      // on a path derived from `__dirname`. Cloudflare Workers'
      // `nodejs_compat` provides `process.versions.node` (triggering
      // that branch) but its `fs` polyfill can't read arbitrary
      // paths. The `__filename` / `__dirname` polyfills below steer
      // the Emscripten heuristic, but `sql-validate-ddl.ts` now
      // gracefully degrades if loadModule() still fails — see that
      // file's header comment for the full story.
      ensureLibpgWasmGlobals();
      // `test/ask.test.ts SK-ANON-013` is `.skip`'d — this dynamic
      // import hangs in the workerd vitest-pool after prior /v1/ask
      // requests; root cause is in build-deps' static-import chain
      // (past sql-validate-ddl), pool-side only, not production.
      const { buildDbCreateDeps } = await import("./db-create/build-deps.ts");
      const { orchestrateDbCreate } = await import("./db-create/orchestrate.ts");
      try {
        // SK-HDC-013 — pass executionCtx.waitUntil so the orchestrator's
        // tail steps (recent-tables MRU, table-card embedding) fire
        // off-path after the response goes back to the user.
        const { deps: createDeps, secretRef } = buildDbCreateDeps(c.env, (p) =>
          c.executionCtx.waitUntil(p),
        );
        const result = await orchestrateDbCreate(createDeps, {
          goal: parsed.body.goal,
          tenantId: principal.id,
          // SK-DB-010 — explicit override flows through; for anon
          // principals (Phase 0/1 ships postgres only per SK-DB-002)
          // pin to postgres so we skip the cheap-tier classifier LLM
          // hop on every anon create (WS5 fix B). Authed users still
          // get the classifier — they may pick BYO engines later.
          ...(engineOverride !== undefined ? { engine: engineOverride } : {}),
          secretRef,
        });
        if (result.ok) await commitAnonCreate();
        return formatCreateJsonResponse(result);
      } finally {
        span.end();
      }
    };

    // SK-ANON-013 — anon principals short-circuit to runCreatePath
    // when no dbId is pinned. Anon has no data to query: the first
    // call is always create; the second call is already blocked at
    // peekDevice above (SK-ANON-012) and redirected to sign-in. The
    // post-OAuth landing page replays the queued prompt as an authed
    // call, which takes the normal classifier path.
    //
    // Skipping routeAsk/listDb/recent_tables for anon eliminates the
    // SK-ASK-011-era cascade observed in prod (anon goal misclassified
    // as `kind=query` against a stale DB, 502 `db_unreachable` after
    // 21 s). SDK users who pin a dbId still flow through the query
    // path — a pinned bearer + dbId is a legitimate follow-up.
    if (principal.kind === "anon" && !parsed.body.dbId) {
      return runCreatePath();
    }

    // Resolve the dispatch lane once (free vs the per-request BYOLLM key)
    // so routeAsk, plan and summarize all ride the same router — a BYOLLM
    // ask runs end-to-end on the user's key (and fails loud as one unit if
    // the key is bad), never half on their key and half on ours. The free
    // router is the cached singleton, so the non-BYOLLM path costs nothing
    // extra; the BYOLLM path builds one single-provider router per request.
    // Lane span attributes are stamped on the query path only (below), so
    // the create branches — which keep the free DDL router — aren't
    // mislabelled.
    // SK-LLM-016 step 2 — account-stored BYOLLM key. Only when the request
    // carried no header key (step 1 wins) and the principal is a signed-in
    // user (a stored key is decryptable, so it must ride a first-party
    // session, same threat model as the header lane). One indexed D1 read +
    // a decrypt; a stored-but-unopenable key fails loud (GLOBAL-012) rather
    // than silently dropping to the free chain (SK-PREMIUM-008 point 6).
    let accountCredential: ByollmCredential | null = null;
    if (!byollmCredential && principal.kind === "user") {
      try {
        accountCredential = await loadByollmCredential(c.env.DB, c.env, principal.id);
      } catch {
        span.setAttribute("nlqdb.ask.outcome", "byollm_unavailable");
        span.end();
        return c.json(
          {
            error: {
              status: "byollm_unavailable" as const,
              message:
                "Your stored BYOLLM key could not be unsealed; re-add it under your account keys.",
            },
          },
          503,
        );
      }
    }

    const routing = resolveAskRouter({
      headerCredential: byollmCredential,
      accountCredential,
      freeRouter: getLLMRouter(),
      gateway: { accountId: c.env.AI_GATEWAY_ACCOUNT_ID, gatewayId: c.env.AI_GATEWAY_ID },
      userId: principal.id,
    });
    if (!routing.ok) {
      span.setAttribute("nlqdb.ask.outcome", "byollm_gateway_unconfigured");
      span.end();
      return c.json(
        {
          error: {
            status: "byollm_unavailable" as const,
            message:
              "BYOLLM is not configured on this deployment; the built-in models are still available.",
          },
        },
        503,
      );
    }

    // SK-FRONTIER-001..004 — dormant founder-funded frontier lane. While
    // HAS_FRONTIER_API_KEYS is false, `resolveFrontierAskRouter` returns null
    // before any env/KV access, so this is a provable no-op and the
    // free/BYOLLM router from `resolveAskRouter` stands unchanged. Only the
    // FREE query path is upgraded — a selected BYOLLM lane (the user's own
    // key) always wins, so we skip when that lane was chosen. Mutating
    // `routing.router` matches how the BYOLLM router already propagates to the
    // query path (the create/DDL branches keep the free router).
    if (routing.attributes["llm.dispatch_lane"] !== "byollm") {
      const frontierRouter = await resolveFrontierAskRouter(c.env, principal.kind, {
        e2e: (c.req.header("x-nlqdb-e2e") ?? "") === "1",
      });
      if (frontierRouter) routing.router = frontierRouter;
    }

    // SK-ASK-009 + SK-ASK-014 prelude — routeAsk runs on every authed
    // /v1/ask (with or without a pinned dbId), in parallel with the
    // tenant DB list. Dispatch after routeAsk:
    //
    //   kind=create + no pin    → runCreatePath()
    //   kind=create + pinned    → 409 clarify_required (SK-ASK-014)
    //   kind=query|write + pin  → honour the pin
    //   kind=query|write + no   → 0/1/N dispatch (existing)
    //
    // PERFORMANCE §2.3 owns the budget for this prelude.
    //
    // WS5 fix A — kickoffAskPrelude fires both reads synchronously
    // before yielding. `listPromise` is awaited inside `routePromise`;
    // `recentTablesPromise` is awaited inside routeAsk's input. KV
    // blip → routeAsk still runs; D1 blip → routeAsk sees `dbs: []`
    // (see catch below).
    const recentTablesStore = makeRecentTablesStore(c.env.KV);
    const { listPromise, recentTablesPromise } = kickoffAskPrelude(
      {
        listDatabases: (id) => listDatabasesForTenant(c.env.DB, id),
        loadRecentTables: (id) => recentTablesStore.load(id),
      },
      principal.id,
    );
    let recentTables = await recentTablesPromise;
    // SK-ASK-018 — fall back to the pinned DB's schema_text when the
    // MRU cache is cold (e.g. freshly-adopted user). Best-effort: a D1
    // hiccup leaves the empty MRU, same end-state as today.
    if (recentTables.length === 0 && parsed.body.dbId) {
      const pinnedDb = await resolveDb(c.env.DB, parsed.body.dbId, principal.id).catch(() => null);
      if (pinnedDb) recentTables = seedFromPinnedDb(pinnedDb);
    }

    // SK-ASK-009 — routeAsk runs in parallel with listPromise.
    // Wraps both: routeAsk's `dbs` input comes from the awaited
    // listPromise (or `[]` if that read fails — routeAsk then
    // returns kind=create deterministically). SK-ASK-013 / GLOBAL-022
    // retries the LLM call inside routeAsk up to 3 attempts before
    // surfacing as `llm_failed`.
    const routePromise = (async () => {
      let dbs: Awaited<ReturnType<typeof listDatabasesForTenant>>;
      try {
        dbs = await listPromise;
      } catch {
        // Tenant DB list failed — treat as 0 dbs so routeAsk picks
        // create. The follow-up create path will surface the real
        // error to the user.
        return {
          candidates: [] as ReturnType<typeof toCandidates>,
          output: await withStageRetry("route", () =>
            routeAsk(
              { llm: routing.router },
              {
                goal: parsed.body.goal,
                dbs: [],
                recentTables,
              },
            ),
          ),
        };
      }
      const candidates = toCandidates(dbs);
      const output = await withStageRetry("route", () =>
        routeAsk(
          { llm: routing.router },
          {
            goal: parsed.body.goal,
            dbs: candidates,
            recentTables,
          },
        ),
      );
      return { candidates, output };
    })();

    let routed: Awaited<typeof routePromise>;
    try {
      routed = await routePromise;
    } catch {
      span.setAttribute("nlqdb.ask.outcome", "router_failed");
      span.end();
      return c.json({ error: { status: "llm_failed" as const } }, 502);
    }

    const { candidates: tenantCandidates, output: routeOutput } = routed;
    span.setAttribute("nlqdb.ask.kind", routeOutput.kind);
    span.setAttribute("nlqdb.ask.kind_reason", routeOutput.reason);
    span.setAttribute("nlqdb.ask.tenant_db_count", tenantCandidates.length);

    // kind=create dispatch.
    if (routeOutput.kind === "create") {
      // SK-APIKEYS-003 — pk_live_ keys are read-only; creates are forbidden.
      if (principal.kind === "pk_live") {
        span.setAttribute("nlqdb.ask.outcome", "pk_live_create_rejected");
        span.end();
        return c.json({ error: "forbidden", reason: "pk_live_read_only" }, 403);
      }
      if (parsed.body.dbId) {
        // SK-ASK-014 — pinned dbId + classifier wants create. Surface
        // a typed clarification chip rather than letting the LLM emit
        // CREATE TABLE through the read/write path and have the
        // allowlist reject it as the cryptic `disallowed_verb`.
        const pinned = tenantCandidates.find((d) => d.id === parsed.body.dbId);
        span.setAttribute("nlqdb.ask.outcome", "clarify_create_with_pinned_db");
        span.end();
        return c.json(
          {
            error: {
              status: "clarify_required" as const,
              clarification: "create_or_query_pinned" as const,
              pinned_db: pinned ? { id: pinned.id, slug: pinned.slug } : null,
              reason: routeOutput.reason,
            },
          },
          409,
        );
      }
      return runCreatePath();
    }

    // kind=query|write — honour the pin if set; otherwise run the
    // 0/1/N-db dispatch.
    if (!parsed.body.dbId) {
      if (tenantCandidates.length === 0) {
        // Defense in depth — `routeAsk` returns kind=create on 0 dbs
        // (the architecture §3.6.4 rule). If we land here with kind=
        // query|write and no DBs, fall back to create so we don't
        // 409 a user who has no place to write.
        span.setAttribute("nlqdb.ask.dbid_resolution", "zero_dbs_create_fallback");
        return runCreatePath();
      }

      if (tenantCandidates.length === 1) {
        const only = tenantCandidates[0];
        if (only) {
          parsed.body.dbId = only.id;
          selectedDbEcho = {
            id: only.id,
            slug: only.slug,
            confidence: 1,
            reason: "single_db_auto_target",
          };
          span.setAttribute("nlqdb.ask.dbid_resolution", "single_db_auto");
        }
      } else {
        span.setAttribute("nlqdb.ask.disambiguate_confidence", routeOutput.confidence);
        span.setAttribute("nlqdb.ask.disambiguate_reason", routeOutput.reason);
        if (routeOutput.targetDbId !== null && routeOutput.confidence >= ROUTE_CONFIDENCE_FLOOR) {
          const chosen = tenantCandidates.find((d) => d.id === routeOutput.targetDbId);
          if (chosen) {
            parsed.body.dbId = chosen.id;
            selectedDbEcho = {
              id: chosen.id,
              slug: chosen.slug,
              confidence: routeOutput.confidence,
              reason: routeOutput.reason,
            };
            const resolutionLabel =
              routeOutput.reason === "slug_match"
                ? "slug_fastpath"
                : routeOutput.reason === "recent_table_match"
                  ? "recent_table_fastpath"
                  : "llm_auto_target";
            span.setAttribute("nlqdb.ask.dbid_resolution", resolutionLabel);
          }
        }
        if (!parsed.body.dbId) {
          span.setAttribute("nlqdb.ask.dbid_resolution", "ambiguous_409");
          span.end();
          return c.json(
            {
              error: {
                status: "ambiguous_db" as const,
                candidate_dbs: tenantCandidates.map((d) => ({ id: d.id, slug: d.slug })),
                reason: routeOutput.reason,
              },
            },
            409,
          );
        }
      }
    }

    // Now on the query/write path — stamp the redacted lane attributes
    // (the create branches above returned on the free DDL router and are
    // deliberately left unlabelled) and build the orchestrator deps on the
    // lane resolved above.
    for (const [key, value] of Object.entries(routing.attributes)) {
      span.setAttribute(key, value);
    }
    const deps = buildAskDeps(c.env, routing.router);
    // After the SK-ASK-009 resolution above, `dbId` is guaranteed to
    // be set — either by the caller, by the 1-DB auto-target, or by
    // routeAsk (recent-table fast-path / slug fast-path / LLM pick).
    const resolvedDbId = parsed.body.dbId;
    if (!resolvedDbId) {
      // Defensive: shouldn't happen — every branch above either sets
      // dbId, returns the create response, or returns 409. Surface as
      // a 500 rather than letting the orchestrator crash on undefined.
      span.end();
      return c.json({ error: { status: "ambiguous_db" as const } }, 409);
    }
    const orchestrateReq = {
      goal: parsed.body.goal,
      dbId: resolvedDbId,
      userId: principal.id,
      rateLimitBucketKey: rateLimitBucketKey(principal),
      ...(parsed.body.confirm ? { confirm: true as const } : {}),
    };

    // SK-ANON-002 / SK-ANON-012 — bump `last_queried_at` on every
    // successful /v1/ask so the daily sweep evicts truly-stale anon
    // DBs (90-day TTL) and picks oldest-first under cap pressure.
    // Authed user rows benefit too (drives "recent activity" reads
    // on the dashboard). Fire-and-forget via ctx.waitUntil — never
    // on the user-visible latency path. Only fires when the
    // orchestrator returned ok; failures don't bump.
    const touchLastQueried = (): void => {
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          "UPDATE databases SET last_queried_at = unixepoch() WHERE id = ? AND tenant_id = ?",
        )
          .bind(resolvedDbId, principal.id)
          .run()
          .catch((err: unknown) => {
            console.error(
              JSON.stringify({
                msg: "last_queried_at_touch_failed",
                message: err instanceof Error ? err.message : String(err),
              }),
            );
          }),
      );
    };

    if (wantsSse) {
      return streamSSE(c, async (stream) => {
        try {
          // SK-ASK-009 (echo carry-over from SK-ASK-003): emit
          // `selected_db` first so the chat surface can render the
          // "picked X" attribution chip before plan_pending lands.
          if (selectedDbEcho) {
            await stream.writeSSE({
              event: "selected_db",
              data: JSON.stringify({ db: selectedDbEcho }),
            });
          }
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
            emitFeatureSignal(
              buildEventEmitter(c.env.EVENTS_QUEUE),
              c.executionCtx,
              principal.id,
              surface,
              outcome.error,
            );
          } else {
            // Detach the ask.completed producer so the queue.send
            // round-trip runs after the SSE stream closes (PERFORMANCE
            // §3.1 — the emit is `ctx.waitUntil`-wrapped, never on the
            // user-visible path).
            c.executionCtx.waitUntil(outcome.pendingAskCompleted);
            // SK-TRUST-001 — preview hop didn't exec; skip the anon
            // cap commit (SK-ANON-012) and `last_queried_at` bump so
            // the confirm hop can still land. The cap commits when
            // the user approves and the write actually runs.
            if (!outcome.result.requires_confirm) {
              // SK-ANON-012 — commit the per-device cap on any successful
              // anon /v1/ask (not just creates). The 2nd anon call will
              // then trip the top-level peek and 401 with auth_required.
              await commitAnonCreate();
              touchLastQueried();
            }
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
        emitFeatureSignal(
          buildEventEmitter(c.env.EVENTS_QUEUE),
          c.executionCtx,
          principal.id,
          surface,
          outcome.error,
        );
        return c.json({ error: outcome.error }, httpStatus);
      }
      // Detach the ask.completed producer so queue.send runs in
      // ctx.waitUntil after the response flushes — keeps /v1/ask p99
      // off the queue producer round-trip (PERFORMANCE §3.1).
      c.executionCtx.waitUntil(outcome.pendingAskCompleted);
      // SK-TRUST-001 — preview hop didn't exec; skip the anon cap
      // commit + `last_queried_at` bump so the confirm hop can still
      // land. Same logic as the SSE branch above.
      if (!outcome.result.requires_confirm) {
        // SK-ANON-012 — commit the per-device cap on any successful
        // anon /v1/ask (not just creates). See the SSE branch for the
        // matching commit.
        await commitAnonCreate();
        touchLastQueried();
      }
      // SK-ASK-003: append the `selected_db` echo to the JSON envelope
      // when the LLM disambiguator (or single-DB auto-target) chose
      // for the user. Surface uses it to render attribution.
      const body = selectedDbEcho
        ? { ...outcome.result, selected_db: selectedDbEcho }
        : outcome.result;
      return c.json(body);
    } finally {
      span.end();
    }
  });
});

// `POST /v1/run` — `GLOBAL-015` escape hatch (`SK-SDK-009`); orchestrator owns the WHY.
app.use("/v1/run", (c, next) => {
  const origin = c.req.header("origin") ?? "";
  const handler = CORS_ALLOWED_ORIGINS.includes(origin) ? credentialedCors : pkLiveCors;
  return handler(c, next);
});

app.post("/v1/run", requirePrincipal, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.run", async (span) => {
    try {
      const principal = c.var.principal as Principal;
      const surface = surfaceFromPrincipal(principal);
      span.setAttribute("nlqdb.principal.kind", principal.kind);
      span.setAttribute("nlqdb.principal.id", principal.id);
      span.setAttribute("nlqdb.surface", surface);

      const parsed = await parseRunBody(c, { dbOptional: principal.kind === "pk_live" });
      if (!parsed.ok) {
        span.setAttribute("nlqdb.run.outcome", parsed.error.body.error);
        return c.json(parsed.error.body, parsed.error.status);
      }
      if (principal.kind === "pk_live" && !parsed.body.db) {
        parsed.body.db = principal.dbId;
      }
      span.setAttribute("nlqdb.run.sql_preview", redactPii(parsed.body.sql).slice(0, 200));

      // Anon-tier gates mirror `/v1/ask` ordering so raw-SQL can't sidestep the chat path's caps.
      if (principal.kind === "anon") {
        const globalLimiter = makeGlobalAnonLimiter(c.env.KV);
        const globalPeek = await globalLimiter.peek();
        if (!globalPeek.ok) {
          span.setAttribute("nlqdb.run.outcome", "auth_required_global_cap");
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
        const now = Math.floor(Date.now() / 1000);
        c.header("X-RateLimit-Limit", String(verdict.limit));
        c.header("X-RateLimit-Remaining", String(Math.max(0, verdict.limit - verdict.count)));
        c.header("X-RateLimit-Reset", String(verdict.resetAt));
        if (!verdict.ok) {
          span.setAttribute("nlqdb.run.outcome", "rate_limited_ip");
          // `SK-EVENTS-010` — same demand-signal class as the `/v1/ask` anon trip.
          c.executionCtx.waitUntil(
            buildEventEmitter(c.env.EVENTS_QUEUE).emit({
              name: "feature.requested.heavier_tier",
              principalId: principal.id,
              surface,
            }),
          );
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
        const devicePeek = await anonLimiter.peekDevice(principal.id);
        if (!devicePeek.ok) {
          span.setAttribute("nlqdb.run.outcome", "auth_required_device_cap");
          return c.json(
            {
              error: {
                status: "auth_required" as const,
                code: "anon_device_cap" as const,
                signInUrl: buildSignInUrl(c.req.header("referer")),
                action: "Sign in to keep going — your draft is saved.",
              },
            },
            401,
          );
        }
        c.executionCtx.waitUntil(globalLimiter.record());
      }

      const deps = buildAskDeps(c.env);
      const outcome = await orchestrateRun(
        {
          resolveDb: deps.resolveDb,
          exec: deps.exec,
          rateLimiter: deps.rateLimiter,
        },
        {
          sql: parsed.body.sql,
          dbId: parsed.body.db,
          userId: principal.id,
          rateLimitBucketKey: rateLimitBucketKey(principal),
          ...(principal.kind === "pk_live" ? { readOnly: true } : {}),
        },
      );

      if (!outcome.ok) {
        const httpStatus = runErrorStatus(outcome.error);
        if (outcome.error.status === "rate_limited") {
          const { limit, count, resetAt } = outcome.error;
          const now = Math.floor(Date.now() / 1000);
          c.header("X-RateLimit-Limit", String(limit));
          c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
          c.header("X-RateLimit-Reset", String(resetAt));
          c.header("Retry-After", String(Math.max(0, resetAt - now)));
        }
        // Inlined (not via `emitFeatureSignal`) because that helper also fires `ddl_via_ask` — wrong name for `/v1/run`.
        if (outcome.error.status === "rate_limited") {
          c.executionCtx.waitUntil(
            buildEventEmitter(c.env.EVENTS_QUEUE).emit({
              name: "feature.requested.heavier_tier",
              principalId: principal.id,
              surface,
            }),
          );
        }
        span.setAttribute("nlqdb.run.outcome", outcome.error.status);
        return c.json({ error: outcome.error }, httpStatus);
      }

      span.setAttribute("nlqdb.run.outcome", "ok");
      span.setAttribute("nlqdb.run.rows_returned", outcome.result.rowCount);

      // `last_queried_at` bump runs off-path so raw-SQL traffic shows in the rail's recent-activity surface.
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          "UPDATE databases SET last_queried_at = unixepoch() WHERE id = ? AND tenant_id = ?",
        )
          .bind(parsed.body.db, principal.id)
          .run()
          .catch(() => undefined),
      );

      return c.json({ status: "ok" as const, ...outcome.result });
    } finally {
      span.end();
    }
  });
});

// `POST /v1/memory/remember` — the agent-memory **write** primitive
// (agent-memory pivot E-02). Materialises a typed row into the
// `agent_memory_v1` schema (E-01) with no LLM in the loop: the payload
// is structured, so the compiler emits a deterministic parameterised
// INSERT itself (trust boundary preserved — `memory/remember.ts`).
// Additive to the stable MCP tool contract (SK-MCP-002); `nlqdb_query`
// stays the read verb. Idempotency-Key is auto-keyed by the SDK on
// retries (SK-SDK-006) and accepted here, same posture as `/v1/run`
// (the general dedupe middleware is the idempotency feature's open work).
app.post("/v1/memory/remember", requirePrincipal, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.memory.remember.request", async (span) => {
    try {
      const principal = c.var.principal as Principal;
      const surface = surfaceFromPrincipal(principal);
      span.setAttribute("nlqdb.principal.kind", principal.kind);
      span.setAttribute("nlqdb.principal.id", principal.id);
      span.setAttribute("nlqdb.surface", surface);

      // The memory write needs a user-scoped key (the MCP tool contract).
      // pk_live_ embeds are read-only (SK-APIKEYS-003); anon principals
      // have no memory DB (the preset create is authed behind MEMORY_PRESET).
      if (principal.kind === "pk_live") {
        span.setAttribute("nlqdb.memory.outcome", "forbidden_read_only");
        return c.json({ error: { status: "forbidden", reason: "read_only_principal" } }, 403);
      }
      if (principal.kind === "anon") {
        span.setAttribute("nlqdb.memory.outcome", "auth_required");
        return c.json(
          {
            error: {
              status: "auth_required" as const,
              action: "Use a user-scoped key (sk_live_ or sk_mcp_) to write agent memory.",
            },
          },
          401,
        );
      }

      const raw = await parseJsonBody<unknown>(c);
      if (!raw.ok) {
        span.setAttribute("nlqdb.memory.outcome", "invalid_json");
        return c.json({ error: { status: "invalid_json" } }, 400);
      }
      const validated = validateRememberInput(raw.body);
      if (!validated.ok) {
        span.setAttribute("nlqdb.memory.outcome", "invalid_body");
        return c.json({ error: { status: "invalid_body", reason: validated.reason } }, 400);
      }
      span.setAttribute("nlqdb.memory.kind", validated.value.kind);

      const askDeps = buildAskDeps(c.env);
      const outcome = await orchestrateRemember(
        {
          resolveDb: askDeps.resolveDb,
          execMemory: buildMemoryExec,
          rateLimiter: askDeps.rateLimiter,
        },
        {
          args: validated.value,
          userId: principal.id,
          // E-03 narrows this to a per-agent identity; until then the
          // tenant id tags every row (the existing per-tenant isolation).
          agentId: principal.id,
          rateLimitBucketKey: rateLimitBucketKey(principal),
        },
      );

      if (!outcome.ok) {
        const httpStatus = rememberErrorStatus(outcome.error);
        if (outcome.error.status === "rate_limited") {
          const { limit, count, resetAt } = outcome.error;
          const now = Math.floor(Date.now() / 1000);
          c.header("X-RateLimit-Limit", String(limit));
          c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
          c.header("X-RateLimit-Reset", String(resetAt));
          c.header("Retry-After", String(Math.max(0, resetAt - now)));
        }
        span.setAttribute("nlqdb.memory.outcome", outcome.error.status);
        return c.json({ error: outcome.error }, httpStatus);
      }

      span.setAttribute("nlqdb.memory.outcome", "ok");
      // Memory writes count as activity — refresh `last_queried_at`
      // off-path so the DB surfaces in the rail's recent-activity list.
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          "UPDATE databases SET last_queried_at = unixepoch() WHERE id = ? AND tenant_id = ?",
        )
          .bind(validated.value.db, principal.id)
          .run()
          .catch(() => undefined),
      );

      return c.json({ status: "ok" as const, ...outcome.result });
    } finally {
      span.end();
    }
  });
});

// CORS: tightened to the same allow-list as `/api/auth/*` — these
// endpoints only ever load from nlqdb.com / pages.dev previews /
// localhost dev; the narrower posture keeps random sites from probing
// the rate-limit / abuse path from the browser.
app.use("/v1/events/*", credentialedCors);
app.use("/v1/billing/*", credentialedCors);

app.post("/v1/events/wishlist", async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.events.wishlist", async (span) => {
    try {
      const body = await parseJsonBody<{ surface?: unknown }>(c);
      if (!body.ok) {
        span.setAttribute("nlqdb.events.outcome", "invalid_body");
        return c.json({ error: { status: "invalid_body" } }, 400);
      }
      const result = await recordWishlist(
        { kv: c.env.KV, events: buildEventEmitter(c.env.EVENTS_QUEUE) },
        body.body.surface,
        c.req.header("cf-connecting-ip") ?? null,
      );
      if (result.status === 400) {
        span.setAttribute("nlqdb.events.outcome", result.reason);
        return c.json({ error: { status: result.reason } }, 400);
      }
      if (result.status === 429) {
        span.setAttribute("nlqdb.events.outcome", "rate_limited");
        // Fixed-window throttle; advise a full window's wait. Not the
        // exact remaining time (the throttle doesn't surface it), but
        // a safe upper bound — keeps clients backing off the way the
        // /v1/ask 429 path does.
        c.header("Retry-After", "60");
        return c.json({ error: { status: "rate_limited" } }, 429);
      }
      span.setAttribute("nlqdb.events.outcome", "accepted");
      span.setAttribute("nlqdb.events.surface", String(body.body.surface));
      c.executionCtx.waitUntil(result.pendingEmit);
      return c.json({ accepted: true }, 202);
    } finally {
      span.end();
    }
  });
});

// POST /v1/events/eval — bearer-authenticated run ingestion for
// SK-QUAL-002. The GH-Actions on-demand runner POSTs its full eval report
// (plus baseline diff) here after every successful run; we mint the
// `feature.eval.weekly` event + one `feature.eval.regression` per
// triggered (lane, trigger) tuple, then fire-and-forget the queue
// writes via `waitUntil`. 503 when the secret isn't configured matches
// the unconfigured-sink posture (`SK-EVENTS-005`).
app.post("/v1/events/eval", async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.events.eval", async (span) => {
    try {
      const expected = c.env.EVAL_INGEST_TOKEN;
      if (!expected) {
        span.setAttribute("nlqdb.events.outcome", "unconfigured");
        return c.json({ error: { status: "unconfigured" } }, 503);
      }
      const body = await parseJsonBody<unknown>(c);
      if (!body.ok) {
        span.setAttribute("nlqdb.events.outcome", "invalid_body");
        return c.json({ error: { status: "invalid_body" } }, 400);
      }
      const result = recordEvalReport(
        buildEventEmitter(c.env.EVENTS_QUEUE),
        c.req.header("authorization") ?? null,
        expected,
        body.body,
      );
      if (result.status === 401) {
        span.setAttribute("nlqdb.events.outcome", "unauthorized");
        return c.json({ error: { status: "unauthorized" } }, 401);
      }
      if (result.status === 400) {
        span.setAttribute("nlqdb.events.outcome", result.reason);
        return c.json({ error: { status: result.reason } }, 400);
      }
      span.setAttribute("nlqdb.events.outcome", "accepted");
      span.setAttribute("nlqdb.events.emitted", result.emitted);
      for (const p of result.pendingEmits) c.executionCtx.waitUntil(p);
      return c.json({ accepted: true, emitted: result.emitted }, 202);
    } finally {
      span.end();
    }
  });
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
  const mockStripe = c.env.MOCK_STRIPE === "1";
  if (!mockStripe && !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "secret_unconfigured" }, 503);
  }
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature") ?? null;

  const result = await processWebhook(
    {
      signer: stripeClient.webhooks,
      cryptoProvider,
      webhookSecret: c.env.STRIPE_WEBHOOK_SECRET ?? "",
      db: c.env.DB,
      r2: c.env.ASSETS,
      events: buildEventEmitter(c.env.EVENTS_QUEUE),
      bypassSignatureVerification: mockStripe,
    },
    rawBody,
    signature,
  );

  if (result.status === 200 && result.archive) {
    c.executionCtx.waitUntil(result.archive);
  }
  return c.json(result.body, result.status);
});

// `POST /v1/billing/checkout` — create a Stripe Checkout Session for
// Hobby or Pro plan subscription (SK-STRIPE-004).
//
// Requires a signed-in session (`requireSession`). Accepts `{ plan:
// "hobby" | "pro" }`; success/cancel URLs are derived server-side from
// the request origin (never client-supplied, to close the open-redirect).
// Returns `{ url }` for client-side redirect to Stripe-hosted checkout.
// Forwards `Idempotency-Key` to Stripe (GLOBAL-005).
//
// 503 when STRIPE_SECRET_KEY or the plan price ID is not configured.
// 400 for an invalid plan value. 500 for Stripe API failures.
// 409 already_subscribed when the caller already holds a live subscription —
// tier changes go through the Billing Portal so Stripe prorates; a second
// Checkout would create a parallel subscription and double-bill (SK-STRIPE-010).
app.post("/v1/billing/checkout", requireSession, async (c) => {
  const session = c.var.session;

  const raw = await parseJsonBody<{ plan?: unknown }>(c);
  if (!raw.ok) {
    return c.json({ error: "invalid_json" }, 400);
  }

  const plan = raw.body.plan;
  if (plan !== "hobby" && plan !== "pro") {
    return c.json({ error: "invalid_plan", allowed: ["hobby", "pro"] }, 400);
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "billing_not_configured" }, 503);
  }

  const existing = await c.env.DB.prepare(
    "SELECT status, stripe_customer_id FROM customers WHERE user_id = ?",
  )
    .bind(session.user.id)
    .first<{ status: string; stripe_customer_id: string }>();
  if (blocksNewCheckout(existing?.status)) {
    // Rare by construction (the page routes subscribers to the Portal), so one
    // structured line per reject is observable without being spammy.
    console.info(
      JSON.stringify({ msg: "checkout_blocked_already_subscribed", status: existing?.status }),
    );
    return c.json({ error: "already_subscribed" }, 409);
  }

  const origin = new URL(c.req.url).origin;
  const successUrl = `${origin}/app?checkout=success`;
  const cancelUrl = `${origin}/pricing`;

  const result = await createCheckoutSession(
    {
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      priceIdHobby: c.env.STRIPE_PRICE_HOBBY ?? "",
      priceIdPro: c.env.STRIPE_PRICE_PRO ?? "",
      userId: session.user.id,
      userEmail: session.user.email,
      // Non-null only on the re-subscribe path (a terminal-status row survived
      // the guard above) — SK-STRIPE-014.
      existingStripeCustomerId: existing?.stripe_customer_id ?? null,
      idempotencyKey: c.req.header("Idempotency-Key") ?? null,
    },
    plan as CheckoutPlan,
    successUrl,
    cancelUrl,
  );

  return c.json(result.body, result.status);
});

// `POST /v1/billing/portal` — open the Stripe-hosted Billing Portal so a
// subscriber can update their card, switch plan, download invoices, or
// cancel (one click, no dark patterns — SK-STRIPE-008).
//
// Requires a signed-in session (`requireSession`). No request body: the
// `return_url` is derived server-side from the request origin (never
// client-supplied, same open-redirect closure as checkout). The caller's
// Stripe customer is looked up from the `customers` D1 table; a user who
// never checked out has no row → 404 no_customer. Forwards
// `Idempotency-Key` to Stripe (GLOBAL-005).
//
// 503 when STRIPE_SECRET_KEY is not configured. 500 for Stripe API failures.
app.post("/v1/billing/portal", requireSession, async (c) => {
  const session = c.var.session;

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "billing_not_configured" }, 503);
  }

  const customer = await c.env.DB.prepare(
    "SELECT stripe_customer_id FROM customers WHERE user_id = ?",
  )
    .bind(session.user.id)
    .first<{ stripe_customer_id: string }>();

  if (!customer?.stripe_customer_id) {
    return c.json({ error: "no_customer" }, 404);
  }

  const origin = new URL(c.req.url).origin;

  const result = await createPortalSession(
    {
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      stripeCustomerId: customer.stripe_customer_id,
      userId: session.user.id,
      idempotencyKey: c.req.header("Idempotency-Key") ?? null,
    },
    `${origin}/app`,
  );

  return c.json(result.body, result.status);
});

// `GET /v1/billing/status` — the caller's current subscription state so the
// /pricing page can badge their active tier and reveal "Manage billing" only
// to actual subscribers (SK-STRIPE-009). A plain indexed D1 read, no Stripe
// call: it works before any live keys exist, returning
// `{ plan: "free", status: "none", manageable: false }` for a free user.
// Web-only (GLOBAL-003), like checkout/portal.
app.get("/v1/billing/status", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.billing.status", async (span) => {
    try {
      const session = c.var.session;
      span.setAttribute("nlqdb.user.id", session.user.id);
      const row = await c.env.DB.prepare(
        "SELECT status, price_id, current_period_end, cancel_at_period_end FROM customers WHERE user_id = ?",
      )
        .bind(session.user.id)
        .first<CustomerRow>();
      const status = resolveBillingStatus(row, c.env.STRIPE_PRICE_HOBBY, c.env.STRIPE_PRICE_PRO);
      span.setAttribute("nlqdb.billing.plan", status.plan);
      span.setAttribute("nlqdb.billing.subscription_status", status.status);
      return c.json(status);
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      return c.json({ error: "internal" }, 500);
    } finally {
      span.end();
    }
  });
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
  // SK-ANON-014 — `dbId` echoes the adopted DB so callers can pin it
  // synchronously (e.g. the post-signin landing appends `?db=<id>`).
  // Null when the anon DB was already evicted by the sweep job.
  return c.json({ adopted: result.adopted, dbId: result.dbId });
});

app.get("/v1/chat/messages", requireSession, async (c) => {
  const session = c.var.session;
  const store = makeChatStore(c.env.DB);
  const messages = await store.list(session.user.id);
  return c.json({ messages });
});

// `POST /v1/keys` — canonical mint endpoint per SK-APIKEYS-007.
// Mints `sk_live_` (account-scoped backend secret) or `sk_mcp_*`
// (per-host per-device MCP key, SK-APIKEYS-004). Session-only by
// design: a leaked `sk_live_` must not be able to mint more keys.
// `pk_live_` keys aren't mintable here — they're a side-effect of
// `db.create` (see `db-create/build-deps.ts`).
//
// Response carries the plaintext exactly once (SK-APIKEYS-002 +
// SK-APIKEYS-007); subsequent reads return `last4` only.
const KEY_NAME_MAX = 80;
const MCP_HOST_MAX = 32;
const DEVICE_ID_MAX = 64;

app.post("/v1/keys", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.keys.mint", async (span) => {
    try {
      const session = c.var.session;
      span.setAttribute("nlqdb.user.id", session.user.id);

      const raw = await parseJsonBody<{
        type?: unknown;
        host?: unknown;
        device?: unknown;
        name?: unknown;
      }>(c);
      if (!raw.ok) {
        span.setAttribute("nlqdb.keys.mint.outcome", "invalid_json");
        return c.json({ error: "invalid_json" }, 400);
      }

      const type = raw.body.type;
      if (type !== "sk_live" && type !== "sk_mcp") {
        span.setAttribute("nlqdb.keys.mint.outcome", "invalid_type");
        return c.json({ error: "invalid_type", allowed: ["sk_live", "sk_mcp"] }, 400);
      }
      span.setAttribute("nlqdb.keys.mint.type", type);

      if (type === "sk_live") {
        const trimmedName = typeof raw.body.name === "string" ? raw.body.name.trim() : "";
        if (trimmedName.length > KEY_NAME_MAX) {
          span.setAttribute("nlqdb.keys.mint.outcome", "name_too_long");
          return c.json({ error: "name_too_long", maxLength: KEY_NAME_MAX }, 400);
        }
        const name = trimmedName.length > 0 ? trimmedName : null;
        const { id, plaintext } = await mintSkLiveKey(
          c.env.DB,
          apiKeyHmacSecret(c.env),
          session.user.id,
          name,
        );
        span.setAttribute("nlqdb.keys.mint.outcome", "ok");
        return c.json({
          id,
          type,
          key: plaintext,
          last4: plaintext.slice(-4),
          ...(name ? { name } : {}),
        });
      }

      // sk_mcp — host and device are required claims (SK-APIKEYS-004).
      const host = typeof raw.body.host === "string" ? raw.body.host.trim() : "";
      const device = typeof raw.body.device === "string" ? raw.body.device.trim() : "";
      if (!host || !device) {
        span.setAttribute("nlqdb.keys.mint.outcome", "missing_claims");
        return c.json({ error: "missing_claims", required: ["host", "device"] }, 400);
      }
      if (host.length > MCP_HOST_MAX) {
        span.setAttribute("nlqdb.keys.mint.outcome", "host_too_long");
        return c.json({ error: "host_too_long", maxLength: MCP_HOST_MAX }, 400);
      }
      if (device.length > DEVICE_ID_MAX) {
        span.setAttribute("nlqdb.keys.mint.outcome", "device_too_long");
        return c.json({ error: "device_too_long", maxLength: DEVICE_ID_MAX }, 400);
      }
      const { id, plaintext } = await mintSkMcpKey(
        c.env.DB,
        apiKeyHmacSecret(c.env),
        session.user.id,
        host,
        device,
      );
      span.setAttribute("nlqdb.keys.mint.outcome", "ok");
      span.setAttribute("nlqdb.mcp.host", host);
      return c.json({
        id,
        type,
        key: plaintext,
        last4: plaintext.slice(-4),
        host,
        device,
      });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.keys.mint.outcome", "mint_failed");
      return c.json({ error: "mint_failed" }, 500);
    } finally {
      span.end();
    }
  });
});

// `GET /v1/keys` — list the caller's keys (SK-APIKEYS-010). Session-only:
// a leaked `sk_live_` must not enumerate sibling keys (same threat model
// as the mint route at `POST /v1/keys`). Returns both active and revoked
// rows; revoked sort to the bottom so the surface can render two groups
// from one slice. Plaintext is never present — `last4` is the only
// display field (SK-APIKEYS-002).
app.get("/v1/keys", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.keys.list", async (span) => {
    try {
      const session = c.var.session;
      span.setAttribute("nlqdb.user.id", session.user.id);
      const keys = await listKeysByTenant(c.env.DB, session.user.id);
      span.setAttribute("nlqdb.keys.list.count", keys.length);
      span.setAttribute("nlqdb.keys.list.outcome", "ok");
      return c.json({ keys });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.keys.list.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// `/v1/keys/byollm` — account-stored BYOLLM credential (SK-PREMIUM-008,
// SK-PREMIUM-012). Session-only (a decryptable key must ride a first-party
// session, never a leakable bearer key — same threat model as the
// `x-nlq-byollm-key` header lane and the mint route). Registered before
// `/v1/keys/:id` so the static `byollm` segment wins over the param route.
// One credential per account: POST upserts, DELETE clears.
//
// `Idempotency-Key` (GLOBAL-005): both mutations are idempotent by
// construction — POST upserts by tenant and its response carries no
// volatile field (provider/model/last4 only), so a retry returns the same
// body byte-for-byte; DELETE is terminal. No dedup store is needed. The
// header is already CORS-allowed.
app.post("/v1/keys/byollm", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.keys.byollm.set", async (span) => {
    try {
      const session = c.var.session;
      span.setAttribute("nlqdb.user.id", session.user.id);
      const raw = await parseJsonBody<{ provider?: unknown; model?: unknown; key?: unknown }>(c);
      if (!raw.ok) {
        span.setAttribute("nlqdb.keys.byollm.set.outcome", "invalid_json");
        return c.json({ error: "invalid_json" }, 400);
      }
      const provider = typeof raw.body.provider === "string" ? raw.body.provider : "";
      const model = typeof raw.body.model === "string" ? raw.body.model : "";
      const key = typeof raw.body.key === "string" ? raw.body.key : "";
      const result = await storeByollmCredential(c.env.DB, c.env, session.user.id, {
        provider,
        model,
        apiKey: key,
      });
      if (!result.ok) {
        span.setAttribute("nlqdb.keys.byollm.set.outcome", result.reason);
        if (result.reason === "kek_unconfigured") {
          return c.json(
            {
              error: {
                status: "byollm_unavailable" as const,
                message: "BYOLLM key storage is not configured on this deployment.",
              },
            },
            503,
          );
        }
        return c.json(
          { error: { status: "invalid_byollm_key" as const, message: result.message } },
          400,
        );
      }
      // The provider slug is the only bounded value worth a span attribute;
      // the model rides `llm.model` on the dispatch span, the key never does.
      span.setAttribute("nlqdb.keys.byollm.set.outcome", "ok");
      span.setAttribute("llm.byollm_provider", result.provider);
      return c.json({
        configured: true,
        provider: result.provider,
        model: result.model,
        last4: result.last4,
      });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.keys.byollm.set.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// `GET /v1/keys/byollm` — status only; never returns the key or the sealed
// blob (`last4` is the display field, SK-APIKEYS-002). `configured: false`
// with no `credential` is the empty state, distinct from a 503 platform gap.
app.get("/v1/keys/byollm", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.keys.byollm.status", async (span) => {
    try {
      const session = c.var.session;
      span.setAttribute("nlqdb.user.id", session.user.id);
      const result = await byollmStatus(c.env.DB, c.env, session.user.id);
      if (!result.ok) {
        span.setAttribute("nlqdb.keys.byollm.status.outcome", "kek_unconfigured");
        return c.json(
          {
            error: {
              status: "byollm_unavailable" as const,
              message: "BYOLLM key storage is not configured on this deployment.",
            },
          },
          503,
        );
      }
      span.setAttribute("nlqdb.keys.byollm.status.outcome", "ok");
      span.setAttribute("nlqdb.keys.byollm.configured", result.status !== null);
      return c.json(
        result.status === null
          ? { configured: false }
          : { configured: true, credential: result.status },
      );
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.keys.byollm.status.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// `DELETE /v1/keys/byollm` — hard-clear the stored credential (the sealed
// blob is removed, the instant-revocation GLOBAL-018 wants). Idempotent:
// `cleared: false` when there was nothing to clear.
app.delete("/v1/keys/byollm", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.keys.byollm.clear", async (span) => {
    try {
      const session = c.var.session;
      span.setAttribute("nlqdb.user.id", session.user.id);
      const { cleared } = await clearByollmCredential(c.env.DB, session.user.id);
      span.setAttribute("nlqdb.keys.byollm.clear.outcome", cleared ? "cleared" : "absent");
      return c.json({ ok: true, cleared });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.keys.byollm.clear.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// `DELETE /v1/keys/:id` — hard-revoke (SK-APIKEYS-011). Session-only;
// tenant-scoped so a leaked id from another tenant returns 404, not 403
// (no existence leak across tenants — same posture as
// `DELETE /v1/databases/:id`). Idempotent re-DELETE returns 200 with
// `alreadyRevoked: true` per RFC 9110. Propagation to the MCP DO is
// ≤ 1 s via SK-MCP-014's revalidation probe; no extra cache bust here.
//
// SK-APIKEYS-005's 60-day rotation grace + webhook are not in this slice
// — that's the rotation feature. For now revocation is the destructive
// op; rotation will add a `deprecated_at` column alongside.
app.delete("/v1/keys/:id", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.keys.revoke", async (span) => {
    try {
      const session = c.var.session;
      const keyId = c.req.param("id");
      span.setAttribute("nlqdb.user.id", session.user.id);
      span.setAttribute("nlqdb.keys.revoke.key_id", keyId);
      const outcome = await revokeKeyById(c.env.DB, session.user.id, keyId);
      span.setAttribute("nlqdb.keys.revoke.outcome", outcome);
      if (outcome === "not_found") {
        return c.json({ error: { status: "key_not_found" as const } }, 404);
      }
      return c.json({ ok: true, alreadyRevoked: outcome === "already_revoked" });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.keys.revoke.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// `POST /v1/oauth/mcp-callback` — cross-Worker bridge for the hosted
// MCP OAuth flow (`SK-MCP-013`). The web app's `/oauth/mcp-authorize`
// page POSTs here after the user clicks Approve. We mint a one-shot
// code in KV (60 s TTL) keyed by user_id + the OAuth flow context,
// return it to the page, which navigates the browser to
// `mcp.nlqdb.com/oauth/mcp-bridge-callback?code=…`. `apps/mcp/`'s
// `defaultHandler` redeems the code and calls `OAuthProvider`'s
// `completeAuthorization` to mint the access token + `sk_mcp_*` key.
//
// `Idempotency-Key` (`GLOBAL-005`) — handler routes through
// `mintBridgeCode` which keys on `(user_id, idempotency_key)` per
// `SK-IDEMP-002`. No request-body caching (the response is a one-shot
// code, replay returns the same code which is the safe behavior).
app.post("/v1/oauth/mcp-callback", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.oauth.mcp_callback", async (span) => {
    try {
      span.setAttribute("nlqdb.user.id", c.var.session.user.id);
      return await handleMcpCallback(c, c.var.session, {
        kv: (ctx) => ctx.env.KV,
        mintKey: async (ctx, userId, mcpHost, deviceId) => {
          const { plaintext } = await mintSkMcpKey(
            ctx.env.DB,
            apiKeyHmacSecret(ctx.env),
            userId,
            mcpHost,
            deviceId,
          );
          const hash = await hmacHex(apiKeyHmacSecret(ctx.env), plaintext);
          return { plaintext, hash };
        },
        setOutcome: (_ctx, outcome) =>
          span.setAttribute("nlqdb.oauth.mcp_callback.outcome", outcome),
      });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.oauth.mcp_callback.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// Code-gated redemption — called Worker-to-Worker by `apps/mcp/`'s
// `/oauth/mcp-bridge-callback`. The one-shot code is the auth proof
// (16-byte random, 60 s TTL, delete-on-read). No session, no bearer.
app.post("/v1/oauth/mcp-callback/redeem", async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.oauth.mcp_callback_redeem", async (span) => {
    try {
      return await handleMcpCallbackRedeem(c, {
        kv: (ctx) => ctx.env.KV,
        setOutcome: (_ctx, outcome) =>
          span.setAttribute("nlqdb.oauth.mcp_callback_redeem.outcome", outcome),
      });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.oauth.mcp_callback_redeem.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// `GET /v1/keys/:hash/status` — DO-revalidation probe (`SK-MCP-014`).
// `apps/mcp/`'s `McpAgent` calls this every 1 s past its local cache
// TTL to re-check `revoked_at`. Authentication: the caller is itself
// holding a valid `sk_*` bearer (the cached one); `requirePrincipal`
// gates the request and we enforce that the caller's tenant matches
// the key row's tenant — a leaked key on one tenant cannot probe
// another tenant's revocation state.
app.get("/v1/keys/:hash/status", requirePrincipal, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.keys.status", async (span) => {
    try {
      const principal = c.var.principal;
      const tenantId = accountTenantIdFromPrincipal(principal);
      if (!tenantId) {
        span.setAttribute("nlqdb.keys.status.outcome", "account_required");
        return c.json({ error: "account_required" }, 403);
      }
      const keyHash = c.req.param("hash");
      if (!keyHash || keyHash.length !== 64 || !/^[0-9a-f]+$/.test(keyHash)) {
        span.setAttribute("nlqdb.keys.status.outcome", "invalid_hash");
        return c.json({ error: "invalid_hash" }, 400);
      }
      const row = await c.env.DB.prepare(
        "SELECT tenant_id, revoked_at FROM api_keys WHERE key_hash = ? AND key_type IN ('sk_live', 'sk_mcp')",
      )
        .bind(keyHash)
        .first<{ tenant_id: string; revoked_at: number | null }>();
      if (!row) {
        // 404 is the right shape — the DO treats this identically to
        // "revoked: true" (drops the cache + closes the session) but
        // we don't want to leak "this hash exists for another tenant".
        span.setAttribute("nlqdb.keys.status.outcome", "not_found");
        return c.json({ error: "not_found" }, 404);
      }
      if (row.tenant_id !== tenantId) {
        span.setAttribute("nlqdb.keys.status.outcome", "cross_tenant");
        return c.json({ error: "not_found" }, 404);
      }
      const status = await getKeyStatusByHash(c.env.DB, keyHash);
      if (!status) {
        span.setAttribute("nlqdb.keys.status.outcome", "not_found");
        return c.json({ error: "not_found" }, 404);
      }
      span.setAttribute("nlqdb.keys.status.outcome", status.revoked ? "revoked" : "active");
      return c.json({
        revoked: status.revoked,
        ...(status.revokedAt != null ? { revoked_at: status.revokedAt } : {}),
      });
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.keys.status.outcome", "internal_error");
      return c.json({ error: "internal_error" }, 500);
    } finally {
      span.end();
    }
  });
});

// `GET /v1/databases` — left-rail data source for the chat surface
// (apps/web/src/components/chat/LeftRail.tsx) and the MCP server's
// `nlqdb_list_databases` tool (packages/mcp). Tenant-scoped read of
// the `databases` registry. See databases/list.ts for the field-by-
// field rationale (why `pkLive` and `lastQueriedAt` are null at
// Phase 1).
//
// Accepts any account-scoped principal: cookie session (web), or
// `sk_live_` / `sk_mcp_` bearer (HTTP API / MCP host). anon and
// pk_live are rejected with `account_required` — they don't have a
// concept of "my databases" on the server side.
app.get("/v1/databases", requirePrincipal, async (c) => {
  const principal = c.var.principal;
  const tenantId = accountTenantIdFromPrincipal(principal);
  if (!tenantId) {
    return c.json({ error: "account_required" }, 403);
  }
  const databases = await listDatabasesForTenant(c.env.DB, tenantId);
  return c.json({ databases });
});

// `POST /v1/databases` — explicit named-database creation from the
// left-rail "+ New" affordance in the chat surface. Accepts
// `{ name?, goal? }` (at least one required); uses the same
// `orchestrateDbCreate` typed-plan pipeline as the `kind=create`
// branch of `/v1/ask`. Anonymous access is not permitted here —
// the left-rail only renders for authenticated sessions.
//
// Note: the `/v1/ask` create path inherits the `orchestrateAsk`
// per-account D1 limiter (`SK-HDC-008`); this dedicated
// `POST /v1/databases` and the sibling `DELETE /v1/databases/:id`
// do not yet pay through that same gate. The gap is bounded by
// `requireSession` (no anon traffic) and tenant scope (a user can
// only thrash their own DBs), so it's accepted for Phase 1.
app.post("/v1/databases", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.databases.create", async (span) => {
    const session = c.var.session;
    span.setAttribute("nlqdb.user.id", session.user.id);
    span.setAttribute("nlqdb.surface", "chat");

    const raw = await parseJsonBody<{
      name?: unknown;
      goal?: unknown;
      engine?: unknown;
      preset?: unknown;
    }>(c);
    if (!raw.ok) {
      span.end();
      return c.json({ error: { status: "invalid_json" as const } }, 400);
    }

    const name =
      typeof raw.body.name === "string" && raw.body.name.trim().length > 0
        ? raw.body.name.trim()
        : undefined;
    const goal =
      typeof raw.body.goal === "string" && raw.body.goal.trim().length > 0
        ? raw.body.goal.trim()
        : undefined;

    // SK-HDC-020 — opt-in agent-memory preset (E-01). Flag-gated so it can
    // be rolled back by clearing `MEMORY_PRESET`; pins postgres, so it
    // can't be combined with an explicit engine override; needs no goal
    // (the schema is deterministic).
    let preset: MemoryPreset | undefined;
    if (raw.body.preset !== undefined) {
      if (c.env.MEMORY_PRESET !== "1") {
        span.end();
        return c.json({ error: { status: "preset_disabled" as const } }, 400);
      }
      if (raw.body.preset !== AGENT_MEMORY_V1_VERSION) {
        span.end();
        return c.json(
          {
            error: {
              status: "invalid_preset" as const,
              value: raw.body.preset,
              allowed: [AGENT_MEMORY_V1_VERSION],
            },
          },
          400,
        );
      }
      if (raw.body.engine !== undefined) {
        span.end();
        return c.json({ error: { status: "preset_engine_conflict" as const } }, 400);
      }
      preset = raw.body.preset;
    }

    if (!preset && !name && !goal) {
      span.end();
      return c.json({ error: { status: "goal_required" as const } }, 400);
    }

    // SK-ASK-010 — enforce max goal/name length to bound LLM token cost.
    const effectiveGoal = goal ?? name ?? "";
    if (effectiveGoal.length > MAX_GOAL_LENGTH) {
      span.end();
      return c.json(
        { error: { status: "goal_too_long" as const, maxLength: MAX_GOAL_LENGTH } },
        400,
      );
    }

    // SK-DB-010 — explicit engine override on the create surface.
    // Unknown strings reject with `invalid_engine`; absent runs the
    // classifier inside the orchestrator. Envelope carries the
    // offending value + the allowed list so SDK / CLI consumers can
    // render a precise message (GLOBAL-012 — one sentence with the
    // next action).
    let engine: Engine | undefined;
    if (raw.body.engine !== undefined) {
      if (!isAllowedEngine(raw.body.engine)) {
        span.end();
        return c.json(
          {
            error: {
              status: "invalid_engine" as const,
              value: raw.body.engine,
              allowed: [...ALLOWED_ENGINES],
            },
          },
          400,
        );
      }
      engine = raw.body.engine;
    }

    // Same WASM polyfill as the /v1/ask runCreatePath — see that
    // block's comment for the full rationale. `sql-validate-ddl.ts`
    // gracefully degrades if loadModule() still fails on Workers.
    const g = globalThis as unknown as { __filename?: string; __dirname?: string };
    if (typeof g.__filename === "undefined") g.__filename = "worker";
    if (typeof g.__dirname === "undefined") g.__dirname = "/";

    const { buildDbCreateDeps } = await import("./db-create/build-deps.ts");
    const { orchestrateDbCreate } = await import("./db-create/orchestrate.ts");

    try {
      // SK-HDC-013 — same waitUntil wiring as the /v1/ask kind=create
      // branch above.
      const { deps: createDeps, secretRef } = buildDbCreateDeps(c.env, (p) =>
        c.executionCtx.waitUntil(p),
      );
      // The `if (!name && !goal)` guard above ensures at least one is
      // defined; the `?? ""` fallback satisfies Biome's
      // noNonNullAssertion without changing semantics (the string is
      // never empty at runtime).
      const result = await orchestrateDbCreate(createDeps, {
        goal: goal ?? name ?? "",
        ...(name !== undefined ? { name } : {}),
        ...(engine !== undefined ? { engine } : {}),
        ...(preset !== undefined ? { preset } : {}),
        tenantId: session.user.id,
        secretRef,
      });
      if (!result.ok) {
        span.setAttribute("nlqdb.databases.create.outcome", result.error.kind);
        span.end();
        const statusCode = result.error.kind === "provision_failed" ? 500 : 422;
        return c.json({ error: result.error }, statusCode);
      }
      span.setAttribute("nlqdb.databases.create.db_id", result.dbId);
      span.setAttribute("nlqdb.databases.create.engine", result.engine);
      span.end();
      return c.json(
        {
          dbId: result.dbId,
          slug: deriveSlug(result.dbId),
          engine: result.engine,
          pkLive: result.pkLive,
        },
        201,
      );
    } catch (err) {
      span.recordException(err as Error);
      span.end();
      throw err;
    }
  });
});

// `POST /v1/db/connect` — bring-your-own ClickHouse / Postgres. The
// caller posts `{ engine, connection_url, name? }`; we validate +
// egress-guard the URL (GLOBAL-035), introspect the live schema, seal
// the URL (GLOBAL-031), and register a BYO `databases` row. The schema
// is read out of the user's DB — there is no authored plan, so this does
// NOT route through the typed-plan create pipeline.
//
// Auth (GLOBAL-003 surface parity): `requirePrincipal`, then accept only
// account-scoped kinds — `user` (web ConnectForm) and `sk_live`
// (SDK / CLI / MCP). `anon`, `pk_live` (db-scoped), and `sk_mcp` are
// rejected 403 `connect_requires_account`: connecting a DB is an account
// action, not a per-DB embed action.
//
// Idempotency (GLOBAL-005): an `Idempotency-Key` header dedupes via KV
// `byo_connect:<tenantId>:<key>` so a client retry returns the same dbId
// instead of connecting (and minting a key for) a duplicate row.
//
// Secrets: the `connection_url` and any password never enter a span or
// log. Only `nlqdb.engine` and (on success) `nlqdb.db.connect.db_id`.
app.post("/v1/db/connect", requirePrincipal, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.db.connect", async (span) => {
    const principal = c.var.principal as Principal;
    span.setAttribute("nlqdb.principal.kind", principal.kind);
    span.setAttribute("nlqdb.principal.id", principal.id);

    // Only account-scoped principals may connect a database.
    const tenantId = accountTenantIdFromPrincipal(principal);
    if (!tenantId || (principal.kind !== "user" && principal.kind !== "sk_live")) {
      span.setAttribute("nlqdb.db.connect.outcome", "connect_requires_account");
      span.end();
      return c.json(
        {
          error: {
            status: "connect_requires_account" as const,
            message: "Connecting a database needs an account session or an sk_live key.",
          },
        },
        403,
      );
    }
    span.setAttribute("nlqdb.user.id", tenantId);

    const raw = await parseJsonBody<{ engine?: unknown; connection_url?: unknown; name?: unknown }>(
      c,
    );
    if (!raw.ok) {
      span.setAttribute("nlqdb.db.connect.outcome", "invalid_json");
      span.end();
      return c.json(
        { error: { status: "invalid_request" as const, message: "Body must be JSON." } },
        400,
      );
    }

    const engine = raw.body.engine;
    if (engine !== "clickhouse" && engine !== "postgres") {
      span.setAttribute("nlqdb.db.connect.outcome", "invalid_engine");
      span.end();
      return c.json(
        {
          error: {
            status: "invalid_request" as const,
            message: 'engine must be "clickhouse" or "postgres".',
          },
        },
        400,
      );
    }
    span.setAttribute("nlqdb.engine", engine);

    const connectionUrl =
      typeof raw.body.connection_url === "string" ? raw.body.connection_url.trim() : "";
    if (connectionUrl === "") {
      span.setAttribute("nlqdb.db.connect.outcome", "missing_connection_url");
      span.end();
      return c.json(
        { error: { status: "invalid_request" as const, message: "connection_url is required." } },
        400,
      );
    }
    const name =
      typeof raw.body.name === "string" && raw.body.name.trim().length > 0
        ? raw.body.name.trim()
        : undefined;

    // GLOBAL-005 — Idempotency-Key replay. A prior success stored the
    // minted dbId under this key; return it verbatim so the retry is a
    // no-op (no second connect, no second pk_live key).
    const idemKey = c.req.header("Idempotency-Key");
    const kvKey = idemKey ? `byo_connect:${tenantId}:${idemKey}` : null;
    if (kvKey) {
      const prior = await c.env.KV.get(kvKey);
      if (prior) {
        span.setAttribute("nlqdb.db.connect.outcome", "idempotent_replay");
        span.setAttribute("nlqdb.db.connect.db_id", prior);
        span.end();
        return c.json({ dbId: prior, name: name ?? null, engine, replayed: true }, 201);
      }
    }

    // Same WASM polyfill dodge as the create/delete handlers — the
    // dynamic import path can transitively pull `sql-validate-ddl.ts`'s
    // top-level `loadModule()`.
    const g = globalThis as unknown as { __filename?: string; __dirname?: string };
    if (typeof g.__filename === "undefined") g.__filename = "worker";
    if (typeof g.__dirname === "undefined") g.__dirname = "/";

    const { buildConnectByoDeps } = await import("./db-connect/build-deps.ts");
    const { connectByoDb } = await import("./db-connect/connect.ts");

    try {
      const deps = buildConnectByoDeps(c.env);
      const result = await connectByoDb(deps, {
        engine,
        connectionUrl,
        ...(name !== undefined ? { name } : {}),
        tenantId,
      });
      if (!result.ok) {
        // Map the orchestrator's HTTP status to the string error code the
        // SDK/CLI/MCP switch on (GLOBAL-003 parity): the typed
        // `introspection_failed` / `sealing_unconfigured` / `invalid_request`
        // codes only fire if the body carries the string, not the number.
        const code =
          result.status === 503
            ? ("sealing_unconfigured" as const)
            : result.status === 502
              ? ("introspection_failed" as const)
              : ("invalid_request" as const);
        span.setAttribute("nlqdb.db.connect.outcome", code);
        span.end();
        return c.json(
          { error: { status: code, message: result.message } },
          result.status as 400 | 502 | 503,
        );
      }
      span.setAttribute("nlqdb.db.connect.outcome", "ok");
      span.setAttribute("nlqdb.db.connect.db_id", result.dbId);
      if (kvKey) {
        // Store the dbId for 24h so a retry within the client's window
        // dedupes. Fire-and-forget — a KV write failure must not fail an
        // already-committed connect.
        c.executionCtx.waitUntil(
          c.env.KV.put(kvKey, result.dbId, { expirationTtl: 86_400 }).catch(() => {}),
        );
      }
      span.end();
      return c.json(
        {
          dbId: result.dbId,
          name: result.name,
          engine: result.engine,
          schemaPreview: result.schemaPreview,
          pkLive: result.pkLive,
        },
        201,
      );
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw err;
    }
  });
});

// `DELETE /v1/databases/:id` — destructive removal of a hosted DB.
// Reuses the SK-HDC-011 `dropSchemaAndRegistry` rollback primitive
// (DROP SCHEMA CASCADE then DELETE FROM databases) so create-time
// rollback and user-initiated delete share one code path. Per-DB
// `pk_live_*` keys carry the dbId in the api_keys row and become
// orphans on delete, so they're cleaned up here too.
//
// Confirmation is the UI's job (SK-HDC-016): a modal that forces the
// user to type the displayName. The endpoint trusts the caller —
// nothing here re-checks intent. Tenant scoping via `resolveDb` is
// the only safety: a leaked dbId from another tenant returns 404,
// not 403, so we don't leak existence information.
app.delete("/v1/databases/:id", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.databases.delete", async (span) => {
    const session = c.var.session;
    const dbId = c.req.param("id");
    span.setAttribute("nlqdb.user.id", session.user.id);
    span.setAttribute("nlqdb.databases.delete.db_id", dbId);

    const record = await resolveDb(c.env.DB, dbId, session.user.id);
    if (!record) {
      span.setAttribute("nlqdb.databases.delete.outcome", "not_found");
      span.end();
      return c.json({ error: { status: "db_not_found" as const } }, 404);
    }

    // Same WASM polyfill as the POST handler above — `build-deps.ts`
    // transitively pulls in `sql-validate-ddl.ts`'s top-level WASM
    // `loadModule()` even though the delete path never invokes it.
    // Keeping the dynamic import here matches POST's pattern and
    // dodges the cold-start `loadModule()` hang risk on isolates that
    // never hit a write path.
    const g = globalThis as unknown as { __filename?: string; __dirname?: string };
    if (typeof g.__filename === "undefined") g.__filename = "worker";
    if (typeof g.__dirname === "undefined") g.__dirname = "/";

    // Pull the lean `buildPgClient` + secret-ref resolver only — we
    // don't need the LLM router, embed deps, or recent-tables store
    // that `buildDbCreateDeps` wires up for the create path.
    // `stripDbPrefix` is a pure helper (no WASM dependency); both are
    // dynamic-imported through the same `neon-provision.ts` /
    // `build-deps.ts` modules so the WASM polyfill above still gates
    // the cold-start cost.
    const { buildPgClient, resolveDatabaseUrl } = await import("./db-create/build-deps.ts");
    const { dropSchemaAndRegistry, stripDbPrefix } = await import("./db-create/neon-provision.ts");

    try {
      const pg = buildPgClient(resolveDatabaseUrl(c.env));
      const schemaName = stripDbPrefix(dbId);
      await dropSchemaAndRegistry(tracer, pg, c.env.DB, dbId, schemaName);
      // pk_live_* keys are per-DB (SK-APIKEYS-001) and become orphans
      // when the DB is deleted. Clean them up so a re-created DB with
      // the same id (vanishingly unlikely; 6-hex collision) doesn't
      // inherit them, and so the api_keys table doesn't accumulate
      // tombstones for removed DBs.
      await c.env.DB.prepare("DELETE FROM api_keys WHERE db_id = ?").bind(dbId).run();
      span.setAttribute("nlqdb.databases.delete.outcome", "ok");
      span.end();
      return c.body(null, 204);
    } catch (err) {
      // Typed 500 envelope so SDK consumers see a structured
      // `code: "internal_error"` rather than the wire-layer's
      // `unknown_error` fallback. Matches `POST /v1/oauth/...` and
      // `GET /v1/keys/:hash/status` shape.
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.setAttribute("nlqdb.databases.delete.outcome", "internal_error");
      span.end();
      return c.json({ error: "internal_error" as const }, 500);
    }
  });
});

app.post("/v1/chat/messages", requireSession, async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.chat.turn", async (span) => {
    const session = c.var.session;
    span.setAttribute("nlqdb.user.id", session.user.id);
    span.setAttribute("nlqdb.surface", "chat");

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
      emitFeatureSignal(
        buildEventEmitter(c.env.EVENTS_QUEUE),
        c.executionCtx,
        session.user.id,
        "chat",
        outcome.error,
      );
      return c.json({ error: outcome.error }, httpStatus);
    }
    span.setAttribute("nlqdb.chat.outcome", "persisted");
    span.setAttribute("nlqdb.chat.assistant_kind", outcome.assistant.result.kind);
    if (outcome.pendingAskCompleted) {
      // Detach the ask.completed producer so queue.send runs after
      // the response flushes (PERFORMANCE §3.1 — same posture as the
      // /v1/ask handler).
      c.executionCtx.waitUntil(outcome.pendingAskCompleted);
    }
    span.end();
    return c.json({ user: outcome.user, assistant: outcome.assistant });
  });
});

function serializeEvent(event: OrchestrateEvent): string {
  return JSON.stringify(event);
}

// Render the gate's typed decision (from `anon-create-gate.ts`)
// into a Hono Response. The gate now only enforces the Turnstile
// bot-floor — the per-device cap (SK-ANON-012) is checked at the
// top of `/v1/ask`, so it never bubbles up to this helper. Non-anon
// principals + Turnstile-pass return `null` so the route handler
// proceeds. Turnstile-fail returns 428 challenge_required.
function decisionToResponse(
  // Hono's Context is generic over Bindings + Variables — keep this
  // helper agnostic so route handlers with different Variable shapes
  // can call it without a cast.
  c: Context,
  span: Span,
  decision: AnonCreateGateDecision,
): Response | null {
  if (decision.kind === "skip") return null;
  if (decision.kind === "allow") return null;
  // challenge_required — Turnstile verify failed. 428 so the surface
  // re-renders the widget (`SK-ANON-007` envelope shape unchanged).
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

// Sign-in URL the global-anon-cap response hands the surface
// (SK-ANON-010). The `return` query-param round-trips the page the
// user was on; the surface is responsible for stashing the prompt
// in localStorage before redirecting (SK-ANON-011 — the prompt
// itself never travels through the URL or the server).
//
// Default web origin is `https://nlqdb.com`; overridden via
// `MAGIC_LINK_WEB_ORIGIN` so dev / staging point at the local Astro
// dev server instead of prod.
// Map the D1 row shape from `listDatabasesForTenant` to the
// disambiguator's candidate shape. Local helper rather than a
// public export — the shape is incidental to the route handler.
function toCandidates(
  dbs: Awaited<ReturnType<typeof listDatabasesForTenant>>,
): { id: string; slug: string }[] {
  return dbs.map((d) => ({ id: d.id, slug: d.slug }));
}

function buildSignInUrl(referer: string | undefined): string {
  const origin =
    env.MAGIC_LINK_WEB_ORIGIN ??
    (typeof auth.options.baseURL === "string" ? auth.options.baseURL : "https://app.nlqdb.com");
  const url = new URL("/auth/sign-in", origin);
  if (referer) {
    try {
      const refUrl = new URL(referer);
      // Only allow same-origin returns — never let an attacker craft
      // a 401 response that hands the surface an off-domain redirect.
      if (refUrl.origin === origin && refUrl.pathname !== "/") {
        // `return_to` matches the param name `sign-in.astro` reads
        // (apps/web/src/pages/auth/sign-in.astro). A mismatched name
        // silently drops the return path on every anon → auth bounce.
        // Skipping pathname `/` lets the sign-in page's `?? "/app"`
        // default kick in — the hero is the anon-cap source, and
        // `nlqdb_pending` only rehydrates on `/app` (SK-ANON-012).
        url.searchParams.set("return_to", refUrl.pathname + refUrl.search);
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
function errorStatus(status: AskError["status"]): 400 | 404 | 409 | 422 | 429 | 502 {
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
    case "clarify_required":
    case "schema_mismatch":
      return 409;
  }
}

// Wraps `errorStatus` with the `forbidden` branch unique to `/v1/run` (`SK-APIKEYS-003`).
function runErrorStatus(error: RunError): 400 | 403 | 404 | 409 | 422 | 429 | 502 {
  if (error.status === "forbidden") return 403;
  return errorStatus(error.status);
}

// `/v1/memory/remember` adds `wrong_preset` (409 — the target DB isn't an
// agent_memory_v1 preset); everything else maps like the ask/run paths.
function rememberErrorStatus(error: RememberError): 400 | 404 | 409 | 422 | 429 | 502 {
  if (error.status === "wrong_preset") return 409;
  return errorStatus(error.status);
}

// Anon-bearer stash endpoint (SK-ANON-012).
//
// Called by `sign-in.astro` before initiating magic-link or OAuth so
// the anon-bearer can ride the sign-in round-trip without travelling
// through a URL query param. The endpoint reads `x-anon-bearer`,
// signs the value with HMAC-SHA-256 (key = BETTER_AUTH_SECRET), and
// sets a `__Secure-anon-bearer` cookie (10-minute Max-Age,
// `Path=/api/auth`). Better Auth's `after` hook (`apps/api/src/auth.ts`)
// reads the cookie on the magic-link verify / OAuth callback and
// triggers `recordAnonAdoption()` per SK-ANON-003.
//
// SameSite=Lax permits the cookie to ride along on the top-level
// redirect from the IdP. HttpOnly prevents the JS from reading it
// back after stashing — the bearer is already in localStorage on
// the same origin; the cookie is committed to the auth round-trip
// and the page no longer needs it.
app.post("/api/auth/anon-stash", async (c) => {
  const bearer = c.req.header("x-anon-bearer");
  if (!bearer?.startsWith("anon_") || bearer.length <= "anon_".length) {
    return c.text("invalid_bearer", 400);
  }
  const secret = c.env.BETTER_AUTH_SECRET;
  if (!secret) {
    // Dev / test environments without a configured secret skip the
    // stash silently — adoption is best-effort and the test harness
    // doesn't exercise the post-signin replay.
    return c.body(null, 204);
  }
  const isProd = c.env.NODE_ENV === "production" || c.env.NODE_ENV === "canary";
  const signed = await signAnonStash(bearer, secret);
  c.header("Set-Cookie", buildSetCookie(signed, isProd));
  return c.body(null, 204);
});

// Eager adoption for already-signed-in visitors (SK-ANON-012).
//
// When a user lands on `/auth/sign-in` already authenticated (a stale
// nav, a same-origin hero-redirect after the SK-ANON-012 401, or just
// hitting the page directly), the regular Better Auth `after` hook
// never fires — there's no new sign-in to hook on. This endpoint is
// the equivalent of that hook, invoked client-side from sign-in.astro
// (and the mock-IdP form) once `fetchSession` returns non-null. It
// runs the same `recordAnonAdoption(env.DB, session.user.id, bearer)`
// row update so the anon DBs from the hero attach to the live
// session before the redirect to `/app`. Best-effort and idempotent
// — adoption failures don't block the redirect.
app.post("/api/auth/anon-adopt-now", requireSession, async (c) => {
  const session = c.var.session;
  const bearer = c.req.header("x-anon-bearer");
  if (!bearer?.startsWith("anon_") || bearer.length <= "anon_".length) {
    return c.json({ error: { status: "invalid_bearer" } }, 400);
  }
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.anon.adopt", async (span) => {
    span.setAttribute("nlqdb.user.id", session.user.id);
    span.setAttribute("nlqdb.anon.adopt.source", "adopt_now");
    try {
      const result = await recordAnonAdoption(c.env.DB, session.user.id, bearer);
      if (result.ok) {
        span.setAttribute("nlqdb.anon.adopt.outcome", result.adopted ? "adopted" : "replay");
        // SK-ANON-014 — surface the adopted dbId so `/auth/post-signin`
        // can pin it via `?db=<id>` on the redirect to `/app`.
        return c.json({ adopted: result.adopted, dbId: result.dbId });
      }
      span.setAttribute("nlqdb.anon.adopt.outcome", result.reason);
      const httpStatus =
        result.reason === "invalid_token" ? 400 : result.reason === "token_taken" ? 409 : 500;
      return c.json({ error: { status: result.reason } }, httpStatus);
    } finally {
      span.end();
    }
  });
});

// OAuth init redirect (SK-AUTH-015).
//
// Top-level GET navigation from the sign-in page wraps Better Auth's
// POST `/sign-in/social` and returns a 302 to the IdP. Why a wrapper
// instead of a fetch: when the sign-in page lives on a different
// eTLD+1 from the API (Workers-Versions previews on `*.workers.dev`,
// per SK-AUTH-013), the cross-site `fetch + credentials: "include"`
// to `app.nlqdb.com/api/auth/sign-in/social` is a third-party request
// from the browser's POV. Chrome's third-party-cookie phase-out (and
// Safari ITP) silently drops the `Set-Cookie` for the OAuth state
// cookie, so the post-IdP callback fails `parseGenericState` →
// `state_security_mismatch` → 302 to `${baseURL}/error?error=state_mismatch`.
// Top-level navigation makes `app.nlqdb.com` the first-party origin
// for the response that sets the state cookie, so the cookie lands and
// the callback verifies cleanly.
//
// Trust boundary: the wrapped POST goes through Better Auth's normal
// `socialSignInBodySchema` validation, which checks `callbackURL`
// against `trustedOrigins` (preview wildcard added in SK-AUTH-013).
// We don't need a parallel allow-list here.
app.get("/api/auth/oauth-init/:provider", async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.auth.oauth.init", async (span) => {
    try {
      const provider = c.req.param("provider");
      const callbackURL = c.req.query("callbackURL");
      span.setAttribute("nlqdb.auth.provider", provider ?? "unknown");

      if (provider !== "google" && provider !== "github") {
        span.setAttribute("nlqdb.auth.oauth_init.outcome", "invalid_provider");
        return c.text("invalid_provider", 400);
      }
      if (!callbackURL) {
        span.setAttribute("nlqdb.auth.oauth_init.outcome", "missing_callback_url");
        return c.text("missing_callback_url", 400);
      }

      const innerUrl = new URL("/api/auth/sign-in/social", c.req.url);
      const innerHeaders: Record<string, string> = { "content-type": "application/json" };
      const cookie = c.req.header("cookie");
      if (cookie) innerHeaders["cookie"] = cookie;
      // Synthesize an Origin for the inner POST. Browsers don't send
      // `Origin` on top-level cross-origin GET navigations (the shape
      // SK-AUTH-015 uses), so the inbound GET typically lacks it
      // entirely. Better Auth's `originCheckMiddleware` runs on the
      // inner POST and rejects with `MISSING_OR_NULL_ORIGIN` when
      // both `origin` and `referer` are absent (origin-check.mjs:103).
      // Falling back to Better Auth's configured `baseURL` is safe:
      // this is a server-side wrap (no browser CSRF surface between
      // our edge and our own auth handler), and `baseURL` is
      // implicitly added to `trustedOrigins` (context/helpers.mjs:73).
      // Using `baseURL` rather than `c.req.url` keeps the synthesis
      // trusted even if the request lands on a non-baseURL host
      // (e.g. the workers.dev URL exposed by SK-AUTH-014).
      const baseOrigin =
        typeof auth.options.baseURL === "string"
          ? new URL(auth.options.baseURL).origin
          : new URL(c.req.url).origin;
      innerHeaders["origin"] = c.req.header("origin") ?? baseOrigin;

      const innerReq = new Request(innerUrl.toString(), {
        method: "POST",
        headers: innerHeaders,
        body: JSON.stringify({ provider, callbackURL }),
      });

      const innerRes = await auth.handler(innerReq);

      if (innerRes.status >= 400) {
        // Better Auth rejected (untrusted callbackURL, provider not
        // configured, etc). Forward the response so the caller sees
        // the actual error rather than a silent 500.
        span.setAttribute("nlqdb.auth.oauth_init.outcome", "rejected");
        span.setAttribute("http.response.status_code", innerRes.status);
        authEventsTotal().add(1, { type: "oauth_init", outcome: "failure" });
        return innerRes;
      }

      // Better Auth's signInSocial sets `Location` and returns 200 with
      // `{ url }` — we promote that into a real 302 so the browser
      // follows it as part of this top-level navigation.
      let redirectTo: string | null = innerRes.headers.get("Location");
      if (!redirectTo) {
        try {
          const body = (await innerRes.clone().json()) as { url?: string };
          redirectTo = body.url ?? null;
        } catch {
          redirectTo = null;
        }
      }
      if (!redirectTo) {
        span.setAttribute("nlqdb.auth.oauth_init.outcome", "no_redirect_url");
        authEventsTotal().add(1, { type: "oauth_init", outcome: "failure" });
        return c.text("oauth_init_failed", 500);
      }

      const headers = new Headers();
      // Forward every Set-Cookie (state cookie, code-verifier cookie,
      // etc). `getSetCookie()` is Workers-runtime native; the
      // single-string fallback covers any test runtime that lacks it.
      const setCookies =
        typeof innerRes.headers.getSetCookie === "function" ? innerRes.headers.getSetCookie() : [];
      for (const sc of setCookies) headers.append("set-cookie", sc);
      if (setCookies.length === 0) {
        const sc = innerRes.headers.get("set-cookie");
        if (sc) headers.set("set-cookie", sc);
      }
      headers.set("Location", redirectTo);

      span.setAttribute("nlqdb.auth.oauth_init.outcome", "redirect");
      authEventsTotal().add(1, { type: "oauth_init", outcome: "success" });
      return new Response(null, { status: 302, headers });
    } finally {
      span.end();
    }
  });
});

// SK-AUTH-019 — direct `auth.api.signOut` bypasses the router-mounted
// `originCheckMiddleware` that 403s sign-out when `Origin` is stripped.
app.post("/api/auth/sign-out", async (c) => {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.auth.verify", async (span) => {
    const raw = c.req.raw;
    try {
      const response = await auth.api.signOut({
        headers: raw.headers,
        request: raw,
        asResponse: true,
      });
      const outcome = response.status < 400 ? "success" : "failure";
      span.setAttribute("http.response.status_code", response.status);
      authEventsTotal().add(1, { type: "verify", outcome });
      return response;
    } catch (err) {
      span.setAttribute("http.response.status_code", 500);
      authEventsTotal().add(1, { type: "verify", outcome: "failure" });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
});

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

// Cron expressions, mirrored from `apps/api/wrangler.toml`'s
// `[triggers].crons`. The scheduled() handler dispatches on
// `controller.cron` against these constants; an unmatched value
// emits `scheduled_unknown_cron` and returns rather than falling
// through to one of the branches — a string drift between this file
// and wrangler.toml shouldn't accidentally route the keep-warm
// schedule through the heavy daily workload-analyser path (which
// would burn D1 quotas + LLM credits firing 210x/day).
const NEON_KEEP_WARM_CRON = "*/4 13-21 * * 1-5";
const WORKLOAD_ANALYSER_CRON = "0 4 * * *";
const ICP_SCRAPE_CRON = "0 6 * * 1";

// W5 daily workload-analyser cron handler (`SK-MIGRATE-001`). Schedule
// is `0 4 * * *` UTC, configured in `wrangler.toml`'s `[triggers]`.
// When `TINYBIRD_TOKEN` is unset the handler ack-and-skips (matches the
// unconfigured-sink posture — `SK-EVENTS-005`). All Tinybird HTTP flows
// through `@nlqdb/db`'s typed surface per `GLOBAL-021`.
//
// SK-HDC-014 — `controller.cron` dispatches between branches. The
// Neon keep-warm branch (`*/4 13-21 * * 1-5`) fires far more often and
// does a tiny `SELECT 1` to defer compute auto-suspend; the workload
// analyser branch (`0 4 * * *`) does the heavy daily roll-up.
async function scheduled(
  controller: ScheduledController,
  envBindings: Cloudflare.Env,
  ctx: ExecutionContext,
): Promise<void> {
  const { GRAFANA_OTLP_ENDPOINT, GRAFANA_OTLP_AUTHORIZATION } = envBindings;
  const telemetry =
    GRAFANA_OTLP_ENDPOINT && GRAFANA_OTLP_AUTHORIZATION
      ? setupTelemetry({
          serviceName: "nlqdb-api",
          serviceVersion: SERVICE_VERSION,
          otlpEndpoint: GRAFANA_OTLP_ENDPOINT,
          authorization: GRAFANA_OTLP_AUTHORIZATION,
        })
      : undefined;

  try {
    // SK-HDC-014 — Neon keep-warm. Fires every 4 minutes during
    // weekdays 13-21 UTC. Strictly under Neon's 5-min auto-suspend so
    // the compute stays resident; at 0.25 CU minimum × 8h × 22
    // weekdays ≈ 44 CU-h/month, well under the 100 CU-h Free-tier
    // monthly budget (research-receipts: Neon plans page). One subrequest
    // per fire — under the Workers Free-tier 50/invocation cap. Errors
    // are logged but never re-thrown: a Neon outage shouldn't trip the
    // analyser branch's run path or surface as a cron failure.
    if (controller.cron === NEON_KEEP_WARM_CRON) {
      const databaseUrl = (envBindings as unknown as Record<string, string | undefined>)[
        "DATABASE_URL"
      ];
      if (!databaseUrl) {
        console.warn(
          JSON.stringify({
            msg: "neon_keepwarm_skipped",
            reason: "DATABASE_URL unset",
          }),
        );
        return;
      }
      const { keepNeonWarm } = await import("./db-create/build-deps.ts");
      try {
        // Span carries the elapsed_ms via `nlqdb.db.duration_ms` —
        // no console.info needed (would otherwise be ~210 lines/day
        // of pure noise, fails the "non-spammy" bar). Failures still
        // log so operators on `wrangler tail` see the trip.
        await keepNeonWarm(databaseUrl);
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "neon_keepwarm_failed",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    // ICP pain-signal scraper + scorer + evidence-file generator — Monday 06:00 UTC.
    if (controller.cron === ICP_SCRAPE_CRON) {
      const scrapeResult = await runIcpScrape({
        kv: envBindings.KV,
        logsnagToken: envBindings.LOGSNAG_TOKEN,
        logsnagProject: envBindings.LOGSNAG_PROJECT,
        ghToken: envBindings.GH_TOKEN,
        redditClientId: envBindings.REDDIT_CLIENT_ID,
        redditClientSecret: envBindings.REDDIT_CLIENT_SECRET,
      });
      console.info(
        JSON.stringify({
          msg: "icp_scrape_completed",
          newItems: scrapeResult.newItems,
          skipped: scrapeResult.skipped,
          sources: scrapeResult.sources,
        }),
      );
      if (scrapeResult.items.length > 0) {
        const scoreResult = await runIcpScore(scrapeResult.items, {
          kv: envBindings.KV,
          groqApiKey: envBindings.GROQ_API_KEY,
          geminiApiKey: envBindings.GEMINI_API_KEY,
        }).catch((err) => {
          console.error(
            JSON.stringify({
              msg: "icp_score_failed",
              message: err instanceof Error ? err.message : String(err),
            }),
          );
          return null;
        });
        if (scoreResult) {
          console.info(JSON.stringify({ msg: "icp_score_completed", ...scoreResult }));
        }
      }
      if (envBindings.GH_TOKEN) {
        const clusterResult = await runIcpCluster({
          kv: envBindings.KV,
          groqApiKey: envBindings.GROQ_API_KEY,
          geminiApiKey: envBindings.GEMINI_API_KEY,
          ghToken: envBindings.GH_TOKEN,
          logsnagToken: envBindings.LOGSNAG_TOKEN,
          logsnagProject: envBindings.LOGSNAG_PROJECT,
        }).catch((err) => {
          console.error(
            JSON.stringify({
              msg: "icp_cluster_failed",
              message: err instanceof Error ? err.message : String(err),
            }),
          );
          return null;
        });
        if (clusterResult) {
          console.info(JSON.stringify({ msg: "icp_cluster_completed", ...clusterResult }));
        }
      }
      return;
    }

    // Unknown cron — log+return rather than fall through. Drift
    // between this file and `wrangler.toml`'s `[triggers].crons`
    // shouldn't accidentally pipe the wrong schedule into the heavy
    // workload-analyser branch.
    if (controller.cron !== WORKLOAD_ANALYSER_CRON) {
      console.error(
        JSON.stringify({
          msg: "scheduled_unknown_cron",
          cron: controller.cron,
        }),
      );
      return;
    }

    // SK-ANON-002 / SK-ANON-012 — anon-DB sweep. Runs first so even
    // if the workload-analyser later trips, abandoned anon DBs still
    // get evicted on schedule. D1-only — Postgres schema cleanup is
    // operator territory per `docs/runbook.md §9`. Errors are
    // logged (and re-raised by the outer catch) so a sweep miss
    // surfaces in `wrangler tail`.
    try {
      const sweep = await sweepAnonDatabases(envBindings.DB);
      console.info(
        JSON.stringify({
          msg: "anon_db_sweep",
          evicted_by_age: sweep.evictedByAge.length,
          evicted_by_cap: sweep.evictedByCap.length,
          total_anon_after: sweep.totalAnonAfter,
        }),
      );
    } catch (sweepErr) {
      console.error(
        JSON.stringify({
          msg: "anon_db_sweep_failed",
          message: sweepErr instanceof Error ? sweepErr.message : String(sweepErr),
        }),
      );
    }

    if (!envBindings.TINYBIRD_TOKEN) return;
    const tinybird = createTinybirdAdapter({
      token: envBindings.TINYBIRD_TOKEN,
      ...(envBindings.TINYBIRD_API_BASE !== undefined
        ? { apiBase: envBindings.TINYBIRD_API_BASE }
        : {}),
      workspace: "nlqdb",
      // Allowlist scoped to `query_log` only — the analyser does not
      // need any user-data Pipes; cross-prefix references in the read
      // SQL would reject at validator time per `SK-MULTIENG-004`.
      allowlist: { tables: ["query_log"], pipes: [] },
    });
    const pipes = createPipeManagementClient({
      token: envBindings.TINYBIRD_TOKEN,
      ...(envBindings.TINYBIRD_API_BASE !== undefined
        ? { apiBase: envBindings.TINYBIRD_API_BASE }
        : {}),
    });
    await runWorkloadAnalyser({
      d1: envBindings.DB,
      tinybird,
      pipes,
      now: () => Date.now(),
      newId: () => crypto.randomUUID(),
    });
  } catch (err) {
    // Cron-level failures (Tinybird wedged, D1 down) are recorded on the
    // `nlqdb.workload_analyser.run` span. Log so operators on `wrangler
    // tail` see the trip without OTel attached.
    console.error(
      JSON.stringify({
        msg: "workload_analyser_failed",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  } finally {
    if (telemetry) ctx.waitUntil(telemetry.forceFlush());
  }
}

export default {
  fetch: (req: Request, e: Cloudflare.Env, ctx: ExecutionContext) => app.fetch(req, e, ctx),
  scheduled,
};
