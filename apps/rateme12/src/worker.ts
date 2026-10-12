// The Worker entry: static assets (styles, logo) are served before this runs;
// every page route renders here and reads through src/data.ts only.

import { publisherPage, serverPage } from "./detail.ts";
import { categoryPage, directoryPage } from "./directory.ts";
import { aboutPage, privacyPage, termsPage } from "./info.ts";
import { fleetPage, installPage, installPost } from "./install.ts";
import { html, page, type View } from "./layout.ts";
import { submitPage, submitPost } from "./submit.ts";

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
  [/^\/servers\/([^/]+)\/?$/, ([id]) => serverPage(id as string)],
  [/^\/publishers\/([^/]+)\/?$/, ([id]) => publisherPage(id as string)],
  [/^\/about\/?$/, async () => aboutPage],
  [/^\/privacy\/?$/, async () => privacyPage],
  [/^\/terms\/?$/, async () => termsPage],
  [/^\/submit\/?$/, (_, url) => submitPage(url)],
  [/^\/install\/?$/, (_, url) => installPage(url)],
  [/^\/fleet\/?$/, async () => fleetPage],
];

// The routes a form POSTs to; each calls src/data.ts and re-renders its page.
const FORMS: [RegExp, (form: FormData) => Promise<View>][] = [
  [/^\/submit\/?$/, submitPost],
  [/^\/install\/?$/, installPost],
];

const notFound: View = {
  status: 404,
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

async function render(url: URL): Promise<View> {
  for (const [pattern, view] of ROUTES) {
    const match = pattern.exec(url.pathname);
    const params = match && decodeParams(match);
    if (params) return view(params, url);
  }
  return notFound;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const form = request.method === "POST" && FORMS.find(([p]) => p.test(url.pathname));
    if (!form && request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...HEADERS, Allow: "GET, HEAD" },
      });
    }
    const view = form
      ? await form[1](await request.formData().catch(() => new FormData()))
      : await render(url);
    return new Response(page(view), {
      status: view.status ?? 200,
      headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
