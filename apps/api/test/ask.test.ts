// `/v1/ask` skeleton — auth-gate behaviour only. The handler body
// (plan cache, LLM, query execution, summarize, rate limit, first-
// query event) lands in commits 4-6; tests for those land alongside.
//
// Authenticated 200 path is deferred — needs a programmatically
// created session via Better Auth's `testUtils` plugin against a
// test-only auth instance. Easier to land alongside commit 4 (when
// there's actual orchestration to assert against than just a stub
// payload).

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("POST /v1/ask", () => {
  it("returns 401 unauthorized when no session cookie is sent", async () => {
    const res = await SELF.fetch("https://example.com/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: "anything" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});
