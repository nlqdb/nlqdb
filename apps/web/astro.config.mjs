import { defineConfig } from "astro/config";

// Static-first marketing site. No adapter — `astro build` emits a
// static `dist/` that Cloudflare Workers Static Assets serves at the
// edge (apps/web/wrangler.toml). `site` is the absolute origin used
// for canonical URLs and the sitemap.
export default defineConfig({
  site: "https://nlqdb.com",
  prefetch: true,
});
