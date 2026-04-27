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
import { magicLink } from "better-auth/plugins";
import { D1Dialect } from "kysely-d1";
import { makeEmailSender } from "./email.ts";

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

// Magic-link defaults (DESIGN §4.1, §4.3).
//
// 15-min single-use windows match the acceptance criteria for Slice 10
// — short enough that an intercepted link is mostly useless by the
// time it surfaces, long enough to survive an email-client preview-
// fetch + a tab-switch.
//
// `MAGIC_LINK_REDIRECT_URL` falls back to the production chat surface;
// `wrangler dev` overrides via .dev.vars to point at the local web
// dev server. Better Auth appends `?token=…&callbackURL=…` itself —
// this var is just the post-verify landing page.
const MAGIC_LINK_TTL_SECONDS = 15 * 60;
const MAGIC_LINK_DEFAULT_REDIRECT = isDev ? "http://localhost:4321/app" : "https://nlqdb.com/app";
const magicLinkRedirect = env.MAGIC_LINK_REDIRECT_URL ?? MAGIC_LINK_DEFAULT_REDIRECT;

const RESEND_FROM_DEFAULT = "nlqdb <hello@nlqdb.com>";
const sendEmail = makeEmailSender({
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_FROM ?? RESEND_FROM_DEFAULT,
});

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
  // Cross-subdomain cookies so the chat UI on `nlqdb.com/app` shares
  // the session set by Better Auth at `app.nlqdb.com/api/auth/*`.
  // The Worker owns `app.nlqdb.com` (see wrangler.toml routes); the
  // chat surface is hosted by `apps/web` at `nlqdb.com/app` until we
  // bundle static assets into the Worker. Same-eTLD+1 cookie scope
  // (`.nlqdb.com`) is the bridge in the meantime.
  //
  // Disabled in dev — `wrangler dev` runs at localhost:8787, the web
  // dev server at localhost:4321; no shared parent domain to scope to.
  ...(isDev
    ? {}
    : {
        advanced: {
          crossSubDomainCookies: {
            enabled: true,
            domain: ".nlqdb.com",
          },
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: true,
            httpOnly: true,
          },
        },
      }),
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_TTL_SECONDS,
      // 1 = single-use. Re-sending generates a fresh token row;
      // the old one is invalidated on next attempt.
      allowedAttempts: 1,
      // Tokens stored hashed in the `verification` table — a leak of
      // the D1 row can't be redeemed, only the email recipient can.
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        // Better Auth assembles `url` as
        //   <baseURL>/api/auth/magic-link/verify?token=…&callbackURL=…
        // We override the default callbackURL (which falls back to
        // the request origin) by passing `?callbackURL=` from the
        // sign-in form. If the form omits it, fall through to the
        // env default so the user still lands somewhere usable.
        const link = ensureCallback(url, magicLinkRedirect);
        await sendEmail({
          to: email,
          subject: "Sign in to nlqdb",
          text: [
            "Click the link below to sign in to nlqdb. The link",
            "expires in 15 minutes and can only be used once.",
            "",
            link,
            "",
            "If you didn't request this, you can ignore this email.",
          ].join("\n"),
          html: renderMagicLinkHtml(link),
        });
      },
    }),
  ],
});

// Best-effort: append `?callbackURL=<fallback>` if Better Auth didn't
// already include one. Safe because adding a duplicate query param
// would still parse — but Better Auth threads the request-supplied
// callbackURL through, so duplication is unlikely in practice.
function ensureCallback(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("callbackURL")) {
      parsed.searchParams.set("callbackURL", fallback);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

// Minimal HTML body — Resend renders it inline. Keep it dependency-
// free; templating libs aren't worth the bundle weight for one email.
function renderMagicLinkHtml(link: string): string {
  const safe = escapeHtml(link);
  return [
    '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">',
    '<h1 style="font-size:18px;margin:0 0 16px;">Sign in to nlqdb</h1>',
    '<p style="margin:0 0 20px;">Click the button below to sign in. The link expires in 15 minutes and can only be used once.</p>',
    `<p style="margin:0 0 24px;"><a href="${safe}" style="display:inline-block;padding:12px 18px;background:#c6f432;color:#0b0f0a;text-decoration:none;font-weight:600;border:2px solid #0b0f0a;">Sign in</a></p>`,
    `<p style="margin:0 0 12px;color:#555;font-size:13px;">Or paste this link into your browser:</p>`,
    `<p style="margin:0;color:#555;font-size:13px;word-break:break-all;">${safe}</p>`,
    '<p style="margin:24px 0 0;color:#888;font-size:12px;">If you didn\'t request this, you can ignore this email.</p>',
    "</div>",
  ].join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
