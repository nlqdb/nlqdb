// Principal resolution for `/v1/*` routes. A request is one of:
//   - cookie session  → Principal { kind: "user", id: <userId> }
//   - Authorization: Bearer anon_<token> → Principal { kind: "anon", id: "anon:<hash>" }
//   - neither → 401 unauthorized
//
// The `id` is the value passed to the orchestrators as `userId`/
// `tenantId`. For anon, the `anon:` prefix is the convention
// db-create's `isAnonymous()` (apps/api/src/db-create/orchestrate.ts)
// recognises — pkLive is set to null in that branch (SK-ANON-001 +
// SK-WEB-007 trade off "anon embeds work today" against "rotate on
// sign-in"; today is null).
//
// Why a hash instead of the raw token: the bearer token is the
// device's secret. Putting it in the `databases.tenant_id` column,
// in the RLS policy, and in OTel spans would leak it everywhere; a
// 16-hex-char SHA-256 prefix is non-reversible and short enough to
// be safe in those contexts. (16 hex = 64 bits — collision-free at
// 4 billion devices per birthday-bound math; for our scale this is
// orders of magnitude over what we need.)
//
// Per SK-ANON-006, the orchestrator does NOT branch on
// `kind` — it consumes the resolved id. The only places kind
// matters are: rate-limit selection (anon vs authed bucket) and
// quotas (anon caps).

import type { Context, MiddlewareHandler } from "hono";
import type { Session } from "./middleware.ts";

export type Principal =
  | { kind: "user"; id: string; session: Session }
  | { kind: "anon"; id: string; token: string };

export type RequirePrincipalVariables = {
  principal: Principal;
};

export type RequirePrincipalOpts = {
  // Reuse the same getSession/isRevoked callbacks the cookie-only
  // `requireSession` middleware uses. Tests inject stubs the same
  // way (SK-MW-* via `makeRequireSession`).
  getSession: (req: Request) => Promise<Session | null>;
  isRevoked: (token: string) => Promise<boolean>;
};

const ANON_BEARER_PREFIX = "anon_";

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
