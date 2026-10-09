/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import * as data from "./data.ts";
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
    expect((await get("/install")).status).toBe(404);
    expect((await get("/servers/%E0%A4%A")).status).toBe(404);
    expect((await get("/c/%E0%A4%A")).status).toBe(404);
    expect((await get("/c/%20")).status).toBe(404);
  });

  test("writes are refused until the forms exist", async () => {
    const res = await worker.fetch(new Request("https://rateme12.nlqdb.com/", { method: "POST" }));
    expect(res.status).toBe(405);
  });
});

describe("journey 2 — server and publisher pages", () => {
  test("/servers/[id] keeps the breadcrumb and shows the not-connected state", async () => {
    const res = await get("/servers/201145a3-9ec0-4504-84b4-511c772da4c0");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(
      '<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">All servers</a></nav>',
    );
    expect(body).toContain("Not connected yet");
  });

  test("/publishers/[id] keeps the back link and shows the not-connected state", async () => {
    const res = await get("/publishers/heyputer");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<a class="back" href="/">← All servers</a>');
    expect(body).toContain("Not connected yet");
  });
});

describe("journey 2 — an unknown id once connected", () => {
  test("gets the live product's 404 notice and title", async () => {
    const real = { ...data };
    mock.module("./data.ts", () => ({
      ...real,
      getServer: async () => ({ status: "ok", value: null }),
    }));
    try {
      const res = await get("/servers/nope");
      expect(res.status).toBe(404);
      const body = await res.text();
      expect(body).toContain("<title>Server not found — rateme12 MCP directory</title>");
      expect(body).toContain("<p>Nothing in the directory has the id “nope”.</p>");
    } finally {
      mock.module("./data.ts", () => real); // a failed assertion must not leak the mock
    }
  });
});
