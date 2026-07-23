import { describe, expect, test } from "vitest";
import { httpsRedirectTarget, withHsts } from "./https-enforce.ts";

// GLOBAL-039 — production nlqdb.com hosts must never serve plaintext: http
// 301s to https and every response carries HSTS. Dev/preview hosts
// (localhost, *.workers.dev) are exempt so `wrangler dev` keeps working.
describe("httpsRedirectTarget", () => {
  test("301-targets http on the apex and subdomains, preserving path + query", () => {
    expect(httpsRedirectTarget(new URL("http://nlqdb.com/solve/streak/?a=1"))).toBe(
      "https://nlqdb.com/solve/streak/?a=1",
    );
    expect(httpsRedirectTarget(new URL("http://app.nlqdb.com/v1/ask"))).toBe(
      "https://app.nlqdb.com/v1/ask",
    );
    expect(httpsRedirectTarget(new URL("http://mcp.nlqdb.com/mcp"))).toBe(
      "https://mcp.nlqdb.com/mcp",
    );
  });

  test("leaves https and non-production hosts alone", () => {
    expect(httpsRedirectTarget(new URL("https://nlqdb.com/"))).toBeNull();
    expect(httpsRedirectTarget(new URL("http://localhost:8787/v1/ask"))).toBeNull();
    expect(httpsRedirectTarget(new URL("http://nlqdb-api.acct.workers.dev/"))).toBeNull();
    // Suffix must be a subdomain boundary, not a substring match.
    expect(httpsRedirectTarget(new URL("http://evilnlqdb.com/"))).toBeNull();
  });
});

describe("withHsts", () => {
  test("stamps HSTS without disturbing status, body, or existing headers", async () => {
    const res = withHsts(new Response("ok", { status: 201, headers: { "x-existing": "kept" } }));
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("x-existing")).toBe("kept");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  test("works on immutable redirect responses", () => {
    const res = withHsts(Response.redirect("https://nlqdb.com/", 301));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://nlqdb.com/");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
  });
});
