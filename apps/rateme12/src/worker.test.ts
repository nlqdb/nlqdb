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
    expect((await get("/admin/nope")).status).toBe(404);
    expect((await get("/admin/toString")).status).toBe(404);
    expect((await get("/nope")).status).toBe(404);
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

describe("footer pages — about, privacy, terms", () => {
  test("/about renders the live page and its formula anchor", async () => {
    const res = await get("/about");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<title>About rateme12 — Why We Rate MCP Servers</title>");
    expect(body).toContain('<h2 id="formula">The formula (community v3)</h2>');
    expect(body).not.toContain("Not connected yet");
  });

  test("/privacy and /terms say the rebuild stores nothing yet", async () => {
    for (const [path, h1] of [
      ["/privacy", "Privacy Policy"],
      ["/terms", "Terms of Service"],
    ]) {
      const res = await get(path as string);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain(`<h1>${h1}</h1>`);
      expect(body).toContain("This rebuild has no accounts and stores nothing yet.");
    }
  });
});

describe("journey 4 — submit a server", () => {
  const post = (fields: Record<string, string>) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return worker.fetch(new Request("https://rateme12.nlqdb.com/submit", { method: "POST", body }));
  };

  test("/submit shows the live account card, create-account tab first", async () => {
    const res = await get("/submit");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>Submit an MCP server</h1>");
    expect(body).toContain('<form class="submit-card" method="POST" action="/submit">');
    expect(body).toContain("Continue with GitHub");
    expect(body).toContain('autocomplete="new-password"');
    expect(body).not.toContain("Accounts aren't connected yet");
  });

  test("the sign-in tab is a plain GET, no script needed", async () => {
    const body = await (await get("/submit?mode=signin")).text();
    expect(body).toContain('value="signin" class="active">Sign in</button>');
    expect(body).toContain('autocomplete="current-password"');
    expect(body).not.toContain('name="name"');
  });

  test("a post calls data.ts and keeps what was typed except the password", async () => {
    const res = await post({
      mode: "create",
      method: "password",
      name: "<b>Ada</b>",
      email: "ada@example.com",
      password: "hunter2hunter2",
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Accounts aren't connected yet");
    expect(body).toContain('value="&lt;b&gt;Ada&lt;/b&gt;"');
    expect(body).toContain('value="ada@example.com"');
    expect(body).not.toContain("hunter2");
  });

  test("a social button and a malformed body both land on the notice", async () => {
    expect(await (await post({ mode: "signin", method: "github" })).text()).toContain(
      "Accounts aren't connected yet",
    );
    const res = await worker.fetch(
      new Request("https://rateme12.nlqdb.com/submit", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=x" },
        body: "not multipart",
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("journey 5 — connect an agent", () => {
  const post = (fields: Record<string, string>) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return worker.fetch(
      new Request("https://rateme12.nlqdb.com/install", { method: "POST", body }),
    );
  };

  test("/install names the rebuild's own endpoint and says it isn't served yet", async () => {
    const res = await get("/install");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h1>Give your agent the MCP-server directory</h1>");
    expect(body).toContain(
      "claude mcp add --transport http rateme12 https://rateme12.nlqdb.com/mcp",
    );
    expect(body).not.toContain("api.rateme12.com");
    expect(body).toContain("Not connected yet");
    expect(body).toContain('<form class="submit-card" method="POST" action="/install">');
    expect(body).toContain("reviewing as an agent needs an agent key.");
  });

  test("the client tabs are a GET that keeps the card's tab, and vice versa", async () => {
    const body = await (await get("/install?client=cursor&mode=signin")).text();
    expect(body).toContain('value="cursor" class="install-tab active"');
    expect(body).toContain("~/.cursor/mcp.json");
    expect(body).not.toContain("claude mcp add");
    expect(body).toContain('<input type="hidden" name="mode" value="signin" />');
    expect(body).toContain('<input type="hidden" name="client" value="cursor" />');
    for (const client of ["nope", "toString", "__proto__"]) {
      expect(await (await get(`/install?client=${client}`)).text()).toContain("claude mcp add");
    }
  });

  test("a card post calls data.ts and keeps the client tab, never the password", async () => {
    const body = await (
      await post({
        mode: "signin",
        method: "password",
        client: "raw",
        email: "a@b.co",
        password: "hunter2hunter2",
      })
    ).text();
    expect(body).toContain("Accounts aren't connected yet");
    expect(body).toContain('value="raw" class="install-tab active"');
    expect(body).toContain('value="a@b.co"');
    expect(body).not.toContain("hunter2");
  });

  test("/fleet shows the live signed-out card", async () => {
    const res = await get("/fleet");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<h2>Sign in to see your fleet usage</h2>");
    expect(body).toContain('<a class="btn" href="/install">Connect an agent</a>');
  });
});

describe("operator boards — /admin/*", () => {
  test.each([
    ["duplicates", "Near-duplicates", "the near-duplicate queue"],
    ["merges", "Merge log", "the merge log"],
    ["pipelines", "Pipeline health", "pipeline health"],
  ])("/admin/%s shows the live signed-out card", async (board, title, name) => {
    const res = await get(`/admin/${board}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(`<title>${title} — rateme12</title>`);
    expect(body).toContain(`<h2>Sign in to view ${name}</h2>`);
    expect(body).toContain("<p>This board is for administrators.</p>");
    expect(body).toContain('<a class="btn" href="/submit">Sign in</a>');
  });
});
