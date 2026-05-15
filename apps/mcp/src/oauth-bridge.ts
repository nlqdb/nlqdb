// OAuth `defaultHandler` for the hosted MCP Worker. Implements three
// routes (`SK-MCP-011`, `SK-MCP-013`):
//
//   GET  /authorize                 — parses the OAuth request,
//                                     redirects the user-agent to the
//                                     consent page at `${WEB}/oauth/mcp-authorize`
//                                     with the flow context encoded.
//   GET  /oauth/mcp-bridge-callback — redeems the one-shot code minted
//                                     by `apps/api/`'s
//                                     `/v1/oauth/mcp-callback`, mints
//                                     the `sk_mcp_*` key, calls
//                                     `completeAuthorization` with
//                                     props, redirects back to the
//                                     OAuth client's `redirect_uri`.
//   GET  /                          — landing page (debug only).
//
// `/register` (RFC 7591), `/token`, and `/.well-known/*` are handled
// by the OAuthProvider itself — we don't see those here.
//
// The state CSRF defense: every `/authorize` packs the OAuth flow
// context into a signed-cookie-free, KV-free, base64url-encoded
// payload that round-trips through the consent screen and back. The
// OAuth `state` parameter coming from the MCP client is separately
// round-tripped verbatim.

import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { createClient, NlqdbApiError } from "@nlqdb/sdk";

const BRIDGE_CALLBACK_PATH = "/oauth/mcp-bridge-callback";

export type BridgeEnv = {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
  NLQDB_API_BASE_URL?: string;
  NLQDB_WEB_ORIGIN?: string;
  // Shared with `apps/api/`. Used here as the HMAC key for the OAuth
  // flow-state blob — see `signBlob` / `verifyBlob`. Required at
  // runtime; missing it makes `/authorize` return 500 rather than
  // silently downgrading to an unsigned blob.
  BETTER_AUTH_SECRET: string;
  // `apps/api/` accepts a session cookie. The MCP Worker doesn't share
  // cookies with `apps/api/` directly — the consent page on
  // `${NLQDB_WEB_ORIGIN}` calls `POST /v1/oauth/mcp-callback` with the
  // user's session and returns the one-shot code in its redirect.
};

type BridgeStateBlob = {
  rt: string; // responseType
  ci: string; // clientId
  ru: string; // redirectUri
  sc: string[]; // scope
  st: string; // OAuth client state (from the MCP host)
  cc?: string; // codeChallenge
  cm?: string; // codeChallengeMethod
};

export const bridgeHandler: ExportedHandler<BridgeEnv> = {
  async fetch(req, env, _ctx): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    if (req.method === "GET" && pathname === "/authorize") {
      return handleAuthorize(req, env);
    }
    if (req.method === "GET" && pathname === BRIDGE_CALLBACK_PATH) {
      return handleBridgeCallback(url, env);
    }
    if (req.method === "GET" && pathname === "/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (req.method === "GET" && pathname === "/") {
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
  if (!client) {
    return new Response("Unknown client_id", { status: 400 });
  }
  // The consent screen lives at `${WEB}/oauth/mcp-authorize`. It
  // receives the flow context in a base64url-encoded payload so it
  // can echo it back to `${WEB}/v1/oauth/mcp-callback` (which then
  // forwards the minted code back here). The OAuth `state` parameter
  // stays unmodified — that's the MCP client's CSRF defense and
  // belongs to them.
  const stateBlob: BridgeStateBlob = {
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
  consentUrl.searchParams.set("flow", await signBlob(stateBlob, env.BETTER_AUTH_SECRET));
  consentUrl.searchParams.set("client_name", client.clientName ?? client.clientId);
  // Build the callback URL the consent screen redirects back to.
  // Same origin as this Worker.
  const callback = new URL(BRIDGE_CALLBACK_PATH, req.url);
  consentUrl.searchParams.set("callback", callback.toString());
  return Response.redirect(consentUrl.toString(), 302);
}

async function handleBridgeCallback(url: URL, env: BridgeEnv): Promise<Response> {
  const code = url.searchParams.get("code");
  const flow = url.searchParams.get("flow");
  if (!code || !flow) {
    return new Response("Missing code or flow", { status: 400 });
  }
  let stateBlob: BridgeStateBlob;
  try {
    stateBlob = await verifyBlob<BridgeStateBlob>(flow, env.BETTER_AUTH_SECRET);
  } catch {
    // Malformed envelope, missing signature, or signature mismatch.
    // Single 400 — never tell the attacker which.
    return new Response("Malformed flow blob", { status: 400 });
  }
  // Worker-to-Worker call to `apps/api/`'s redemption endpoint via the
  // SDK (`GLOBAL-001`). The one-shot `code` is the auth proof — no
  // bearer needed on the client. On success the response carries the
  // minted `sk_mcp_*` key + claims, which we install as the OAuth
  // grant's `props`.
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
  // The flow blob from the consent screen pins the client_id +
  // redirect_uri the MCP host originally requested. Re-validate
  // before completing the grant — a swapped client_id between
  // `/authorize` and `/bridge-callback` would be an attack signal.
  const authReq: AuthRequest = {
    responseType: stateBlob.rt,
    clientId: stateBlob.ci,
    redirectUri: stateBlob.ru,
    scope: stateBlob.sc,
    state: stateBlob.st,
    ...(stateBlob.cc ? { codeChallenge: stateBlob.cc } : {}),
    ...(stateBlob.cm ? { codeChallengeMethod: stateBlob.cm } : {}),
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
  return Response.redirect(redirectTo, 302);
}

// Signed envelope: `<base64url(json)>.<base64url(hmac)>`. The blob
// round-trips the OAuth flow context (clientId, redirectUri, scope,
// state, PKCE challenge) through the consent screen URL. Signing is
// non-negotiable — without it an attacker can substitute their own
// redirectUri (auth-code exfiltration) or strip the PKCE challenge
// (`completeAuthorization` re-checks clientId against the registry but
// trusts the other fields). HMAC-SHA256 over the payload, keyed by
// `BETTER_AUTH_SECRET`.
async function signBlob(value: unknown, secret: string): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
  const mac = await hmac(secret, payload);
  return `${payload}.${mac}`;
}

async function verifyBlob<T>(envelope: string, secret: string): Promise<T> {
  const dot = envelope.indexOf(".");
  if (dot < 0) throw new Error("blob: missing signature");
  const payload = envelope.slice(0, dot);
  const sig = envelope.slice(dot + 1);
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(sig, expected)) throw new Error("blob: signature mismatch");
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as T;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "==".slice(0, (4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Re-export for tests.
export { signBlob, verifyBlob };
