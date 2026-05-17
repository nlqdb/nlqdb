// `GET /v1/keys` + `DELETE /v1/keys/:id` (SK-APIKEYS-010 / SK-APIKEYS-011) —
// auth-gate behaviour.
//
// Same shape as `keys-mint.test.ts` and `databases-delete.test.ts`:
// SELF.fetch proves the routes are on the session-only path (no anon /
// sk_* bearer escape hatch — a leaked sk_live_ must not be able to
// enumerate or revoke sibling keys). The pure-function helpers
// (`listKeysByTenant`, `revokeKeyById`) are unit-tested in
// `api-keys.test.ts` against a vi.fn-driven D1 stub.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /v1/keys — auth gate", () => {
  it("returns 401 unauthorized without a session", async () => {
    const res = await SELF.fetch("https://example.com/v1/keys");
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer — enumeration must not be reachable from anon", async () => {
    const res = await SELF.fetch("https://example.com/v1/keys", {
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer — no privilege escalation from a leaked key", async () => {
    const res = await SELF.fetch("https://example.com/v1/keys", {
      headers: { authorization: "Bearer sk_live_doesnotexist" },
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /v1/keys/:id — auth gate", () => {
  it("returns 401 unauthorized without a session", async () => {
    const res = await SELF.fetch("https://example.com/v1/keys/k_1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer — revoke is session-only", async () => {
    const res = await SELF.fetch("https://example.com/v1/keys/k_1", {
      method: "DELETE",
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer — no privilege escalation via a leaked key", async () => {
    // Even if middleware resolved this key, the route is session-only:
    // sk_live's blast radius is data, not key-management mutation.
    const res = await SELF.fetch("https://example.com/v1/keys/k_1", {
      method: "DELETE",
      headers: { authorization: "Bearer sk_live_doesnotexist" },
    });
    expect(res.status).toBe(401);
  });
});
