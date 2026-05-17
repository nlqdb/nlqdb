// `DELETE /v1/databases/:id` (SK-HDC-016) — auth-gate + CORS behaviour.
//
// Mirrors `keys-mint.test.ts`'s shape: SELF.fetch proves the route is
// on the session-only path (no anon / sk_* bearer escape hatch). The
// happy-path drop + registry-row delete is covered by
// `apps/api/src/db-create/neon-provision.test.ts`'s
// `dropSchemaAndRegistry` suite — the rollback primitive the route
// reuses. The `stripDbPrefix` boundary check that the route calls
// before passing the schema name down is covered by the same file.
// What this file covers is the principal-gate seam + the CORS
// preflight contract for the new method.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("DELETE /v1/databases/:id — auth gate", () => {
  it("returns 401 unauthorized without a session", async () => {
    const res = await SELF.fetch("https://example.com/v1/databases/db_x_a1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer — destructive ops are session-only", async () => {
    const res = await SELF.fetch("https://example.com/v1/databases/db_x_a1", {
      method: "DELETE",
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer — no privilege escalation via a leaked key", async () => {
    // Even if middleware resolved this key, the route is session-only:
    // sk_live's blast radius is data, not registry mutation.
    const res = await SELF.fetch("https://example.com/v1/databases/db_x_a1", {
      method: "DELETE",
      headers: { authorization: "Bearer sk_live_doesnotexist" },
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /v1/databases/:id — CORS preflight", () => {
  it("advertises DELETE in `access-control-allow-methods` so browsers can issue the verb", async () => {
    const res = await SELF.fetch("https://example.com/v1/databases/db_x_a1", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.nlqdb.com",
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "content-type,idempotency-key",
      },
    });
    expect(res.status).toBeLessThan(300);
    const allow = res.headers.get("access-control-allow-methods") ?? "";
    expect(allow.toUpperCase()).toContain("DELETE");
    // Confirm `idempotency-key` survives the preflight too — without it
    // the SDK's auto-generated key (GLOBAL-005) gets stripped by the browser.
    const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
    expect(allowHeaders.toLowerCase()).toContain("idempotency-key");
  });
});
