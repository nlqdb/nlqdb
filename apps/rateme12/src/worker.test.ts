/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import worker from "./worker.ts";

const get = (path: string) => worker.fetch(new Request(`https://rateme12.nlqdb.com${path}`));

describe("journey 1 — search / browse", () => {
  test("/ renders the product shell with the honest not-connected state", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    const body = await res.text();
    expect(body).toContain('<link rel="stylesheet" href="/styles.css" />');
    expect(body).toContain('class="site-header"');
    expect(body).toContain('<form class="search" method="GET" action="/"');
    expect(body).toContain("Not connected yet");
    expect(body).toContain('id="how-reputation-works"');
  });

  test("a search keeps the query and escapes it", async () => {
    const body = await (await get(`/?q=${encodeURIComponent('"><script>x</script>')}`)).text();
    expect(body).toContain('value="&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
    expect(body).not.toContain("<script>x");
    expect(body).toContain("Clear search");
  });

  test("/c/[tag] renders the category view", async () => {
    const res = await get("/c/databases");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>databases MCP servers</h1>");
    expect(body).toContain("Not connected yet");
  });

  test("unbuilt routes and malformed tags are an honest 404", async () => {
    expect((await get("/servers/x")).status).toBe(404);
    expect((await get("/c/%E0%A4%A")).status).toBe(404);
    expect((await get("/c/%20")).status).toBe(404);
  });

  test("writes are refused until the forms exist", async () => {
    const res = await worker.fetch(new Request("https://rateme12.nlqdb.com/", { method: "POST" }));
    expect(res.status).toBe(405);
  });
});
