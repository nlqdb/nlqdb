// The Worker entry: static assets (styles, logo) are served before this runs;
// every page route renders here and reads through src/data.ts only.

import { categoryPage, directoryPage } from "./directory.ts";
import { html, page } from "./layout.ts";

// _headers covers static assets only; Worker responses carry their own. The
// live product's fonts come from Google Fonts, so CSP admits those two hosts.
const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex",
};

function respond(view: { title: string; body: ReturnType<typeof html> }, status = 200): Response {
  return new Response(page(view.title, view.body), { status, headers: HEADERS });
}

const notFound = {
  title: "Not found — rateme12",
  body: html`<div class="notice">
  <h2>This page doesn't exist yet</h2>
  <p>The rebuild adds the rest of rateme12's pages one journey at a time.</p>
  <a class="btn" href="/">Browse all servers</a>
</div>`,
};

function categoryTag(pathname: string): string | null {
  const segment = /^\/c\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment).trim() || null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    if (url.pathname === "/") {
      return respond(await directoryPage((url.searchParams.get("q") ?? "").trim()));
    }
    const tag = categoryTag(url.pathname);
    if (tag) return respond(await categoryPage(tag));
    return respond(notFound, 404);
  },
};
