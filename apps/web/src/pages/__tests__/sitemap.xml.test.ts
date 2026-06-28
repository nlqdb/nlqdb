import { describe, expect, test } from "bun:test";
import { COMPETITORS } from "../../data/competitors.ts";
import { SOLVE_ENTRIES } from "../../data/solve.ts";
import { GET } from "../sitemap.xml.ts";

// The sitemap is hand-rolled (static routes enumerated by hand; `/vs` and
// `/solve` slugs derive from their data files). A static page added to
// `src/pages/` is easy to ship without remembering to list it here —
// that happened to `/integrations`, which was advertised in `llms.txt`
// and `robots.txt` but absent from the sitemap, so sitemap-driven
// crawlers couldn't discover it. These checks pin the indexable marketing
// surface and the data-driven slug parity so a page can't silently fall
// out of the sitemap again (SK-CMP-004 keeps the machine-readable index
// in sync with the data files).

const body = await (GET({} as never) as Response).text();

describe("sitemap.xml", () => {
  test("lists every indexable top-level marketing page", () => {
    for (const path of [
      "/",
      "/agents",
      "/integrations",
      "/manifesto",
      "/pricing",
      "/vs",
      "/solve",
    ]) {
      const withSlash = path.endsWith("/") ? path : `${path}/`;
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
