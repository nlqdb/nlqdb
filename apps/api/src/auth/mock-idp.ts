// Mock IdP for preview environments (SK-AUTH-018).
//
// Gated entirely behind `env.MOCK_IDP === "1"`. The handler chains
// through Better Auth's real magic-link plugin so the resulting
// session is indistinguishable from one minted by Resend → user-click
// → /api/auth/magic-link/verify:
//
//   1. POST /api/auth/sign-in/magic-link — Better Auth stores the
//      verification token + invokes our `sendMagicLink` callback,
//      which (when MOCK_IDP=1) sinks the URL to KV instead of calling
//      Resend.
//   2. Read the latest sinked URL for that email out of KV.
//   3. GET that verify URL through `auth.handler`. Better Auth runs
//      the same path it would for a real click: createUser-if-new,
//      createSession, setSessionCookie, 302 to callbackURL.
//   4. Forward the 302 + Set-Cookie back to the caller.
//
// Cookie shape, KV revocation registration, requireSession middleware,
// and /v1/* gating all run real — only the external IdP / Resend
// roundtrip is bypassed.

import { auth } from "../auth.ts";
import { findLatestForEmail } from "./mock-email-sink.ts";

const DEFAULT_MOCK_EMAIL = "test@example.com";
// SK-ANON-014 — route mock sign-ins through `/auth/post-signin` so the
// after-hook-adopted dbId surfaces via the same `?db=<id>` pin as
// real (magic-link / OAuth) sign-ins. Without this the mock flow
// lands directly on `/app` and the user sees the rail's newest-DB
// heuristic flash instead.
const MOCK_CALLBACK_PATH = "/auth/post-signin?next=%2Fapp";

// Side-channel for the verify URL. The `sendMagicLink` callback and
// `handleMockSignIn` execute in the same Worker request — we capture
// the URL here instead of round-tripping through KV, which is
// eventually-consistent and may return a stale (already-used) token.
let _capturedVerifyUrl: string | null = null;

export function captureVerifyUrl(url: string): void {
  _capturedVerifyUrl = url;
}

export function consumeCapturedVerifyUrl(): string | null {
  const url = _capturedVerifyUrl;
  _capturedVerifyUrl = null;
  return url;
}

// Minimal structural type for the bits of the Hono Context we use.
// Full typing would couple this file to the route handler's
// `Variables` shape (RequireSessionVariables &
// RequirePrincipalVariables) which the mock IdP doesn't read.
type MockSignInCtx = {
  req: { url: string; raw: Request };
  env: Cloudflare.Env;
};

export async function handleMockSignIn(c: MockSignInCtx): Promise<Response> {
  const requested = new URL(c.req.url).searchParams.get("email")?.trim();
  const email = requested && requested.length > 0 ? requested : DEFAULT_MOCK_EMAIL;

  const baseOrigin = resolveBaseOrigin(c.req.url);
  const callbackURL = `${baseOrigin}${MOCK_CALLBACK_PATH}`;

  const sendUrl = new URL("/api/auth/sign-in/magic-link", baseOrigin);
  const sendReq = new Request(sendUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseOrigin,
    },
    body: JSON.stringify({ email, callbackURL }),
  });
  const sendRes = await auth.handler(sendReq);
  if (sendRes.status >= 400) {
    return new Response(`mock_sign_in_send_failed: ${sendRes.status}`, { status: 502 });
  }

  // Prefer the in-memory capture (same-request, no KV consistency
  // lag). Fall back to KV for resilience.
  const verifyUrl = consumeCapturedVerifyUrl() ?? (await findLatestForEmail(c.env.KV, email))?.body;
  if (!verifyUrl) {
    return new Response("mock_sign_in_inbox_empty", { status: 502 });
  }

  // Forward the original request's `Cookie` header onto the verify
  // call. Real magic-link / OAuth flows are top-level navigations from
  // the user's browser, so the verify GET naturally carries every
  // cookie on the origin — including the `anon-bearer` stashed by
  // `POST /api/auth/anon-stash`. The synthetic `Request` we construct
  // here doesn't carry any of that by default, so Better Auth's
  // `after` hook reads `cookie: null` and `recordAnonAdoption` never
  // runs (SK-ANON-012). Copy the inbound `Cookie` header through and
  // adoption fires on mock sign-ins the same way it does on real ones.
  const cookieHeader = c.req.raw.headers.get("cookie");
  const verifyHeaders: Record<string, string> = { origin: baseOrigin };
  if (cookieHeader) verifyHeaders["cookie"] = cookieHeader;
  const verifyReq = new Request(verifyUrl, {
    method: "GET",
    headers: verifyHeaders,
    redirect: "manual",
  });
  return auth.handler(verifyReq);
}

export function mockSignInFormHtml(base: string): string {
  // The inline stash script mirrors `apps/web/src/pages/auth/sign-in.astro`'s
  // `stashAnonBearer()` — without it the mock-idp flow has no anon-bearer
  // cookie on the magic-link verify call, so Better Auth's `after` hook
  // in `apps/api/src/auth.ts` skips `recordAnonAdoption` and the anon
  // DBs created from the hero stay orphaned at `tenant_id=anon:<hash>`.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Mock sign-in (preview)</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; padding: 1.5rem; color: #111; }
h2 { margin: 0 0 1rem; font-size: 1.25rem; }
p { color: #555; }
input { padding: 0.5rem; width: 100%; box-sizing: border-box; margin: 0.5rem 0 1rem; border: 1px solid #ccc; }
button { padding: 0.6rem 1rem; background: #c6f432; border: 2px solid #0b0f0a; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<h2>Preview sign-in (mock IdP)</h2>
<p>This page only exists when <code>MOCK_IDP=1</code>. It mints a real Better Auth session for the email you submit, no OAuth or email round-trip required.</p>
<form id="mock-form" method="GET" action="${escapeHtml(base)}/api/auth/mock-sign-in">
  <label>Email
    <input name="email" value="${escapeHtml(DEFAULT_MOCK_EMAIL)}" />
  </label>
  <button type="submit">Sign in as this user</button>
</form>
<script>
  const apiBase = ${JSON.stringify(base)};
  const form = document.getElementById("mock-form");

  function readAnonBearer() {
    const anon = window.localStorage.getItem("nlqdb_anon") || "";
    return anon.startsWith("anon_") ? anon : null;
  }

  // Already-signed-in short-circuit mirrors apps/web/src/pages/auth/sign-in.astro.
  // The hero (SK-ANON-001) runs anon unconditionally and may redirect
  // a signed-in user here. Adopt in place and skip the form.
  (async () => {
    let hasSession = false;
    try {
      const res = await fetch(apiBase + "/api/auth/get-session", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text !== "null") {
          const body = JSON.parse(text);
          hasSession = !!(body && body.user);
        }
      }
    } catch {
      // best-effort — fall through to the form.
    }
    if (!hasSession) return;
    // SK-ANON-014: route through post-signin so the adopted dbId is
    // pinned via ?db=<id> for ChatPanel's synchronous mount.
    location.replace("/auth/post-signin?next=" + encodeURIComponent("/app"));
  })();

  let stashed = false;
  form.addEventListener("submit", async (e) => {
    if (stashed) return;
    e.preventDefault();
    try {
      const anon = readAnonBearer();
      if (anon) {
        await fetch(apiBase + "/api/auth/anon-stash", {
          method: "POST",
          credentials: "include",
          headers: { "x-anon-bearer": anon },
        });
      }
    } catch {
      // best-effort — see comment in sign-in.astro.
    }
    stashed = true;
    form.submit();
  });
</script>
</body>
</html>`;
}

function resolveBaseOrigin(requestUrl: string): string {
  const configured = auth.options.baseURL;
  if (typeof configured === "string" && configured.length > 0) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to request-URL origin
    }
  }
  return new URL(requestUrl).origin;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
