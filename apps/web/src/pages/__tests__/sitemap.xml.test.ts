import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { COMPETITORS } from "../../data/competitors.ts";
import { SOLVE_ENTRIES } from "../../data/solve.ts";
import { GET } from "../sitemap.xml.ts";

// The sitemap is hand-rolled (static routes enumerated by hand; `/vs` and
// `/solve` slugs derive from their data files). A page added to
// `src/pages/` is easy to ship without remembering to list it here —
// that happened to `/integrations`, which was advertised in `llms.txt`
// but absent from the sitemap, so sitemap-driven crawlers couldn't
// discover it. This guard enumerates the real marketing routes from the
// filesystem and asserts each is in the sitemap, so a *new* page can't
// silently fall out — the recurrence a hardcoded list wouldn't catch.

// App/auth/oauth surfaces are intentionally out of the public sitemap.
const NON_MARKETING_DIRS = new Set(["app", "auth", "oauth"]);

const pagesDir = new URL("../", import.meta.url).pathname;
const body = await (GET({} as never) as Response).text();

// Map a `src/pages` route file to its public path (`index.astro` → `/`,
// `<dir>/index.astro` → `/<dir>`). Returns null for non-marketing,
// dynamic (`[slug]`), or non-page files.
function routeFor(rel: string): string | null {
  if (NON_MARKETING_DIRS.has(rel.split("/")[0])) return null;
  if (rel.includes("[")) return null; // dynamic route — covered by the slug-parity test
  if (rel === "index.astro") return "/";
  if (rel.endsWith("/index.astro")) return `/${rel.slice(0, -"/index.astro".length)}`;
  if (rel.endsWith(".astro")) return `/${rel.slice(0, -".astro".length)}`;
  return null;
}

describe("sitemap.xml", () => {
  test("lists every indexable marketing page in src/pages", () => {
    const routes = [...new Glob("**/*.astro").scanSync({ cwd: pagesDir })]
      .map(routeFor)
      .filter((r): r is string => r !== null);
    expect(routes.length).toBeGreaterThan(0); // glob actually matched something
    for (const route of routes) {
      const withSlash = route.endsWith("/") ? route : `${route}/`;
      expect(body).toContain(`<loc>https://nlqdb.com${withSlash}</loc>`);
    }
  });

  test("includes every competitor and solve slug from the data files", () => {
    for (const c of COMPETITORS) {
      expect(body).toContain(`<loc>https://nlqdb.com/vs/${c.slug}/</loc>`);
    }
    for (const s of SOLVE_ENTRIES) {
      expect(body).toContain(`<loc>https://nlqdb.com/solve/${s.slug}/</loc>`);
    }
  });
});
