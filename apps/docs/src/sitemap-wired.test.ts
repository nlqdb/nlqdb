import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The docs `robots.txt` advertises `sitemap-index.xml`, but Starlight emits no
// sitemap on its own — it bundles `@astrojs/sitemap` as a dependency yet leaves
// it unapplied. For months the advertised URL 404'd and Google never crawled
// `/agent-memory/` (the R-04 wedge page). This guard fails if the `sitemap()`
// integration is dropped or the advertised filename drifts from what
// `@astrojs/sitemap` actually emits (`sitemap-index.xml`), so the discovery
// path can't silently re-break (SK-DOCS-005).

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(join(DOCS_ROOT, "astro.config.mjs"), "utf8");
const robots = readFileSync(join(DOCS_ROOT, "public", "robots.txt"), "utf8");
const pkg = JSON.parse(readFileSync(join(DOCS_ROOT, "package.json"), "utf8"));

describe("docs sitemap is actually emitted", () => {
  test("the @astrojs/sitemap integration is imported and applied", () => {
    expect(config).toContain('from "@astrojs/sitemap"');
    expect(config).toMatch(/\bsitemap\(\)/);
  });

  test("@astrojs/sitemap is a direct dependency, not only transitive", () => {
    expect(pkg.dependencies?.["@astrojs/sitemap"]).toBeTruthy();
  });

  test("robots.txt advertises the exact filename @astrojs/sitemap emits", () => {
    // @astrojs/sitemap always emits `sitemap-index.xml` as the index entry.
    expect(robots).toContain("Sitemap: https://docs.nlqdb.com/sitemap-index.xml");
  });
});
