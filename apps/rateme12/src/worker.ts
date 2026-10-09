// The Worker entry: static assets (styles, logo) are served before this runs;
// every page route renders here and reads through src/data.ts only.

import { categoryPage, directoryPage } from "./directory.ts";
import { html, page, type View } from "./layout.ts";

// _headers covers static assets only; Worker responses carry their own. The
// live product's fonts come from Google Fonts, so CSP admits those two hosts.
const HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex",
};

// One entry per §4 page route: a path pattern and the view it renders. A new
// route is one line here plus its page module. Captured segments arrive
// URL-decoded and trimmed; an undecodable or blank one is a 404.
const ROUTES: [RegExp, (params: string[], url: URL) => Promise<View>][] = [
  [/^\/$/, (_, url) => directoryPage((url.searchParams.get("q") ?? "").trim())],
  [/^\/c\/([^/]+)\/?$/, ([tag]) => categoryPage(tag as string)],
];

const notFound: View = {
  title: "Not found — rateme12",
  body: html`<div class="notice">
  <h2>This page doesn't exist yet</h2>
  <p>The rebuild adds the rest of rateme12's pages one journey at a time.</p>
  <a class="btn" href="/">Browse all servers</a>
</div>`,
};

function decodeParams(match: RegExpExecArray): string[] | null {
  try {
    const params = match.slice(1).map((s) => decodeURIComponent(s).trim());
    return params.every(Boolean) ? params : null;
  } catch {
    return null;
  }
}

async function render(url: URL): Promise<[View, number]> {
  for (const [pattern, view] of ROUTES) {
    const match = pattern.exec(url.pathname);
    const params = match && decodeParams(match);
    if (params) return [await view(params, url), 200];
  }
  return [notFound, 404];
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...HEADERS, Allow: "GET, HEAD" },
      });
    }
    const [view, status] = await render(new URL(request.url));
    return new Response(page(view), {
      status,
      headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
