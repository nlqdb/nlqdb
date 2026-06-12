// CORS preflight on `/v1/ask`.
//
// The endpoint serves two distinct caller shapes:
//   - Trusted origins (product UI + marketing site) → credentialed CORS.
//   - Arbitrary 3rd-party origins carrying `Bearer pk_live_*` → non-
//     credentialed CORS.
//
// Hono's `cors()` short-circuits OPTIONS with a 204 regardless of
// whether its `origin` callback returned a string or null. Chaining two
// cors handlers leaves the second one unreached, which dropped the
// `Access-Control-Allow-Origin` header for trusted preflights (the bug
// this test pins down). Dispatch by origin before invoking cors.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function preflight(origin: string, requestHeaders = "authorization, content-type") {
  return SELF.fetch("https://example.com/v1/ask", {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": requestHeaders,
    },
  });
}

describe("/v1/ask CORS preflight", () => {
  it("reflects trusted marketing origin with credentials allowed", async () => {
    const res = await preflight("https://nlqdb.com");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://nlqdb.com");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("reflects the product origin with credentials allowed", async () => {
    const res = await preflight("https://app.nlqdb.com");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.nlqdb.com");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("reflects a 3rd-party origin when preflight requests Authorization (pk_live)", async () => {
    const res = await preflight("https://customer-site.example");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://customer-site.example");
    // Non-credentialed handler — no Allow-Credentials.
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("rejects a random 3rd-party origin that does not look like pk_live", async () => {
    const res = await preflight("https://random.example", "content-type");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  // Regression pin: the browser client (apps/web/src/lib/api.ts) sends these
  // headers cross-origin on `/v1/ask`. If one is dropped from `allowHeaders`
  // the preflight aborts and the first-value path silently fails — invisible
  // to curl walkers, which don't preflight.
  it("allows every header the web client sends from a trusted origin", async () => {
    const res = await preflight("https://nlqdb.com", "content-type, authorization");
    const allowed = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    for (const h of ["content-type", "authorization", "cf-turnstile-response"]) {
      expect(allowed).toContain(h);
    }
  });
});
