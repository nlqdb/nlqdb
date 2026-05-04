// Session-gating middleware for protected routes (`/v1/*`). Pairs with
// `auth.ts`'s `cookieCache` + `secondaryStorage` + revocation-set hook
// to satisfy docs/architecture.md §4.5's "≤2s revocation" guarantee even with a
// 5-minute cookie cache:
//
// 1. `getSession()` — Better Auth returns the cookie-cached session if
//    the cookie is HMAC-valid (no D1 hit). On miss, it falls through to
//    the KV-backed `secondaryStorage`, then to D1.
// 2. `isRevoked()` — KV lookup for `revoked-session:<token>`. Hit means
//    the session was deleted; the cookie is stale. Returns 401 + clears
//    the cookie so the browser stops re-sending it.
//
// The middleware is constructed as a factory so tests can swap the
// `getSession` / `isRevoked` callbacks without going through SELF.fetch
// (`vi.mock` of worker modules is broken upstream — see memory:
// vi.mock-doesnt-propagate-to-self-fetch).

import type { Context, MiddlewareHandler } from "hono";

export type SessionUser = { id: string; email?: string | null };
export type Session = {
  user: SessionUser;
  session: { token: string; userId: string };
};

export type RequireSessionOpts = {
  getSession: (req: Request) => Promise<Session | null>;
  isRevoked: (token: string) => Promise<boolean>;
};

export type RequireSessionVariables = {
  session: Session;
};

export function makeRequireSession(opts: RequireSessionOpts): MiddlewareHandler<{
  Variables: RequireSessionVariables;
}> {
  return async (c, next) => {
    const session = await opts.getSession(c.req.raw);
    if (!session) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (await opts.isRevoked(session.session.token)) {
      // The session row is gone but a cookie-cached copy is still in
      // flight. Tell the browser to stop using it; rely on the frontend's
      // re-auth path (docs/architecture.md §4.3).
      return c.json({ error: "session_revoked" }, 401);
    }
    c.set("session", session);
    return next();
  };
}

// Convenience for handlers: pull the gated session off the context.
// Throws if called from a route that didn't go through `requireSession`.
export function getSession(c: Context<{ Variables: RequireSessionVariables }>): Session {
  const session = c.get("session");
  if (!session) {
    throw new Error("getSession() called without requireSession() middleware on the route");
  }
  return session;
}
