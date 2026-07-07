// `POST /v1/premium/interest` — auth-gate behaviour for the "Count me in"
// hosted-premium interest capture (SK-PREMIUM-013's subscribe door).
// Mirrors `byollm-endpoints.test.ts`: SELF.fetch proves the route is
// session-only, so "whoever clicked" is always a real account identity —
// never an anon or `sk_*` bearer.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const base = "https://example.com/v1/premium/interest";

describe("/v1/premium/interest — auth gate", () => {
  it("POST returns 401 without a session", async () => {
    const res = await SELF.fetch(base, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer (interest must carry an account identity)", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer (no notification from a leaked key)", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { authorization: "Bearer sk_live_doesnotexist" },
    });
    expect(res.status).toBe(401);
  });
});
