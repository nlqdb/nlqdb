// `/v1/ask` skeleton — auth-gate behaviour only.
//
// The full authenticated 200 path needs a programmatically created
// session via Better Auth's `testUtils` plugin; landing it requires
// a real LLM router stub and the create branch's libpg-query WASM
// boot, both of which are exercised in their own unit suites
// (apps/api/src/db-create/orchestrate.test.ts +
// apps/api/test/orchestrate.test.ts). What this file covers is the
// principal-gate seam: 401 without auth, 401 on malformed bearer,
// and the anon-bearer fork that opens the route to anonymous users.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("POST /v1/ask — principal gate", () => {
  it("returns 401 unauthorized when neither cookie nor anon bearer is present", async () => {
    const res = await SELF.fetch("https://example.com/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: "anything" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when the Authorization header is not an anon_ bearer", async () => {
    const res = await SELF.fetch("https://example.com/v1/ask", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer pk_live_not_anon",
      },
      body: JSON.stringify({ goal: "anything" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects bare 'Bearer anon_' (no entropy)", async () => {
    const res = await SELF.fetch("https://example.com/v1/ask", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_",
      },
      body: JSON.stringify({ goal: "anything" }),
    });
    expect(res.status).toBe(401);
  });

  it("accepts Bearer anon_<token> past the gate (returns 400 goal_required when body is empty)", async () => {
    // The principal gate is the seam under test — once accepted, an
    // empty body falls through to `parseAskBody`, which returns
    // `goal_required`. That 400 (not 401) is the contract we care
    // about: anon traffic gets parsed like authed traffic.
    const res = await SELF.fetch("https://example.com/v1/ask", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "goal_required" });
  });
});
