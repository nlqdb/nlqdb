import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Static-build query-string integrity guard (sibling of the SK-WEB-022
// client-nav sweep).
//
// `apps/web` builds static (SK-WEB-001, no adapter), so `.astro`
// frontmatter runs exactly once at build time with an EMPTY query
// string. A page that branches on `Astro.url.searchParams` (or reads
// `Astro.url.search` / `Astro.request`) bakes one branch into the HTML
// for every visitor — which is how `/auth/continue` shipped rendering
// its "link is missing or malformed" error card to every magic-link
// click, breaking email sign-in entirely. Request-time data must be
// read client-side (`location.search`) as `post-signin.astro` and
// `mcp-authorize.astro` do.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const PAGES = join(REPO_ROOT, "apps", "web", "src", "pages");

function sweepAstro(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sweepAstro(p, acc);
    else if (name.endsWith(".astro")) acc.push(p);
  }
  return acc;
}

const REQUEST_TIME_READ = /\bAstro\.(?:url\.search|request\b)/g;

describe("static-page query-string integrity", () => {
  test("no .astro page reads request-time data at build time", () => {
    const offenders: Record<string, string> = {};
    for (const file of sweepAstro(PAGES)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(REQUEST_TIME_READ)) {
        const line = src.slice(0, m.index).split("\n").length;
        offenders[`${relative(REPO_ROOT, file)}:${line}`] =
          `${m[0]} is always empty in a static build — read location.search client-side`;
      }
    }
    expect(offenders).toEqual({});
  });
});
