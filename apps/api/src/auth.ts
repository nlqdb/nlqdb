// Better Auth singleton (docs/architecture.md §4.1, §4.3, RUNBOOK §5/§5b).
//
// Provider creds switch on `env.NODE_ENV`:
//   production   → OAUTH_GITHUB_*
//   development  → OAUTH_GITHUB_*_DEV
//
// Session caching: cookie cache (5min HMAC) → KV secondaryStorage → D1.
// Revocation set in KV on session.delete.after; middleware short-circuits
// any cookie-cached session whose row is gone (≤2s revocation guarantee).

import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { D1Dialect } from "kysely-d1";
import { hashEmail, makeMagicLinkThrottle } from "./auth/magic-link-throttle.ts";
import { makeEmailSender } from "./email.ts";

const isDev = env.NODE_ENV !== "production";

const githubClientId = isDev ? env.OAUTH_GITHUB_CLIENT_ID_DEV : env.OAUTH_GITHUB_CLIENT_ID;
const githubClientSecret = isDev
  ? env.OAUTH_GITHUB_CLIENT_SECRET_DEV
  : env.OAUTH_GITHUB_CLIENT_SECRET;

const KV_MIN_TTL_SECONDS = 60;
const COOKIE_CACHE_MAX_AGE_SECONDS = 5 * 60;
export const REVOCATION_KEY_PREFIX = "revoked-session:";
const REVOCATION_TTL_SECONDS = COOKIE_CACHE_MAX_AGE_SECONDS + 60;

// Magic-link windows. 10 min is the 2026 industry default (Linear,
// Vercel) — short enough that a leaked link is mostly stale, long
// enough to survive a tab-switch.
const MAGIC_LINK_TTL_SECONDS = 10 * 60;

// Web origin where the prefetch-protected continue page lives.
// Default is production; .dev.vars overrides for `wrangler dev`.
const WEB_ORIGIN_DEFAULT = isDev ? "http://localhost:4321" : "https://nlqdb.com";
const webOrigin = env.MAGIC_LINK_WEB_ORIGIN ?? WEB_ORIGIN_DEFAULT;
const MAGIC_LINK_DEFAULT_REDIRECT = `${webOrigin}/app`;
const magicLinkRedirect = env.MAGIC_LINK_REDIRECT_URL ?? MAGIC_LINK_DEFAULT_REDIRECT;

const RESEND_FROM_DEFAULT = "nlqdb <hello@nlqdb.com>";
const sendEmail = makeEmailSender({
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_FROM ?? RESEND_FROM_DEFAULT,
});

// Per-email send throttle. Better Auth's built-in rate limit is per-IP
// only — one IP can still spray many target inboxes. The throttle
// closes that loophole: 3 sends / 10 min per email address (hashed
// in the KV key for privacy).
const magicLinkThrottle = makeMagicLinkThrottle(env.KV, { max: 3, windowSeconds: 600 });

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
  baseURL: isDev ? "http://localhost:8787" : "https://app.nlqdb.com",
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: {
    dialect: new D1Dialect({ database: env.DB }),
    type: "sqlite",
  },
  secondaryStorage,
  // Per-IP rate limit (Better Auth default 100/min). The
  // /sign-in/magic-link override pairs with the per-email throttle
  // above to defeat both single-IP abuse and IP-spread enumeration.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "secondary-storage",
    customRules: {
      "/sign-in/magic-link": { window: 60, max: 5 },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: COOKIE_CACHE_MAX_AGE_SECONDS,
    },
  },
  databaseHooks: {
    session: {
      delete: {
        after: async (session) => {
          await kv.put(`${REVOCATION_KEY_PREFIX}${session.token}`, "1", {
            expirationTtl: REVOCATION_TTL_SECONDS,
          });
        },
      },
    },
  },
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: { clientId: githubClientId, clientSecret: githubClientSecret },
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },
  trustedOrigins: isDev
    ? ["http://localhost:8787", "http://localhost:4321"]
    : [
        "https://app.nlqdb.com",
        "https://nlqdb.com",
        // Workers-Versions preview surface (SK-AUTH-013). Better Auth
        // validates `callbackURL` and Origin against this list before
        // redirecting after sign-in/social or magic-link verify, so
        // without the preview pattern Google/GitHub callbacks and
        // magic-link continue both fall back to baseURL instead of
        // returning the user to their preview tab. The wildcard is
        // anchored to `omer-hochman.workers.dev` (our account
        // subdomain), which only our own account can publish under.
        "https://*-nlqdb-web.omer-hochman.workers.dev",
      ],
  // Cross-subdomain cookies so the chat UI on `nlqdb.com/app` shares
  // the session set by Better Auth at `app.nlqdb.com/api/auth/*`.
  // `__Host-` prefix is incompatible with cross-subdomain (it requires
  // no Domain attribute); `__Secure-` is the correct prefix here —
  // forces the Secure flag and rejects any cookie set over HTTP.
  ...(isDev
    ? {}
    : {
        advanced: {
          cookiePrefix: "__Secure",
          crossSubDomainCookies: { enabled: true, domain: ".nlqdb.com" },
          defaultCookieAttributes: { sameSite: "lax", secure: true, httpOnly: true },
        },
      }),
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_TTL_SECONDS,
      allowedAttempts: 1,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        // Per-email throttle. When over limit, drop the send silently
        // (Better Auth's verification record is harmless if the email
        // never arrives; the 10-min TTL evicts it). Returning here
        // means the legitimate user retries through the per-IP path.
        //
        // UX gap (intentional, documented for triage):
        //   Better Auth doesn't let `sendMagicLink` thread a result
        //   back to the caller, so the API still responds 200 to
        //   `/sign-in/magic-link`. A user blocked here sees "check
        //   your inbox" and an empty inbox until they re-submit
        //   enough times to also trip the per-IP limit (5/min, 429).
        //   The warning log below carries the hashed email so support
        //   can correlate inbound complaints to per-email throttle
        //   hits without ever logging the plaintext address.
        const emailHash = await hashEmail(email);
        const allowed = await magicLinkThrottle.tryConsume(emailHash);
        if (!allowed) {
          console.warn("magic-link throttle: per-email block", {
            emailHash,
            max: 3,
            windowSeconds: 600,
          });
          return;
        }

        // Prefetch protection. Outlook SafeLinks / Gmail / Defender all
        // GET URLs from emails before the user clicks; Better Auth's
        // verify endpoint consumes the token on GET, so a scanner
        // burns it. We rewrite the email URL to point at our static
        // /auth/continue page that requires a user click to navigate
        // to the actual verify endpoint.
        const continueUrl = buildContinueUrl(url, magicLinkRedirect);
        try {
          await sendEmail({
            to: email,
            subject: "Sign in to nlqdb",
            text: [
              "Click the link below to sign in to nlqdb. The link",
              "expires in 10 minutes and can only be used once.",
              "",
              continueUrl,
              "",
              "If you didn't request this, you can ignore this email.",
            ].join("\n"),
            html: renderMagicLinkHtml(continueUrl),
          });
        } catch (err) {
          // Resend outage / network / config error. Roll back the
          // counter so a single transient failure doesn't burn one of
          // the user's three sends in this window — otherwise a brief
          // Resend hiccup looks identical to abuse from the user's
          // side. Re-throw so Better Auth surfaces a 5xx and the UI
          // can show "couldn't send, try again" instead of a phantom
          // success.
          await magicLinkThrottle.rollback(emailHash);
          throw err;
        }
      },
    }),
  ],
});

// Wraps Better Auth's `/api/auth/magic-link/verify?token=…&callbackURL=…`
// URL inside our `/auth/continue?next=<encoded>` page. The continue
// page renders a button the user clicks to navigate to `next`; passive
// link-scanners don't trigger that click, so the token survives.
function buildContinueUrl(verifyUrl: string, fallbackCallback: string): string {
  let next = verifyUrl;
  try {
    const parsed = new URL(verifyUrl);
    if (!parsed.searchParams.has("callbackURL")) {
      parsed.searchParams.set("callbackURL", fallbackCallback);
    }
    next = parsed.toString();
  } catch {
    // verifyUrl wasn't a valid URL — pass through unmodified.
  }
  return `${webOrigin}/auth/continue?next=${encodeURIComponent(next)}`;
}

function renderMagicLinkHtml(link: string): string {
  const safe = escapeHtml(link);
  return [
    '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">',
    '<h1 style="font-size:18px;margin:0 0 16px;">Sign in to nlqdb</h1>',
    '<p style="margin:0 0 20px;">Click the button below to sign in. The link expires in 10 minutes and can only be used once.</p>',
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
