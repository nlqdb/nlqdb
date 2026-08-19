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
import { fail } from "./error-envelope.ts";

export type SessionUser = { id: string; name?: string | null; email?: string | null };
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

// Structured, non-paging warn for a transient auth-store blip — logged (not
// thrown) so a KV/D1 hiccup stays observable without tripping the
// unhandled-error alert. Never logs secrets: error name/message + path/method.
export function logAuthWarn(msg: string, err: unknown, c: Context): void {
  const e = err as Error;
  console.warn(
    JSON.stringify({
      msg,
      name: e?.name,
      message: e?.message,
      path: c.req.path,
      method: c.req.method,
    }),
  );
}

export function makeRequireSession(opts: RequireSessionOpts): MiddlewareHandler<{
  Variables: RequireSessionVariables;
}> {
  return async (c, next) => {
    let session: Session | null = null;
    try {
      session = await opts.getSession(c.req.raw);
    } catch (err) {
      // `getSession` is the authentication oracle. Better Auth wraps any KV
      // `secondaryStorage` / D1 failure as `APIError: Failed to get session` —
      // a transient storage blip, NOT an unauthenticated caller — so a raw 500
      // (which also pages on-call) is wrong: the SDK's 5xx retry replays a
      // retryable `auth_unavailable` (503) and the caller self-heals.
      logAuthWarn("session_resolve_failed", err, c);
      return fail(c, "auth_unavailable");
    }
    if (!session) {
      return fail(c, "unauthorized");
    }
    // The revocation check fails *open* on a KV outage per SK-AUTH-020: the
    // cookie signature already proves identity, so a KV blip on the revocation
    // set must not log out a validly-signed session (that would break
    // GLOBAL-009 silent refresh for an outage unrelated to the session).
    // Revocation resumes the moment KV is reachable again.
    try {
      if (await opts.isRevoked(session.session.token)) {
        // The session row is gone but a cookie-cached copy is still in
        // flight. Tell the browser to stop using it; rely on the frontend's
        // re-auth path (docs/architecture.md §4.3).
        return c.json({ error: "session_revoked" }, 401);
      }
    } catch (err) {
      logAuthWarn("session_revocation_check_failed", err, c);
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
