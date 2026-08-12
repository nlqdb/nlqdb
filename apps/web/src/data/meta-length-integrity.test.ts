import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clampDescription, clampTitle } from "../lib/meta";
import { STATIC_ROUTES } from "../pages/sitemap.xml";
import { BLOG_POSTS } from "./blog";
import { COMPETITORS } from "./competitors";
import { SOLVE_ENTRIES } from "./solve";

// SERP meta-length integrity guard (sibling of the SK-WEB-022
// client-nav-integrity sweep). Google truncates a `<title>` past ~60 chars
// and a `<meta name="description">` past ~155 in the result snippet, and a
// too-short one wastes the pitch — an Ahrefs audit flagged both classes across
// the data-driven `/solve`, `/vs`, `/blog` pages and the static marketing
// surface. `lib/meta.ts` word-boundary-clamps the data-page meta to the upper
// bound, and the P2 cluster carries hand-written overrides (lib/meta.ts); the
// static pages carry hand-tuned literals. This test pins the whole set inside
// 30–60 / 110–155 so a new page, a re-worded oneLiner, or a dropped override
// can't silently ship a clipped or thin snippet.
//
// The two halves mirror how the meta is actually produced:
//   • data pages — recompute the EXACT expression `[slug].astro` passes to
//     Base (`clampTitle`/`clampDescription` over the source field + optional
//     override), so the assertion tracks the rendered `<title>`/description,
//     not the raw source field (which is the on-page <h1>/lede and may be far
//     longer — that decoupling is the whole point of the clamp helpers).
//   • static pages — read the literal `title="…"` / `description="…"` props
//     the page hands its layout (`<Base>` or `<Legal>`), scanned only over the
//     STATIC_ROUTES set the sitemap advertises to crawlers, so the guard tracks
//     exactly the pages we tell Google to index (mid-flow `/oauth`, `/app`,
//     `/auth` screens are deliberately out of the sitemap and out of scope).

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 110;
const DESC_MAX = 155;

const WEB_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function titleOffender(label: string, value: string, acc: Record<string, string>) {
  if (value.length < TITLE_MIN || value.length > TITLE_MAX) {
    acc[label] = `title len=${value.length} (need ${TITLE_MIN}–${TITLE_MAX}): "${value}"`;
  }
}
function descOffender(label: string, value: string, acc: Record<string, string>) {
  if (value.length < DESC_MIN || value.length > DESC_MAX) {
    acc[label] = `desc len=${value.length} (need ${DESC_MIN}–${DESC_MAX}): "${value}"`;
  }
}

describe("SERP meta-length integrity", () => {
  test("every /solve page's rendered title + description fit the SERP", () => {
    const t: Record<string, string> = {};
    const d: Record<string, string> = {};
    for (const s of SOLVE_ENTRIES) {
      titleOffender(`solve/${s.slug}`, clampTitle(`${s.searchTitle} — nlqdb`, s.metaTitle), t);
      descOffender(`solve/${s.slug}`, clampDescription(s.oneLiner, s.metaDescription), d);
    }
    expect(t).toEqual({});
    expect(d).toEqual({});
  });

  test("every /vs page's rendered title + description fit the SERP", () => {
    const t: Record<string, string> = {};
    const d: Record<string, string> = {};
    for (const c of COMPETITORS) {
      titleOffender(
        `vs/${c.slug}`,
        clampTitle(`nlqdb vs ${c.name} — natural-language databases`, c.metaTitle),
        t,
      );
      descOffender(`vs/${c.slug}`, clampDescription(c.oneLiner, c.metaDescription), d);
    }
    expect(t).toEqual({});
    expect(d).toEqual({});
  });

  test("every /blog post's rendered title + description fit the SERP", () => {
    const t: Record<string, string> = {};
    const d: Record<string, string> = {};
    for (const p of BLOG_POSTS) {
      titleOffender(`blog/${p.slug}`, clampTitle(`${p.title} — nlqdb blog`, p.metaTitle), t);
      descOffender(`blog/${p.slug}`, clampDescription(p.description, p.metaDescription), d);
    }
    expect(t).toEqual({});
    expect(d).toEqual({});
  });

  test("every indexable static page's title + description fit the SERP", () => {
    // Map a sitemap route to its source file: `/` → index.astro; `/x` →
    // x.astro if it exists, else x/index.astro (directory index route).
    const routeToFile = (route: string): string => {
      const rel = route === "/" ? "index" : route.replace(/^\//, "");
      const flat = join(WEB_SRC, "pages", `${rel}.astro`);
      return existsSync(flat) ? flat : join(WEB_SRC, "pages", rel, "index.astro");
    };
    // The layout props carry the meta. Scan from the layout open tag so an
    // earlier `title="…"` (a comment, an inline SVG) can't shadow it; both
    // `<Base>` and the legal-pages `<Legal>` wrapper take the same props.
    const extract = (src: string, attr: "title" | "description"): string | null => {
      const layoutAt = Math.max(src.indexOf("<Base"), src.indexOf("<Legal"));
      const region = layoutAt >= 0 ? src.slice(layoutAt) : src;
      // Match the opening quote, then anything up to the SAME quote — a value
      // may contain the other quote (an apostrophe inside a "…" attribute).
      return new RegExp(`\\b${attr}=("|')(.*?)\\1`).exec(region)?.[2] ?? null;
    };
    const t: Record<string, string> = {};
    const d: Record<string, string> = {};
    for (const route of STATIC_ROUTES) {
      const file = routeToFile(route);
      const src = readFileSync(file, "utf8");
      const title = extract(src, "title");
      const description = extract(src, "description");
      // A page whose meta the regex can't see (a computed prop) is itself a
      // failure — the guard only works on literal props, so force the pattern.
      if (title === null) t[route] = `no literal title= on layout in ${route}`;
      else titleOffender(route, title, t);
      if (description === null) d[route] = `no literal description= on layout in ${route}`;
      else descOffender(route, description, d);
    }
    expect(t).toEqual({});
    expect(d).toEqual({});
  });
});
