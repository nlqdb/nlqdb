// OAuth `defaultHandler` for the hosted MCP Worker — `/authorize`
// redirects to the consent screen with a signed flow blob;
// `/oauth/mcp-bridge-callback` redeems the one-shot code and
// completes the grant (`SK-MCP-011`, `SK-MCP-013`). `/register`,
// `/token`, and `/.well-known/*` are owned by `OAuthProvider`.

import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { createClient, NlqdbApiError } from "@nlqdb/sdk";
import { signBlob, verifyBlob } from "./crypto.ts";

const BRIDGE_CALLBACK_PATH = "/oauth/mcp-bridge-callback";

export type BridgeEnv = {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
  NLQDB_API_BASE_URL?: string;
  NLQDB_WEB_ORIGIN?: string;
  // Shared with `apps/api/`; HMAC key for the OAuth flow-state envelope.
  BETTER_AUTH_SECRET: string;
};

type BridgeStateBlob = {
  rt: string;
  ci: string;
  ru: string;
  sc: string[];
  st: string;
  cc?: string;
  cm?: string;
};

export const bridgeHandler: ExportedHandler<BridgeEnv> = {
  async fetch(req, env, _ctx): Promise<Response> {
    if (req.method !== "GET") return new Response("Not Found", { status: 404 });
    const { pathname } = new URL(req.url);
    if (pathname === "/authorize") return handleAuthorize(req, env);
    if (pathname === BRIDGE_CALLBACK_PATH) return handleBridgeCallback(new URL(req.url), env);
    if (pathname === "/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (pathname === "/") {
      return new Response(
        "nlqdb hosted MCP server — paste this URL into your host's MCP connector config.",
        { status: 200, headers: { "content-type": "text/plain" } },
      );
    }
    return new Response("Not Found", { status: 404 });
  },
};

async function handleAuthorize(req: Request, env: BridgeEnv): Promise<Response> {
  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(req);
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId);
  if (!client) return new Response("Unknown client_id", { status: 400 });

  // `BETTER_AUTH_SECRET` HMAC-signs the flow blob (SK-MCP-013). If it's
  // unprovisioned, `signBlob` calls `crypto.subtle.importKey` with a
  // zero-length key and throws a `DataError`, surfacing as a raw 1101
  // (the 2026-06-25 Cursor-install incident). `parseAuthRequest` has
  // already validated the client + redirect_uri, so we can fail back to
  // the client per RFC 6749 §4.1.2.1 with `error=server_error` instead.
  if (!env.BETTER_AUTH_SECRET) {
    return redirectError(oauthReq.redirectUri, oauthReq.state, "server_error");
  }

  const blob: BridgeStateBlob = {
    rt: oauthReq.responseType,
    ci: oauthReq.clientId,
    ru: oauthReq.redirectUri,
    sc: oauthReq.scope,
    st: oauthReq.state,
    ...(oauthReq.codeChallenge ? { cc: oauthReq.codeChallenge } : {}),
    ...(oauthReq.codeChallengeMethod ? { cm: oauthReq.codeChallengeMethod } : {}),
  };

  const consentUrl = new URL(
    "/oauth/mcp-authorize",
    env.NLQDB_WEB_ORIGIN ?? "https://app.nlqdb.com",
  );
  consentUrl.searchParams.set("flow", await signBlob(blob, env.BETTER_AUTH_SECRET));
  consentUrl.searchParams.set("client_name", client.clientName ?? client.clientId);
  consentUrl.searchParams.set("callback", new URL(BRIDGE_CALLBACK_PATH, req.url).toString());
  return Response.redirect(consentUrl.toString(), 302);
}

// Fail an authorize request back to the client's redirect_uri with an
// OAuth error (RFC 6749 §4.1.2.1). Used only after parseAuthRequest has
// validated the redirect_uri belongs to the client. Custom schemes
// (e.g. `cursor://…`) parse fine through `URL`.
function redirectError(redirectUri: string, state: string, error: string): Response {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  if (state) target.searchParams.set("state", state);
  return Response.redirect(target.toString(), 302);
}

async function handleBridgeCallback(url: URL, env: BridgeEnv): Promise<Response> {
  const code = url.searchParams.get("code");
  const flow = url.searchParams.get("flow");
  if (!code || !flow) return new Response("Missing code or flow", { status: 400 });

  let blob: BridgeStateBlob;
  try {
    blob = await verifyBlob<BridgeStateBlob>(flow, env.BETTER_AUTH_SECRET);
  } catch {
    // Single 400 for any envelope error — never tell the attacker which.
    return new Response("Malformed flow blob", { status: 400 });
  }

  const sdk = createClient({
    ...(env.NLQDB_API_BASE_URL ? { baseUrl: env.NLQDB_API_BASE_URL } : {}),
  });
  let redeemed: Awaited<ReturnType<typeof sdk.redeemOAuthBridgeCode>>;
  try {
    redeemed = await sdk.redeemOAuthBridgeCode(code);
  } catch (err) {
    const status = err instanceof NlqdbApiError ? err.httpStatus : 502;
    return new Response(`Bridge redemption failed: ${status}`, { status: 502 });
  }

  const authReq: AuthRequest = {
    responseType: blob.rt,
    clientId: blob.ci,
    redirectUri: blob.ru,
    scope: blob.sc,
    state: blob.st,
    ...(blob.cc ? { codeChallenge: blob.cc } : {}),
    ...(blob.cm ? { codeChallengeMethod: blob.cm } : {}),
  };
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: authReq,
    userId: redeemed.user_id,
    scope: authReq.scope,
    metadata: { mcpHost: redeemed.mcp_host, deviceId: redeemed.device_id },
    props: {
      bearer: redeemed.bearer,
      bearerHash: redeemed.bearer_hash,
      userId: redeemed.user_id,
      mcpHost: redeemed.mcp_host,
      deviceId: redeemed.device_id,
    },
  });
  return renderBridgeSuccess(redirectTo, redeemed.mcp_host);
}

// The MCP client's `redirect_uri` is often `http://localhost:<port>/…`
// bound to an ephemeral listener the agent CLI opens. That listener can
// die (agent restart, user closed the terminal, port already reclaimed)
// between consent and callback, and the browser silently lands on an
// unreachable page — the founder-observed "terrible onboarding" case
// (2026-08-18): user grants access, browser shows nothing helpful, tools
// never register, only manual paste of the full callback URL back to the
// agent unblocks it. So instead of a bare 302, render a branded page
// that (a) auto-redirects immediately so a live listener still wins,
// and (b) if the browser bounces back (dead listener → error → back
// button), shows explicit success + the callback URL with one-click
// copy and paste-back instructions. Custom-scheme hosts (`cursor://…`,
// `claudia://…`) get the redirect flash and the OS hand-off; the copy
// affordance is meaningful only for `http(s)` targets, and we hide it
// for schemes the browser can't render as text.
function renderBridgeSuccess(redirectTo: string, mcpHost: string): Response {
  const isHttp = /^https?:/i.test(redirectTo);
  const hostLabel = mcpHost || "your MCP client";
  const body = renderBridgeSuccessHtml({
    redirectTo,
    hostLabel,
    isHttp,
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // Custom schemes and localhost redirects are the whole point; keep
      // the referrer off so the code doesn't leak into a third-party log.
      "referrer-policy": "no-referrer",
    },
  });
}

// Kept a pure function so it's unit-testable without the Workers runtime.
export function renderBridgeSuccessHtml(args: {
  redirectTo: string;
  hostLabel: string;
  isHttp: boolean;
}): string {
  const { redirectTo, hostLabel, isHttp } = args;
  const safeRedirect = escapeHtml(redirectTo);
  const safeHost = escapeHtml(hostLabel);
  // `JSON.stringify` does NOT escape `</script>` — a redirect URL that
  // smuggled `</script><script>...` would break out of the inline block.
  // The signed flow blob keeps the redirect_uri bound to the registered
  // client, but defense-in-depth is cheap here.
  const redirectJson = JSON.stringify(redirectTo)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const copyBlock = isHttp
    ? `
      <section class="fallback" id="fallback" hidden>
        <h2 class="fallback__title">Didn't return to your agent?</h2>
        <p class="fallback__lede">
          The listener at this address may have closed. Copy the URL below and paste
          it back into <strong>${safeHost}</strong> to finish connecting.
        </p>
        <div class="fallback__row">
          <code class="fallback__url" id="cb-url">${safeRedirect}</code>
          <button type="button" class="btn btn--accent" id="cb-copy">Copy URL</button>
        </div>
        <p class="fallback__hint" id="cb-hint" aria-live="polite"></p>
      </section>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Connected to nlqdb</title>
<meta http-equiv="refresh" content="0;url=${safeRedirect}" />
<style>
  :root {
    --deep: #215136;
    --sage: #49755d;
    --lime: #c2ea4d;
    --cream: #f9f8f4;
    --paper: #e5e4db;
    --ink: #1b1d1b;
    --muted: #4b5563;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); color: var(--ink);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { min-height: 100vh; display: grid; place-items: center; padding: 48px 24px; }
  .card { width: 100%; max-width: 520px; background: #fff; border: 1px solid var(--paper);
    border-radius: 14px; padding: 36px; box-shadow: 0 1px 2px rgba(27,29,27,0.04); }
  h1 { font-family: "Space Grotesk", Inter, sans-serif; font-weight: 600;
    letter-spacing: -0.02em; margin: 0 0 12px; font-size: 26px; color: var(--deep); }
  h2 { font-family: "Space Grotesk", Inter, sans-serif; font-weight: 600;
    margin: 24px 0 8px; font-size: 16px; color: var(--deep); }
  p { margin: 0 0 12px; font-size: 14px; line-height: 1.55; color: var(--ink); }
  .lede { color: var(--muted); font-size: 14px; }
  .btn { border: 1px solid var(--paper); border-radius: 10px; background: transparent;
    color: var(--ink); font: inherit; font-size: 13px; padding: 8px 14px; cursor: pointer; }
  .btn--accent { background: var(--lime); border-color: var(--lime); color: var(--deep);
    font-weight: 600; }
  .btn--accent:hover { filter: brightness(0.97); }
  .fallback { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--paper); }
  .fallback__title { color: var(--deep); }
  .fallback__lede { color: var(--muted); }
  .fallback__row { display: flex; gap: 10px; align-items: stretch; margin: 12px 0 6px; }
  .fallback__url { flex: 1; min-width: 0; padding: 10px 12px; background: var(--cream);
    border: 1px solid var(--paper); border-radius: 8px; font-family:
    "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
    color: var(--ink); overflow-wrap: anywhere; word-break: break-all; }
  .fallback__hint { font-size: 12px; color: var(--sage); min-height: 1em; margin: 4px 0 0; }
  noscript p { color: var(--muted); }
</style>
</head>
<body>
<main>
  <div class="card">
    <h1>You're connected.</h1>
    <p class="lede">
      nlqdb granted access to <strong>${safeHost}</strong>. You can close this tab and
      return to your terminal — the tools should be available now.
    </p>
    <noscript>
      <p>If your agent didn't pick this up automatically, open
        <a href="${safeRedirect}">this link</a> to hand the code back.</p>
    </noscript>${copyBlock}
  </div>
</main>
<script>
  (function () {
    var target = ${redirectJson};
    // Give the meta refresh the first shot; if we're still here after a
    // beat, the listener is likely dead — reveal the fallback so the
    // user has a recovery path (founder-observed 2026-08-18).
    try { window.location.replace(target); } catch (e) { /* custom scheme may throw */ }
    var fb = document.getElementById("fallback");
    if (fb) {
      setTimeout(function () { fb.hidden = false; }, 1500);
    }
    var btn = document.getElementById("cb-copy");
    var hint = document.getElementById("cb-hint");
    if (btn) {
      btn.addEventListener("click", function () {
        var done = function (ok) {
          if (!hint) return;
          hint.textContent = ok ? "Copied. Paste it back into your agent." :
            "Couldn't copy — select the URL above and copy manually.";
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(target).then(function () { done(true); },
            function () { done(false); });
        } else {
          done(false);
        }
      });
    }
  })();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
