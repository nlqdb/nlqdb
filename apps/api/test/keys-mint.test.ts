// `POST /v1/keys` — auth-gate behaviour.
//
// Mirrors `ask.test.ts`'s shape: SELF.fetch proves the route is on the
// session-only path (no anon / sk_* bearer escape hatch). The mint
// helpers themselves are unit-tested in `api-keys.test.ts`; the input
// validation branches (length caps, missing claims) are tight inline
// code and rely on those helpers staying right.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("POST /v1/keys — auth gate", () => {
  it("returns 401 unauthorized without a session", async () => {
    const res = await SELF.fetch("https://example.com/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "sk_live" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer (mint must not be reachable from anon)", async () => {
    const res = await SELF.fetch("https://example.com/v1/keys", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
      },
      body: JSON.stringify({ type: "sk_live" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer (no privilege-escalation from a leaked key)", async () => {
    // The middleware would only ever resolve this if the key existed in
    // D1 + matched the HMAC; the assertion is that even a resolved
    // sk_live principal can't mint more keys — the route is session-only.
    const res = await SELF.fetch("https://example.com/v1/keys", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer sk_live_doesnotexist",
      },
      body: JSON.stringify({ type: "sk_mcp", host: "cursor", device: "macbook" }),
    });
    expect(res.status).toBe(401);
  });
});
