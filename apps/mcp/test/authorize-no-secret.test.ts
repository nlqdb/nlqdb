// Regression guard for the 2026-06-25 Cursor-install 1101.
//
// In prod the `nlqdb-mcp-server` Worker had no `BETTER_AUTH_SECRET`
// (the deploy workflow never mirrored it). `handleAuthorize` ->
// `signBlob` -> `crypto.subtle.importKey` with a zero-length key threw
// a `DataError`, which escaped the fetch handler as a raw Cloudflare
// 1101 ("Worker threw exception"). Cursor's authorize redirect landed
// on an opaque error page and the OAuth flow dead-ended.
//
// This project runs the Worker with BETTER_AUTH_SECRET deliberately
// unset (see `integration-no-secret` in vitest.config.ts). Two layers
// must hold:
//   1. `handleAuthorize` detects the missing secret and fails the
//      client back to its redirect_uri with `error=server_error`
//      (RFC 6749 §4.1.2.1), instead of letting the HMAC sign throw.
//   2. Even if any other path threw, the top-level fetch handler
//      converts the exception into a structured 500 — never a 1101.
// Either way, the response is parseable; it is never an unhandled throw.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("apps/mcp /authorize with BETTER_AUTH_SECRET unprovisioned (prod 1101 repro)", () => {
  it("fails back to the client redirect_uri with error=server_error, never 1101/500", async () => {
    const reg = await SELF.fetch("https://mcp.nlqdb.test/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Cursor",
        redirect_uris: ["cursor://anysphere.cursor-mcp/oauth/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "mcp",
      }),
    });
    expect(reg.status).toBe(201);
    const clientId = ((await reg.json()) as Record<string, string>)["client_id"];
    expect(clientId).toBeTruthy();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId as string,
      code_challenge: "80W-cXbDJYh-GOZquemS6aBLf0WcSB5S5RJ1P33YrqU",
      code_challenge_method: "S256",
      redirect_uri: "cursor://anysphere.cursor-mcp/oauth/callback",
      state: "abc123state",
      scope: "mcp",
      resource: "https://mcp.nlqdb.com/mcp",
    });
    const res = await SELF.fetch(`https://mcp.nlqdb.test/authorize?${params.toString()}`, {
      redirect: "manual",
    });

    // The core assertion: no unhandled exception escaped the handler.
    expect(res.status).not.toBe(500);
    // RFC 6749 §4.1.2.1 — error redirect back to the validated client.
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const target = new URL(loc as string);
    expect(target.protocol).toBe("cursor:");
    expect(target.searchParams.get("error")).toBe("server_error");
    expect(target.searchParams.get("state")).toBe("abc123state");
  });
});
