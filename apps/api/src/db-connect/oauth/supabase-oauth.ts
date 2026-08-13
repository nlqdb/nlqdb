// Supabase OAuth 2.0 token client (`SK-DBCONN-003`). The two token-endpoint
// calls the connect flow needs — exchange an authorization `code` for tokens,
// and refresh an expired access token — plus the authorize-URL builder. Pure
// `fetch` (injectable), no OAuth-client dependency (Arctic deprecated 2026-07;
// the flow is a handful of fetches per RFC 9700).
//
// Endpoints (P2-verified 2026-08, Supabase "Build an OAuth integration"):
//   authorize  GET  https://api.supabase.com/v1/oauth/authorize
//   token      POST https://api.supabase.com/v1/oauth/token
// The token endpoint authenticates the client with HTTP Basic
// (`client_id:client_secret`) and takes an `application/x-www-form-urlencoded`
// body. PKCE `S256` is used on the authorize leg and the `code_verifier` is
// replayed on exchange.

import { SpanStatusCode, trace } from "@opentelemetry/api";

const SUPABASE_API_BASE = "https://api.supabase.com";
export const SUPABASE_AUTHORIZE_URL = `${SUPABASE_API_BASE}/v1/oauth/authorize`;
export const SUPABASE_TOKEN_URL = `${SUPABASE_API_BASE}/v1/oauth/token`;

// Resolved token set, normalised for storage: the raw response's `expires_in`
// (relative seconds) is turned into an absolute `expiresAt` (epoch seconds) so
// the query-time refresh check is a simple comparison.
export type SupabaseTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type SupabaseOAuthClient = {
  clientId: string;
  clientSecret: string;
};

export class SupabaseOAuthError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "SupabaseOAuthError";
    this.statusCode = statusCode;
  }
}

// Build the provider authorize URL to 302 the user to (the `/start` route).
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
}): string {
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  if (params.scope) qs.set("scope", params.scope);
  return `${SUPABASE_AUTHORIZE_URL}?${qs.toString()}`;
}

// Exchange an authorization `code` (+ PKCE `code_verifier`) for tokens.
export function exchangeCode(
  client: SupabaseOAuthClient,
  params: { code: string; redirectUri: string; codeVerifier: string },
  opts: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<SupabaseTokens> {
  return tokenRequest(
    client,
    {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    },
    opts,
  );
}

// Exchange a refresh token for a fresh access token (query-time refresh).
export function refreshTokens(
  client: SupabaseOAuthClient,
  refreshToken: string,
  opts: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<SupabaseTokens> {
  return tokenRequest(client, { grant_type: "refresh_token", refresh_token: refreshToken }, opts);
}

async function tokenRequest(
  client: SupabaseOAuthClient,
  body: Record<string, string>,
  opts: { fetchImpl?: typeof fetch; now?: () => number },
): Promise<SupabaseTokens> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const nowSec = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const basic = btoa(`${client.clientId}:${client.clientSecret}`);

  // GLOBAL-014 — one span per provider REST call. `grant_type` is a bounded,
  // secret-free label; the code/secret/token never go on the span.
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan(
    "supabase.oauth.token",
    {
      attributes: {
        "http.request.method": "POST",
        "server.address": new URL(SUPABASE_TOKEN_URL).host,
        "oauth.grant_type": body["grant_type"] ?? "",
      },
    },
    async (span) => {
      try {
        const res = await fetchImpl(SUPABASE_TOKEN_URL, {
          method: "POST",
          headers: {
            authorization: `Basic ${basic}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(body).toString(),
        });
        span.setAttribute("http.response.status_code", res.status);

        if (!res.ok) {
          // One sentence, no code/secret echoed (`GLOBAL-012`).
          throw new SupabaseOAuthError(
            `Supabase rejected the authorization (HTTP ${res.status}); start the connect again.`,
            res.status,
          );
        }

        const json = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        if (!json.access_token || !json.refresh_token) {
          throw new SupabaseOAuthError(
            "Supabase returned an incomplete token response.",
            res.status,
          );
        }
        // Default to 1h if the provider omits expires_in — the refresh path
        // corrects any drift on the next 401.
        const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
        return {
          accessToken: json.access_token,
          refreshToken: json.refresh_token,
          expiresAt: nowSec() + expiresIn,
        };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
