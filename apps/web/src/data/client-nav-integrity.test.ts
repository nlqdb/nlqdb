import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// SK-WEB-022 client-nav trailing-slash integrity guard (sibling of the
// SK-WEB-008 cli-verb and SK-MCP-002 mcp-tool sweeps).
//
// `astro.config.mjs` sets `trailingSlash: "always"`, so CF Static Assets
// serves `/app/new/` as the 200 and 307-redirects bare `/app/new`. The
// `check-links.mjs` sweep catches this for `href`/`src` literals in the built
// HTML — but a *client-side* navigation (`window.location.assign("/app/new")`
// in a React island or an Astro `<script>`) is JS, never an attribute, so it
// never appears in `dist/` as a swept literal. That is the exact blind-spot
// run 75 named: `ConnectForm.tsx`'s `/app?db=` CTA 307-redirected undetected
// while row #18 read "0 redirecting". Run 75 fixed one link by hand and
// deferred the guard; this automates the sweep so the next bare-path
// navigation fails CI instead of costing every clicker a redirect round-trip.
//
// Scope is deliberately narrow to avoid the false positives that sank the
// broad source-scan idea (route-matchers/prose/comments): we match ONLY the
// string-literal argument of an actual client navigation —
// `location.assign(...)`, `.replace(...)`, or `location.href = ...`, with or
// without a `window.` prefix (bare `location.assign` in an Astro `<script>`
// navigates just the same). Reads like `new URL(location.href)` lack the
// `= "literal"` / `("literal")` shape; comments, JSX `href=` attributes (swept
// by check-links), and route matchers never take it either — so none can trip.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const WEB_SRC = join(REPO_ROOT, "apps", "web", "src");

function sweepFiles(dir: string, ext: RegExp, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sweepFiles(p, ext, acc);
    else if (ext.test(name) && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

// `location.assign("…")` | `.replace("…")` | `location.href = "…"` (bare or
// `window.`/`document.`-prefixed — `\b` anchors the `location` token).
const NAV = /\blocation(?:\.href\s*=|\.(?:assign|replace)\s*\()\s*["'`]([^"'`]*)["'`]/g;

describe("client-nav trailing-slash integrity (SK-WEB-022)", () => {
  test("every client-side navigation to an internal page path ends in `/`", () => {
    // Maps the first offending bare path → the file:line it appears on, so a
    // failure names the redirect and where to fix it. A same-origin absolute
    // path (`/…`, not `//host`) whose path component (before `?`/`#`) lacks a
    // trailing slash 307-redirects under trailingSlash:"always". Root `/` and
    // `/auth/sign-in/?return_to=…` already end their path in `/` and pass.
    const offenders: Record<string, string> = {};
    for (const file of sweepFiles(WEB_SRC, /\.(ts|tsx|astro)$/)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(NAV)) {
        const url = m[1];
        if (!url.startsWith("/") || url.startsWith("//")) continue; // relative / cross-origin
        const path = url.split(/[?#]/)[0];
        if (path.endsWith("/")) continue;
        const line = src.slice(0, m.index).split("\n").length;
        offenders[url] ??= `${relative(REPO_ROOT, file)}:${line}`;
      }
    }
    expect(offenders).toEqual({});
  });
});
