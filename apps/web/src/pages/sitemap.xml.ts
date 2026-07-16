import type { APIRoute } from "astro";
import { BLOG_POSTS } from "../data/blog";
import { COMPETITORS } from "../data/competitors";
import { SOLVE_ENTRIES } from "../data/solve";

// Hand-rolled sitemap. The official `@astrojs/sitemap` integration
// auto-generates one from the page list, but the slug maps for `/vs/`
// and `/solve/` dynamic pages still have to be enumerated here —
// switch to the integration once the static surface set grows beyond
// a handful.

const SITE = "https://nlqdb.com";
// CF Static Assets serves `<route>/index.html`, so the 200 URL carries a
// trailing slash and the bare path 307-redirects (matches `trailingSlash:
// "always"` in astro.config). Advertise the non-redirecting URL.
const withSlash = (p: string) => (p.endsWith("/") ? p : `${p}/`);
const STATIC_ROUTES = [
  "/",
  "/agents",
  "/architecture",
  "/blog",
  "/integrations",
  "/manifesto",
  "/pricing",
  "/vs",
  "/solve",
  "/privacy",
  "/terms",
  "/security/hall-of-fame",
];

// `lastmod` is the one sitemap hint Google + Bing actually use as a crawl
// signal — but only while it stays accurate; a value that's always "today"
// gets the tag ignored site-wide. So we emit it only where we hold a real
// date: blog posts (their publish date). Static / `/vs` / `/solve` pages
// have no reliable per-page modification date, so they carry `<loc>` alone.
type Entry = { path: string; lastmod?: string };

export const GET: APIRoute = () => {
  const entries: Entry[] = [
    ...STATIC_ROUTES.map((path) => ({ path })),
    ...COMPETITORS.map((c) => ({ path: `/vs/${c.slug}` })),
    ...SOLVE_ENTRIES.map((s) => ({ path: `/solve/${s.slug}` })),
    ...BLOG_POSTS.map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.date })),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(({ path, lastmod }) => {
        const loc = `<loc>${SITE}${withSlash(path)}</loc>`;
        return `  <url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
