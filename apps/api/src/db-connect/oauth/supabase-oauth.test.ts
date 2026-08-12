// Unit tests for the Supabase OAuth token client. `fetch` is injected; a fixed
// `now` makes the absolute-expiry computation deterministic.

import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCode,
  refreshTokens,
  SupabaseOAuthError,
} from "./supabase-oauth.ts";

const CLIENT = { clientId: "cid", clientSecret: "csecret" };

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("supabase-oauth", () => {
  it("buildAuthorizeUrl carries PKCE S256 + the exact params", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "cid",
        redirectUri: "https://app.nlqdb.com/cb",
        state: "st",
        codeChallenge: "chal",
        scope: "all",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://api.supabase.com/v1/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge")).toBe("chal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("exchangeCode posts HTTP Basic + the authorization_code grant, computing absolute expiry", async () => {
    const { impl, calls } = fakeFetch(200, {
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
    });
    const tokens = await exchangeCode(
      CLIENT,
      { code: "code123", redirectUri: "https://app.nlqdb.com/cb", codeVerifier: "ver" },
      { fetchImpl: impl, now: () => 1000 },
    );
    expect(tokens).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: 4600 });
    const call = calls[0]!;
    expect(call.url).toBe("https://api.supabase.com/v1/oauth/token");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe(`Basic ${btoa("cid:csecret")}`);
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(call.init.body as string);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("code123");
    expect(form.get("code_verifier")).toBe("ver");
    expect(form.get("redirect_uri")).toBe("https://app.nlqdb.com/cb");
  });

  it("refreshTokens posts the refresh_token grant", async () => {
    const { impl, calls } = fakeFetch(200, {
      access_token: "at2",
      refresh_token: "rt2",
      expires_in: 100,
    });
    const tokens = await refreshTokens(CLIENT, "old_rt", { fetchImpl: impl, now: () => 50 });
    expect(tokens).toEqual({ accessToken: "at2", refreshToken: "rt2", expiresAt: 150 });
    const form = new URLSearchParams(calls[0]!.init.body as string);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("old_rt");
  });

  it("maps a non-2xx to a one-sentence error", async () => {
    const { impl } = fakeFetch(400, { error: "invalid_grant" });
    await expect(
      exchangeCode(CLIENT, { code: "x", redirectUri: "y", codeVerifier: "z" }, { fetchImpl: impl }),
    ).rejects.toBeInstanceOf(SupabaseOAuthError);
  });
});
