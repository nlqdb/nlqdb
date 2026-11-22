// Run: bun run --cwd apps/web build && bun scripts/web-events-walk.ts
// Walks SK-EVENTS-015 in a real browser: serves the built site under the
// `nlqdb.com` hostname, clicks a /solve page's "Try this query", and prints
// what the page sent — the `/v1/events/web` body, and any LogSnag request.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const dist = join(import.meta.dir, "../apps/web/dist");
const server = Bun.serve({
  port: 0,
  fetch(req) {
    const path = new URL(req.url).pathname;
    const file = join(dist, path.endsWith("/") ? `${path}index.html` : path);
    return existsSync(file) ? new Response(Bun.file(file)) : new Response("", { status: 404 });
  },
});

// The first /solve page with a "Try this query" button (attach pages link to /app/connect).
const slug = readdirSync(join(dist, "solve")).find((s) => {
  const file = join(dist, "solve", s, "index.html");
  return existsSync(file) && readFileSync(file, "utf8").includes("slv__try-btn");
});
const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP nlqdb.com 127.0.0.1, MAP app.nlqdb.com 127.0.0.1`],
});
const page = await browser.newPage();
const sent: unknown[] = [];
const logsnag: string[] = [];
page.on("request", (r) => {
  if (r.url().includes("logsnag")) logsnag.push(r.url());
});
await page.route("**/v1/events/web", (route) => {
  sent.push(route.request().postDataJSON());
  return route.fulfill({ status: 202, body: '{"accepted":true}' });
});
// The CTA navigates to the app origin; stop there, the click is what's walked.
await page.route("**/app/new/**", (route) => route.fulfill({ status: 204 }));

await page.goto(`http://nlqdb.com:${server.port}/solve/${slug}/`);
const html = await page.content();
await page.click(".slv__try-btn");
await page.waitForTimeout(1000);
console.log(
  JSON.stringify(
    {
      page: `/solve/${slug}/`,
      events_web: sent,
      logsnag_requests: logsnag.length,
      logsnag_in_html: /logsnag/i.test(html),
    },
    null,
    2,
  ),
);
await browser.close();
server.stop();
