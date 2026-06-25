// Auth-boundary integration tests for the hosted MCP Worker.
//
// Slice 3a tested a prefix-only bearer gate; slice 3b replaces that
// with `workers-oauth-provider` (`SK-MCP-011`/`-012`) + `McpAgent`
// Durable Object sessions (`SK-MCP-014`). The protocol body is still
// exercised in `packages/mcp/`; these tests run inside the Workers
// runtime via `cloudflareTest` so the OAuthProvider's
// `cloudflare:workers` import resolves and `SELF.fetch` hits the
// same handler wrangler will run in prod.
//
// Coverage:
//   • OAuth metadata served on `/.well-known/oauth-authorization-server`.
//   • `/mcp` without a valid OAuth access token returns 401 — no raw
//     `sk_*` bypass per the new architecture.
//   • The bridge-callback path rejects malformed input before
//     touching the upstream API.
//   • `/health` stays unauthenticated (route-monitor parity).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("apps/mcp auth boundary (slice 3b)", () => {
  it("serves OAuth authorization-server metadata", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body["authorization_endpoint"]).toBe("string");
    expect(typeof body["token_endpoint"]).toBe("string");
    // SK-MCP-012 — single `mcp` scope.
    expect(body["scopes_supported"]).toEqual(["mcp"]);
    // SK-MCP-011 — DCR endpoint advertised.
    expect(typeof body["registration_endpoint"]).toBe("string");
  });

  it("rejects /mcp without an Authorization header (OAuth gate)", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects /mcp with a raw sk_mcp bearer (no OAuth grant)", async () => {
    // Slice 3a accepted raw `sk_mcp_*` here; 3b's OAuthProvider only
    // accepts its own access tokens issued via `/authorize` -> `/token`.
    const res = await SELF.fetch("https://mcp.nlqdb.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer sk_mcp_test_dev_abcdef0123456789",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects /mcp with a bogus OAuth access token", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer not_a_real_access_token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it("/oauth/mcp-bridge-callback without code+flow returns 400", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/oauth/mcp-bridge-callback");
    expect(res.status).toBe(400);
  });

  it("/oauth/mcp-bridge-callback with malformed flow returns 400", async () => {
    const res = await SELF.fetch(
      "https://mcp.nlqdb.test/oauth/mcp-bridge-callback?code=abc123&flow=not-base64url!!!",
    );
    expect(res.status).toBe(400);
  });

  // `/authorize` is handled by our `bridgeHandler.handleAuthorize`
  // (OAuthProvider delegates it to `defaultHandler`). A real Cursor
  // install sends a custom-scheme `redirect_uri` (`cursor://…`), an
  // RFC 8707 `resource` indicator, and S256 PKCE — exactly the request
  // that 1101'd in prod on 2026-06-25. With BETTER_AUTH_SECRET present
  // it must reach the consent screen (302), never throw / never 500.
  it("/authorize with Cursor's custom-scheme redirect_uri + resource + PKCE reaches consent (302)", async () => {
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
    // The regression guard: must NOT be a 1101/500 (worker exception).
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(302);
    // Redirects to the consent screen with the signed flow blob.
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    expect(new URL(loc as string).pathname).toBe("/oauth/mcp-authorize");
    expect(new URL(loc as string).searchParams.get("flow")).toBeTruthy();
  });

  it("/health stays unauthenticated", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});

// WS06-T5 — DNS-rebinding defense per the MCP Streamable-HTTP spec
// (rev 2025-11-25): validate `Origin` on every connection, 403 an
// invalid one. Native clients send no `Origin` and must still pass.
describe("apps/mcp Origin validation (DNS-rebinding defense)", () => {
  it("allows requests with no Origin (native MCP clients, server-to-server)", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/health");
    expect(res.status).toBe(200);
  });

  it("allows the server's own origin", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/health", {
      headers: { origin: "https://mcp.nlqdb.test" },
    });
    expect(res.status).toBe(200);
  });

  it("allows the configured web origin (consent screen)", async () => {
    // miniflare binds NLQDB_WEB_ORIGIN=https://app.nlqdb.test.
    const res = await SELF.fetch("https://mcp.nlqdb.test/health", {
      headers: { origin: "https://app.nlqdb.test" },
    });
    expect(res.status).toBe(200);
  });

  it("rejects an unknown browser origin with 403", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/health", {
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects an unknown origin before the /mcp auth gate (403, not 401)", async () => {
    const res = await SELF.fetch("https://mcp.nlqdb.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
    });
    expect(res.status).toBe(403);
  });
});
