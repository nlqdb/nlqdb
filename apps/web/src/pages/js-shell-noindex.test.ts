import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// JS-shell noindex guard (SK-WEB-023). The `/app/*` and `/oauth/*` pages are
// empty auth-guarded shells that hydrate client-side; indexed, their prerender
// is a thin/soft-404 an Ahrefs crawl of the merged app host (SK-WEB-026)
// flagged. They sit outside the sitemap and must carry `noindex` so a new shell
// page can't silently ship indexable and re-open that error.
const PAGES = dirname(fileURLToPath(import.meta.url));

function shellPages(dir: string): string[] {
  return readdirSync(join(PAGES, dir))
    .filter((f) => f.endsWith(".astro"))
    .map((f) => `${dir}/${f}`);
}

describe("JS-shell pages are noindex", () => {
  test.each([...shellPages("app"), ...shellPages("oauth")])("%s carries noindex", (rel) => {
    expect(readFileSync(join(PAGES, rel), "utf8")).toContain("noindex");
  });
});
