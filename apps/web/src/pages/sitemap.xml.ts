import type { APIRoute } from "astro";
import { COMPETITORS } from "../data/competitors";
import { SOLVE_ENTRIES } from "../data/solve";

// Hand-rolled sitemap. The official `@astrojs/sitemap` integration
// auto-generates one from the page list, but the slug maps for `/vs/`
// and `/solve/` dynamic pages still have to be enumerated here —
// switch to the integration once the static surface set grows beyond
// a handful.

const SITE = "https://nlqdb.com";
const STATIC_ROUTES = ["/", "/manifesto", "/pricing", "/vs", "/solve"];

export const GET: APIRoute = () => {
  const routes = [
    ...STATIC_ROUTES,
    ...COMPETITORS.map((c) => `/vs/${c.slug}`),
    ...SOLVE_ENTRIES.map((s) => `/solve/${s.slug}`),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    routes.map((path) => `  <url><loc>${SITE}${path}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
