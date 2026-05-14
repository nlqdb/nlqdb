// CORS allow-list for the hosted MCP Worker (`SK-MCP-011`).
//
// Slice 3a echoed the request origin or `*` — safe while every call
// was bearer-authenticated with no cookies. Slice 3b adds OAuth flows
// where the user-agent rides credentials (the consent screen on the
// web app's origin POSTs back). CORS-spec forbids
// `Access-Control-Allow-Origin: *` for credentialed requests, so the
// `defaultHandler` and OAuth endpoints need an explicit allow-list.
//
// The source of truth is `OAuthProvider`'s client registry. Each
// dynamically registered client (RFC 7591 via `/register`) supplies
// `redirect_uris[]`; we accept any origin matching the origin of any
// registered client's redirect URI. The web app's `NLQDB_WEB_ORIGIN`
// is allow-listed unconditionally because it serves the consent screen
// (not an OAuth client itself).
//
// `apps/mcp/` itself is bearer-authenticated and SHOULD NOT echo a
// credentialed origin on the `/mcp` route — that route only takes
// `Authorization: Bearer …`, never cookies. The OAuth routes
// (`/authorize`, `/token`, `/register`, `/oauth/mcp-bridge-callback`)
// do need the allow-list — they accept credentialed requests from
// the consent-screen origin.

import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";
const ALLOWED_HEADERS =
  "authorization, content-type, mcp-session-id, mcp-protocol-version, idempotency-key";

export type CorsEnv = {
  OAUTH_PROVIDER?: OAuthHelpers;
  NLQDB_WEB_ORIGIN?: string;
};

// Returns the response Origin to advertise. Null means "no CORS
// header" — the browser blocks the response. The caller decides what
// to do on a deny (preflight returns 403; non-preflight just omits
// the header so the browser's same-origin policy fires).
export async function resolveAllowedOrigin(
  requestOrigin: string | null,
  env: CorsEnv,
): Promise<string | null> {
  if (!requestOrigin) return null;
  // Same-origin (mcp.nlqdb.com calling itself) needs no CORS — but
  // the request never carries an Origin header in that case, so this
  // branch is dead in practice. Defense-in-depth only.
  if (env.NLQDB_WEB_ORIGIN && requestOrigin === env.NLQDB_WEB_ORIGIN) {
    return requestOrigin;
  }
  if (!env.OAUTH_PROVIDER) return null;
  // Scan registered clients. `listClients` paginates; we walk until
  // we hit a match or run out. Workers' subrequest budget allows
  // O(100) KV reads per request — registry size is small in practice
  // (one entry per MCP host the user has installed). The OAuth-
  // provider caches the listing internally; this is the simple
  // correct version. A future optimisation can stash the allow-list
  // in a single KV key updated on register.
  let cursor: string | undefined;
  do {
    const page = await env.OAUTH_PROVIDER.listClients({ cursor });
    for (const client of page.items) {
      if (!client.redirectUris) continue;
      for (const uri of client.redirectUris) {
        try {
          const url = new URL(uri);
          if (url.origin === requestOrigin) return requestOrigin;
        } catch {
          // Malformed redirect_uri in the registry — skip; the OAuth
          // provider rejects these at registration time, so this
          // path is defensive.
        }
      }
    }
    cursor = page.cursor;
  } while (cursor);
  return null;
}

export async function preflight(req: Request, env: CorsEnv): Promise<Response> {
  const requestOrigin = req.headers.get("origin");
  const allowed = await resolveAllowedOrigin(requestOrigin, env);
  if (!allowed) {
    // 403 with no allow-origin header — the browser blocks the
    // request before it ever fires. Returning 204 with no headers
    // would also block but obscures the failure in network panels.
    return new Response("CORS origin not allowed", { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": allowed,
      "access-control-allow-methods": ALLOWED_METHODS,
      "access-control-allow-headers": ALLOWED_HEADERS,
      "access-control-allow-credentials": "true",
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });
}

// Wraps a non-preflight response with CORS headers if the request
// origin is allow-listed. No-op when origin is missing (same-origin
// request) or unrecognized (browser will block the consumer; the
// response is still serialised).
export async function applyCors(req: Request, env: CorsEnv, res: Response): Promise<Response> {
  const requestOrigin = req.headers.get("origin");
  if (!requestOrigin) return res;
  const allowed = await resolveAllowedOrigin(requestOrigin, env);
  if (!allowed) return res;
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", allowed);
  headers.set("access-control-allow-credentials", "true");
  headers.append("vary", "Origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
