// Better Auth singleton. Wired at module load via `cloudflare:workers`'s
// top-level `env` (DESIGN §4.1, IMPLEMENTATION §3, RUNBOOK §5/§5b).
//
// Constructing `betterAuth({...})` is pure config — no I/O — so it's
// safe at top level despite the Workers "no I/O outside request context"
// rule. The D1 dialect just stores the `env.DB` reference; queries fire
// only inside `auth.handler(req)` during a request.
//
// Provider creds switch on `env.NODE_ENV`:
// - production: `OAUTH_GITHUB_*`
// - development (wrangler dev): `OAUTH_GITHUB_*_DEV`
// Google has a single OAuth client (one consent screen) — no _DEV split.
//
// Session caching (PERFORMANCE §4 row 6, DESIGN §4.3, §4.5):
// - `session.cookieCache` (5 min) — HMAC-verified cookie payload, no
//   D1 read on the fast path.
// - `secondaryStorage` backed by KV — Better Auth caches/looks up
//   sessions there before falling through to D1.
// - `databaseHooks.session.delete.after` writes `revoked-session:<token>`
//   to KV with TTL = cookieCache maxAge + buffer. The `requireSession`
//   middleware (src/middleware.ts) checks this set on every protected
//   request, giving the ≤2s revocation guarantee even with a 5-min
//   cookie cache.

import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { D1Dialect } from "kysely-d1";

const isDev = env.NODE_ENV !== "production";

const githubClientId = isDev ? env.OAUTH_GITHUB_CLIENT_ID_DEV : env.OAUTH_GITHUB_CLIENT_ID;
const githubClientSecret = isDev
  ? env.OAUTH_GITHUB_CLIENT_SECRET_DEV
  : env.OAUTH_GITHUB_CLIENT_SECRET;

// Cloudflare KV minimum TTL is 60s; floor any shorter request so KV
// doesn't silently reject the put. Better Auth currently passes
// per-key TTLs ≥ cookieCache maxAge in practice; the floor is
// defensive against future internal changes.
const KV_MIN_TTL_SECONDS = 60;
const COOKIE_CACHE_MAX_AGE_SECONDS = 5 * 60;
export const REVOCATION_KEY_PREFIX = "revoked-session:";
const REVOCATION_TTL_SECONDS = COOKIE_CACHE_MAX_AGE_SECONDS + 60;

const kv = env.KV;
const secondaryStorage = {
  get: async (key: string) => kv.get(key),
  set: async (key: string, value: string, ttl?: number) => {
    const expirationTtl = ttl && ttl >= KV_MIN_TTL_SECONDS ? ttl : KV_MIN_TTL_SECONDS;
    await kv.put(key, value, { expirationTtl });
  },
  delete: async (key: string) => kv.delete(key),
};

export const auth = betterAuth({
  // baseURL is documentation + defense against future proxy / preview
  // edge cases. Cloudflare Workers preserves Host so request introspection
  // works today — explicit beats inferred.
  baseURL: isDev ? "http://localhost:8787" : "https://app.nlqdb.com",
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: {
    dialect: new D1Dialect({ database: env.DB }),
    type: "sqlite",
  },
  secondaryStorage,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: COOKIE_CACHE_MAX_AGE_SECONDS,
    },
  },
  databaseHooks: {
    session: {
      // After Better Auth deletes a session row from D1 (sign-out, admin
      // revoke, expiry sweep), record the revocation in KV so the
      // `requireSession` middleware can short-circuit any cookie-cached
      // session whose row no longer exists. TTL outlives the cookie
      // cache so a stale cookie can't outrun the revocation.
      delete: {
        after: async (session) => {
          await kv.put(`${REVOCATION_KEY_PREFIX}${session.token}`, "1", {
            expirationTtl: REVOCATION_TTL_SECONDS,
          });
        },
      },
    },
  },
  // DESIGN §4.1: "No passwords, ever." Better Auth's email-password
  // is opt-in (not on by default), but we lock it explicitly so a
  // future contributor can't enable it without removing this line
  // and confronting the design choice.
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: {
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  trustedOrigins: isDev
    ? ["http://localhost:8787", "http://localhost:4321"]
    : ["https://app.nlqdb.com", "https://nlqdb.com"],
});
