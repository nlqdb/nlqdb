import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// Static-first marketing site. No adapter — `astro build` emits a
// static `dist/` that Cloudflare Workers Static Assets serves at the
// edge (apps/web/wrangler.toml). `site` is the absolute origin used
// for canonical URLs and the sitemap.
//
// React integration is opt-in per island (SK-WEB-001): `.astro` pages
// stay JS-free; `.tsx` islands ship to the browser only when imported
// with a `client:*` directive.
export default defineConfig({
  site: "https://nlqdb.com",
  prefetch: true,
  integrations: [react()],
});
