import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import { canonicalRedirectRules } from "./src/lib/canonical-redirects.ts";

// The 307 the asset router serves for a bare path is not a canonicalisation
// signal to Google, so emit an explicit `301` per built page into
// `dist/_redirects` (see `src/lib/canonical-redirects.ts` for the why).
// Derived from the built tree rather than the route list: what Cloudflare
// serves is the ground truth, and the same walk answers "is the bare path a
// real asset this rule would shadow?".
const canonicalRedirects = {
  name: "nlqdb:canonical-redirects",
  hooks: {
    "astro:build:done": ({ dir, logger }) => {
      const dist = dir.pathname;
      const pagePaths = [];
      (function walk(current) {
        for (const name of readdirSync(current)) {
          const entry = join(current, name);
          if (statSync(entry).isDirectory()) walk(entry);
          else if (name === "index.html") pagePaths.push(`/${relative(dist, current)}`);
        }
      })(dist);

      // A page always has a *directory* at its bare path; the shadowing case is
      // a sibling *file* of the same name (`dist/install`, the curl-pipe script).
      const rules = canonicalRedirectRules(pagePaths, (p) => {
        const bare = join(dist, p);
        return existsSync(bare) && statSync(bare).isFile();
      });
      writeFileSync(join(dist, "_redirects"), `${rules.join("\n")}\n`);
      logger.info(`_redirects: ${rules.length} bare-path 301s`);
    },
  },
};

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
  // Astro 7 changed the default to "jsx" (strips whitespace between inline
  // elements); keep the v6 semantics so inline spacing on the 126 marketing
  // pages doesn't shift under a toolchain bump.
  compressHTML: true,
  integrations: [react(), canonicalRedirects],
});
