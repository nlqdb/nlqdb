// Principal resolution for `/v1/*` routes. A request is one of:
//   - cookie session  → Principal { kind: "user", id: <userId> }
//   - Authorization: Bearer anon_<token> → Principal { kind: "anon", id: "anon:<hash>" }
//   - Authorization: Bearer pk_live_<key> → Principal { kind: "pk_live", id: <tenantId>, dbId: <dbId> }
//   - Authorization: Bearer sk_live_<key> → Principal { kind: "sk_live", id: <tenantId>, keyId }
//   - Authorization: Bearer sk_mcp_<host>_<device>_<key> → Principal { kind: "sk_mcp", id: <tenantId>, keyId, mcpHost, deviceId }
//   - none of the above → 401 unauthorized
//
// The `id` is the value passed to the orchestrators as `userId`/
// `tenantId`. For anon, the `anon:` prefix is the convention
// db-create's `isAnonymous()` (apps/api/src/db-create/orchestrate.ts)
// recognises. For sk_live / sk_mcp, the tenant_id resolved from the
// key row IS the user_id — sk_* keys are account-scoped per
// SK-APIKEYS-001 / SK-APIKEYS-004 and identical to a session
// principal as far as the orchestrator is concerned.
//
// `pk_live_` principals are read-only (SK-APIKEYS-003): the route handler
// rejects any kind≠query when principal.kind === "pk_live". The `dbId`
// field pins the request to a specific database so the caller doesn't
// need to pass `dbId` in the request body.
//
// Per SK-ANON-006, the orchestrator does NOT branch on
// `kind` — it consumes the resolved id. The only places kind
// matters are: rate-limit selection (anon vs authed bucket),
// quotas (anon caps), and read-only enforcement (pk_live_).
//
// Cookie session is tried first; an authenticated cookie always wins
// over any Authorization header. Bearer-key resolution short-circuits
// after the first match (anon → pk_live → sk_*), since the prefixes
// are disjoint by construction.

import type { NlqSurface } from "@nlqdb/events";
import type { Context, MiddlewareHandler } from "hono";
import type { SkKeyLookup } from "./api-keys.ts";
import type { Session } from "./middleware.ts";

export type Principal =
  | { kind: "user"; id: string; session: Session }
  | { kind: "anon"; id: string; token: string }
  | { kind: "pk_live"; id: string; dbId: string }
  | { kind: "sk_live"; id: string; keyId: string }
  | { kind: "sk_mcp"; id: string; keyId: string; mcpHost: string; deviceId: string };

// SK-MCP-009: sk_* principals get one bucket per `api_keys.id` so a
// noisy MCP host can't burn its siblings' budgets; user / anon / pk_live
// stay at `principal.id` (preserves chat ↔ ask lockstep + pk_live's
// tenant-wide budget). The `rl:` prefix is the decision's literal
// namespace and guarantees sk_* buckets never collide with bare ids.
export function rateLimitBucketKey(principal: Principal): string {
  switch (principal.kind) {
    case "user":
    case "anon":
    case "pk_live":
      return principal.id;
    case "sk_live":
    case "sk_mcp":
      return `rl:${principal.keyId}`;
  }
}

// SK-EVENTS-010 / performance.md §3.3: derives the `nlqdb.surface`
// value from the principal kind. One place; every emit site + OTel
// span attribute reads from here so a future principal kind lands
// the matching surface in one edit.
//
// sk_live_ maps to "cli" as the most common caller (NLQDB_API_KEY in
// shells / CI / `nlq` raw HTTP path); raw-HTTP-API callers using
// sk_live_ outside of that path will mislabel here. If that volume
// ever becomes a meaningful signal we add a distinct "api" surface
// to `@nlqdb/events` and re-route — for now "cli" is the right default.
export function surfaceFromPrincipal(principal: Principal): NlqSurface {
  switch (principal.kind) {
    case "anon":
      return "hero";
    case "user":
      return "chat";
    case "pk_live":
      return "embed";
    case "sk_live":
      return "cli";
    case "sk_mcp":
      return "mcp";
  }
}

// Returns the account `tenant_id` (== `user_id`) for principals that
// have an account; null for anon and pk_live. Routes that need an
// account (`GET /v1/databases`, `POST /v1/keys`, the dashboard) reject
// null with `account_required`; the orchestrator paths that take any
// principal kind don't call this. One helper means three surfaces
// (session-only routes today, sk_* tomorrow) stay in sync.
export function accountTenantIdFromPrincipal(principal: Principal): string | null {
  switch (principal.kind) {
    case "user":
      return principal.id;
    case "sk_live":
    case "sk_mcp":
      return principal.id;
    case "anon":
    case "pk_live":
      return null;
  }
}

export type RequirePrincipalVariables = {
  principal: Principal;
};

export type RequirePrincipalOpts = {
  // Reuse the same getSession/isRevoked callbacks the cookie-only
  // `requireSession` middleware uses. Tests inject stubs the same
  // way (SK-MW-* via `makeRequireSession`).
  getSession: (req: Request) => Promise<Session | null>;
  isRevoked: (token: string) => Promise<boolean>;
  // Optional: only present when the D1 binding is available.
  // When absent, pk_live_ bearer tokens are rejected as unauthorized.
  lookupPkLiveKey?: (key: string) => Promise<{ dbId: string; tenantId: string } | null>;
  // Optional: same shape as lookupPkLiveKey for sk_live_ / sk_mcp_
  // keys. Absent → those bearer tokens reject as unauthorized (the
  // dev environment without a configured DB binding stays callable
  // with cookie sessions or anon tokens).
  lookupSkKey?: (key: string) => Promise<SkKeyLookup | null>;
  // Optional: fire-and-forget hook to bump `last_used_at` after a
  // successful sk_* lookup. Called via the runtime's `waitUntil` so a
  // D1 write failure can't impact the request path.
  bumpKeyLastUsed?: (keyId: string) => Promise<void>;
};

const ANON_BEARER_PREFIX = "anon_";
const PK_LIVE_PREFIX = "pk_live_";
const SK_LIVE_PREFIX = "sk_live_";
const SK_MCP_PREFIX = "sk_mcp_";

export function makeRequirePrincipal(
  opts: RequirePrincipalOpts,
): MiddlewareHandler<{ Variables: RequirePrincipalVariables }> {
  return async (c, next) => {
    // Cookie session takes precedence — a signed-in user that also
    // has an anonymous token in localStorage is a user. The /v1/anon/
    // adopt endpoint is the seam that bridges the two (SK-ANON-003).
    const session = await opts.getSession(c.req.raw);
    if (session) {
      if (await opts.isRevoked(session.session.token)) {
        return c.json({ error: "session_revoked" }, 401);
      }
      const principal: Principal = { kind: "user", id: session.user.id, session };
      c.set("principal", principal);
      return next();
    }

    const auth = c.req.header("authorization");
    const anonToken = parseAnonBearer(auth);
    if (anonToken) {
      const id = `anon:${await sha256Hex(anonToken, 16)}`;
      const principal: Principal = { kind: "anon", id, token: anonToken };
      c.set("principal", principal);
      return next();
    }

    const pkLiveToken = parsePkLiveBearer(auth);
    if (pkLiveToken && opts.lookupPkLiveKey) {
      const found = await opts.lookupPkLiveKey(pkLiveToken);
      if (found) {
        const principal: Principal = { kind: "pk_live", id: found.tenantId, dbId: found.dbId };
        c.set("principal", principal);
        return next();
      }
    }

    const skToken = parseSkBearer(auth);
    if (skToken && opts.lookupSkKey) {
      const found = await opts.lookupSkKey(skToken);
      if (found) {
        const principal: Principal =
          found.kind === "sk_live"
            ? { kind: "sk_live", id: found.tenantId, keyId: found.keyId }
            : {
                kind: "sk_mcp",
                id: found.tenantId,
                keyId: found.keyId,
                mcpHost: found.mcpHost,
                deviceId: found.deviceId,
              };
        c.set("principal", principal);
        // Fire-and-forget bump; `executionCtx` is absent in Hono unit-
        // test flows that call `app.request()` without an env/ctx pair.
        if (opts.bumpKeyLastUsed) {
          const ctx = tryGetExecutionCtx(c);
          if (ctx) ctx.waitUntil(opts.bumpKeyLastUsed(found.keyId));
        }
        return next();
      }
    }

    return c.json({ error: "unauthorized" }, 401);
  };
}

export function getPrincipal(c: Context<{ Variables: RequirePrincipalVariables }>): Principal {
  const principal = c.get("principal");
  if (!principal) {
    throw new Error("getPrincipal() called without requirePrincipal() middleware on the route");
  }
  return principal;
}

// Returns the raw token *including* its prefix — that's the on-the-wire
// shape the SDK keychain, MCP config files, and `Authorization` headers
// all carry. A prefix with no body after it is rejected so we never auth
// the literal `anon_` / `pk_live_` / `sk_live_` / `sk_mcp_`.
export function parseAnonBearer(header: string | null | undefined): string | null {
  return parseBearerWithPrefix(header, ANON_BEARER_PREFIX);
}

export function parsePkLiveBearer(header: string | null | undefined): string | null {
  return parseBearerWithPrefix(header, PK_LIVE_PREFIX);
}

// Both `sk_live_` and `sk_mcp_` tokens fall out here; `lookupSkKey`
// dispatches on the stored `key_type`, so the caller never branches
// on which sk-prefix matched.
export function parseSkBearer(header: string | null | undefined): string | null {
  return (
    parseBearerWithPrefix(header, SK_LIVE_PREFIX) ?? parseBearerWithPrefix(header, SK_MCP_PREFIX)
  );
}

function parseBearerWithPrefix(header: string | null | undefined, prefix: string): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const raw = match?.[1];
  if (!raw) return null;
  const token = raw.trim();
  if (!token.startsWith(prefix)) return null;
  if (token.length <= prefix.length) return null;
  return token;
}

// Hex-encoded SHA-256 prefix. Used for tenant_id derivation and
// rate-limit / create-cap bucket keys (so the raw token never lands
// in a span attribute or D1 column).
export async function sha256Hex(input: string, hexChars = 64): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, hexChars);
}

// Hono throws on `c.executionCtx` when the app is invoked without an
// env+ctx pair (i.e. `app.request()` in unit tests). Tolerating that
// path keeps the middleware testable without injecting a fake ctx.
function tryGetExecutionCtx(c: Context): ExecutionContext | null {
  try {
    return c.executionCtx;
  } catch {
    return null;
  }
}
