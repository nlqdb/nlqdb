import { describe, expect, test } from "vitest";
import { httpsRedirectTarget, withHsts } from "../src/https-enforce.ts";

// GLOBAL-039 — `mcp.nlqdb.com` never serves plaintext: http 301s to https and
// every response carries HSTS. Dev/preview hosts are exempt.
describe("httpsRedirectTarget", () => {
  test("301-targets http on nlqdb.com hosts, preserving path + query", () => {
    expect(httpsRedirectTarget(new URL("http://mcp.nlqdb.com/mcp?x=1"))).toBe(
      "https://mcp.nlqdb.com/mcp?x=1",
    );
  });

  test("leaves https, localhost, workers.dev, and lookalike hosts alone", () => {
    expect(httpsRedirectTarget(new URL("https://mcp.nlqdb.com/mcp"))).toBeNull();
    expect(httpsRedirectTarget(new URL("http://localhost:8788/mcp"))).toBeNull();
    expect(httpsRedirectTarget(new URL("http://nlqdb-mcp.acct.workers.dev/"))).toBeNull();
    expect(httpsRedirectTarget(new URL("http://evilnlqdb.com/"))).toBeNull();
  });
});

describe("withHsts", () => {
  test("stamps HSTS while preserving the response", async () => {
    const res = withHsts(new Response("ok", { status: 200 }));
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });
});
