// Principal resolution for `/v1/*` routes. A request is one of:
//   - cookie session  → Principal { kind: "user", id: <userId> }
//   - Authorization: Bearer anon_<token> → Principal { kind: "anon", id: "anon:<hash>" }
//   - Authorization: Bearer pk_live_<key> → Principal { kind: "pk_live", id: <tenantId>, dbId: <dbId> }
//   - neither → 401 unauthorized
//
// The `id` is the value passed to the orchestrators as `userId`/
// `tenantId`. For anon, the `anon:` prefix is the convention
// db-create's `isAnonymous()` (apps/api/src/db-create/orchestrate.ts)
// recognises.
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

import type { Context, MiddlewareHandler } from "hono";
import type { Session } from "./middleware.ts";

export type Principal =
  | { kind: "user"; id: string; session: Session }
  | { kind: "anon"; id: string; token: string }
  | { kind: "pk_live"; id: string; dbId: string };

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
};

const ANON_BEARER_PREFIX = "anon_";
const PK_LIVE_PREFIX = "pk_live_";

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

    const anonToken = parseAnonBearer(c.req.header("authorization"));
    if (anonToken) {
      const id = `anon:${await sha256Hex(anonToken, 16)}`;
      const principal: Principal = { kind: "anon", id, token: anonToken };
      c.set("principal", principal);
      return next();
    }

    const pkLiveToken = parsePkLiveBearer(c.req.header("authorization"));
    if (pkLiveToken && opts.lookupPkLiveKey) {
      const found = await opts.lookupPkLiveKey(pkLiveToken);
      if (found) {
        const principal: Principal = { kind: "pk_live", id: found.tenantId, dbId: found.dbId };
        c.set("principal", principal);
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

// `Authorization: Bearer anon_<...>` parser. Returns the raw token
// (including the `anon_` prefix, since that's the on-the-wire shape
// other surfaces emit too — CLI keychain, MCP install) or null on
// any malformed input. Empty `anon_` (no body) is treated as
// malformed — we want a real entropy source behind the prefix.
export function parseAnonBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const raw = match?.[1];
  if (!raw) return null;
  const token = raw.trim();
  if (!token.startsWith(ANON_BEARER_PREFIX)) return null;
  if (token.length <= ANON_BEARER_PREFIX.length) return null;
  return token;
}

// `Authorization: Bearer pk_live_<...>` parser. Same structure as
// parseAnonBearer — returns the raw token or null on any malformed input.
export function parsePkLiveBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const raw = match?.[1];
  if (!raw) return null;
  const token = raw.trim();
  if (!token.startsWith(PK_LIVE_PREFIX)) return null;
  if (token.length <= PK_LIVE_PREFIX.length) return null;
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
