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
  return Response.redirect(redirectTo, 302);
}
