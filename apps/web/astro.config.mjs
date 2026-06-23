import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// Static-first marketing site. No adapter — `astro build` emits a
// static `dist/` that Cloudflare Workers Static Assets serves at the
// edge (apps/web/wrangler.toml). `site` is the absolute origin used
// for canonical URLs and the sitemap.
//
// `trailingSlash: "always"` matches what CF Static Assets serves: the
// default `build.format: "directory"` emits `<route>/index.html`, so
// `/agents/` is the 200 and bare `/agents` 307-redirects. Without this,
// `Astro.url.pathname` (hence `<link rel=canonical>` + `og:url`) comes
// out bare, pointing every crawler at a redirect of the page that
// declares it — a self-referential canonical that dilutes the AEO/SEO
// signal. "always" makes the pathname carry the slash, so canonical,
// og:url, sitemap, and llms.txt all advertise the non-redirecting URL.
//
// React integration is opt-in per island (SK-WEB-001): `.astro` pages
// stay JS-free; `.tsx` islands ship to the browser only when imported
// with a `client:*` directive.
export default defineConfig({
  site: "https://nlqdb.com",
  trailingSlash: "always",
  prefetch: true,
  integrations: [react()],
});
