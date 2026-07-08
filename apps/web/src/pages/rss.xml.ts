import type { APIRoute } from "astro";
import { BLOG_POSTS } from "../data/blog";

// Hand-rolled RSS 2.0 feed for /blog — same no-dependency, Workers-safe
// pattern as sitemap.xml.ts / llms.txt.ts (the `@astrojs/rss` integration
// would add a dependency for what is a dozen lines over the same data
// file). Enables syndication: feed readers subscribe, and dev.to / Medium /
// Hashnode auto-import posts from this URL, so a published post reaches
// aggregators without a manual venue re-post. Autodiscovered via the
// <link rel="alternate" type="application/rss+xml"> tag in Base.astro.

const SITE = "https://nlqdb.com";

// CF Static Assets serves `<route>/index.html`, so the 200 URL carries a
// trailing slash and the bare path 307-redirects (matches sitemap.xml.ts).
const withSlash = (p: string) => (p.endsWith("/") ? p : `${p}/`);

// Post titles/descriptions are free text, so XML-escape before embedding —
// unlike the sitemap, which only ever emits known-safe URL paths.
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ISO yyyy-mm-dd → RFC-822 (RSS pubDate), anchored at UTC midnight so the
// date matches the <time> the post template renders.
const rfc822 = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).toUTCString();

export const GET: APIRoute = () => {
  const items = BLOG_POSTS.map((p) => {
    const link = `${SITE}${withSlash(`/blog/${p.slug}`)}`;
    return (
      `    <item>\n` +
      `      <title>${esc(p.title)}</title>\n` +
      `      <link>${link}</link>\n` +
      `      <guid isPermaLink="true">${link}</guid>\n` +
      `      <pubDate>${rfc822(p.date)}</pubDate>\n` +
      `      <description>${esc(p.description)}</description>\n` +
      `    </item>`
    );
  }).join("\n");

  // Newest post drives lastBuildDate (BLOG_POSTS is newest-first).
  const lastBuild = rfc822(BLOG_POSTS[0]?.date ?? "1970-01-01");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>nlqdb blog</title>\n` +
    `    <link>${SITE}${withSlash("/blog")}</link>\n` +
    `    <description>Engineering notes from building nlqdb — SQL traps, LLM-pipeline debugging, honest comparisons.</description>\n` +
    `    <language>en-us</language>\n` +
    `    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />\n` +
    `    <lastBuildDate>${lastBuild}</lastBuildDate>\n` +
    `${items}\n` +
    `  </channel>\n` +
    `</rss>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
