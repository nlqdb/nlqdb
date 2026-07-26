import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";
import { BLOG_POSTS } from "../../data/blog.ts";
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

  test("includes every competitor, solve, and blog slug from the data files", () => {
    for (const c of COMPETITORS) {
      expect(body).toContain(`<loc>https://nlqdb.com/vs/${c.slug}/</loc>`);
    }
    for (const s of SOLVE_ENTRIES) {
      expect(body).toContain(`<loc>https://nlqdb.com/solve/${s.slug}/</loc>`);
    }
    for (const p of BLOG_POSTS) {
      expect(body).toContain(`<loc>https://nlqdb.com/blog/${p.slug}/</loc>`);
    }
  });

  // A `<loc>` is a promise to a crawler: this URL is worth indexing, so a
  // stranger will enter it cold from a search result. `/security/hall-of-fame/`
  // shipped on the bare `<Base>` shell — no `<Topnav>`, no `<Footer>` — so it
  // rendered ONE onward link (`/`) where peer pages render 20+. Measured, it
  // was also the single highest-CTR organic surface on the site (4 of 8 GSC
  // clicks at 40% CTR / 28d; 5 of 9 first-party referral landings), so about
  // half of every organic arrival hit a dead end.
  //
  // Keying the sweep on the sitemap body rather than a hardcoded page list is
  // what makes it hold: the set checked is exactly the set we ask Google to
  // index, so a newly-advertised route inherits the guard. Non-sitemap
  // surfaces (`/app`, `/auth`, `/oauth`) stay out of scope by construction —
  // a sign-in or OAuth-consent screen must *not* offer marketing nav mid-flow.
  test("every sitemap-advertised page renders the site chrome", () => {
    const chrome = ["<Topnav", "<Footer"];
    const read = (...p: string[]) => readFileSync(join(pagesDir, ...p), "utf8");

    // `/vs/wrenai/` → `vs/[slug].astro`; `/agents/` → `agents/index.astro`;
    // `/architecture/` → `architecture.astro`; `/` → `index.astro`.
    const fileFor = (path: string): string => {
      const segs = path.split("/").filter(Boolean);
      if (segs.length === 0) return "index.astro";
      const parent = segs.slice(0, -1).join("/");
      for (const c of [
        `${segs.join("/")}.astro`,
        `${segs.join("/")}/index.astro`,
        join(parent, "[slug].astro"),
      ]) {
        if (existsSync(join(pagesDir, c))) return c;
      }
      throw new Error(`no src/pages file renders sitemap URL ${path}`);
    };

    const rendersChrome = (file: string): boolean => {
      const src = read(file);
      if (chrome.every((tag) => src.includes(tag))) return true;
      // One hop: a page may inherit chrome from its layout (`Legal.astro`
      // wraps /privacy + /terms). Layouts don't nest further in this app.
      const layout = src.match(/layouts\/(\w+\.astro)"/)?.[1];
      return layout ? chrome.every((tag) => read("..", "layouts", layout).includes(tag)) : false;
    };

    const paths = [...body.matchAll(/<loc>https:\/\/nlqdb\.com([^<]*)<\/loc>/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0); // the regex actually parsed the sitemap
    // Dedupe by template — 100+ URLs collapse to ~15 files, and a failure
    // names the template to fix rather than every URL it renders.
    const bare = [...new Set(paths.map(fileFor))].filter((f) => !rendersChrome(f));
    expect(bare).toEqual([]);
  });
});
