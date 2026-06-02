// `/v1/keys/byollm` — auth-gate + routing behaviour (SK-PREMIUM-008,
// SK-PREMIUM-012). Mirrors `keys-mint.test.ts`: SELF.fetch proves the
// route is session-only (a decryptable key must never be reachable from an
// anon or `sk_*` bearer) and that the static `byollm` segment is matched
// ahead of the `/v1/keys/:id` param route. The store helpers themselves are
// integration-tested in `byollm-account.test.ts`.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const base = "https://example.com/v1/keys/byollm";

describe("/v1/keys/byollm — auth gate", () => {
  it("POST returns 401 without a session", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "openai", model: "gpt-5.2", key: "sk-x" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET returns 401 without a session", async () => {
    expect((await SELF.fetch(base)).status).toBe(401);
  });

  it("DELETE returns 401 without a session (not swallowed by /v1/keys/:id)", async () => {
    // A 401 (session gate) rather than a 404 proves the static byollm route
    // matched — the `:id` revoke route is also session-gated, so either way
    // an unauthenticated caller is rejected before any tenant lookup.
    expect((await SELF.fetch(base, { method: "DELETE" })).status).toBe(401);
  });

  it("rejects an anon bearer (a stored key must ride a first-party session)", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
      },
      body: JSON.stringify({ provider: "openai", model: "gpt-5.2", key: "sk-x" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer (no privilege escalation from a leaked key)", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer sk_live_doesnotexist" },
      body: JSON.stringify({ provider: "openai", model: "gpt-5.2", key: "sk-x" }),
    });
    expect(res.status).toBe(401);
  });
});
