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
// Tests mock `cloudflare:workers` via `vi.mock` so this module loads
// against a stub env (apps/api/test/auth.test.ts).

import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { D1Dialect } from "kysely-d1";

const isDev = env.NODE_ENV !== "production";

const githubClientId = isDev ? env.OAUTH_GITHUB_CLIENT_ID_DEV : env.OAUTH_GITHUB_CLIENT_ID;
const githubClientSecret = isDev
  ? env.OAUTH_GITHUB_CLIENT_SECRET_DEV
  : env.OAUTH_GITHUB_CLIENT_SECRET;

export const auth = betterAuth({
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: {
    dialect: new D1Dialect({ database: env.DB }),
    type: "sqlite",
  },
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
