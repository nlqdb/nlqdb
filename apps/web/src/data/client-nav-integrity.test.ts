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
// navigates just the same). Reads like `new URL(location.href)` and route
// matchers lack the `= "literal"` / `("literal")` shape, so none trip. The one
// thing that would is a comment literally spelling out the call — which is why
// the sweep skips `.test.ts` files, where (as here) that shape gets documented.
// Navs built via `new URL("/path", origin)` → `location.replace(...)` carry the
// slash by convention/review, not here — matching them would false-positive on
// asset (`/og.png`) and API (`/v1/…`) URLs that legitimately carry no slash.
//
// The second test guards the same trailing-slash class for static
// `<a href="/literal">` links. SK-WEB-022 originally left these to
// `check-links.mjs` — but that sweep runs on built output and is NOT wired into
// CI (only a manual/daily build invokes it), so a bare-path legal cross-link
// (`href="/terms"` in `privacy.astro`) 307-redirected undetected for two days
// until a daily sweep caught it (row #18). A static-literal href carries no
// dynamic segment, so a source scan for `href="/path"` (no trailing slash, no
// dotted final segment = asset) is false-positive-free — the same narrowness
// that makes the nav sweep safe. Dynamic `href={…}` (no string literal) and
// asset/API paths (dotted / `//host`) never match.

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
// `window.`/`document.`-prefixed — `\b` anchors the `location` token). The
// optional `\w+\(` hop keeps the literal in scope when the target is wrapped
// in a helper — `location.assign(attachHandoff("/app/new/"))` still gets its
// trailing slash swept.
const NAV =
  /\blocation(?:\.href\s*=|\.(?:assign|replace)\s*\()\s*(?:\w+\(\s*)?["'`]([^"'`]*)["'`]/g;

// `href="/literal"` / `action='/literal'` — a static internal target. `href={…}`
// (dynamic) has no leading quote and never matches. A bare `<form action>`
// 307-redirects exactly like a bare `<a href>`, so both belong here.
const HREF = /\b(?:href|action)=["'](\/[^"'`]*)["']/g;

// SK-ANON-015 — the two halves the handoff sweep below keys on (non-global so
// `.test` carries no `lastIndex` state).
//
// Half one: the file holds prompt state that a cross-origin hop would drop.
// `importHandoffFromLocation` counts because a *receiver* that forwards onward
// — `auth/sign-in.astro`, which imports the payload then hops to the app-origin
// copy of itself — drops the payload just as completely without re-attaching
// it, and persists nothing of its own to trip the `save*` shapes.
const TOUCHES_PROMPT = /\b(?:saveDraft|makeDraftSaver|savePending|importHandoffFromLocation)\(/;
// Half two: any client-side navigation. Deliberately wider than
// `location.assign` — `window.open`, a bare `location = "…"`, `el.href = "/…"`,
// and a `<meta http-equiv="refresh">` all leave the origin just as effectively.
// `assign`/`replace` are matched on the *member*, not the call, so an aliased
// or `.bind`-ed reference (`const go = location.assign.bind(location)`) can't
// duck the sweep; neither member is ever read for anything but navigating.
const NAVIGATES =
  /\blocation\s*=\s*["'`]|\blocation\.(?:href\s*=|assign\b|replace\b)|\bwindow\.open\s*\(|\.href\s*=\s*["'`]\/|http-equiv=["']refresh/;

// Surfaces that only ever render on the app origin, where there is nothing to
// carry across.
const APP_ORIGIN_ONLY = [join("src", "pages", "app"), join("src", "components", "chat")];

// A same-origin absolute path (`/…`, not `//host`) whose path component (before
// `?`/`#`) lacks a trailing slash redirects under trailingSlash:"always".
// A dotted final segment (`/og.png`, `/rss.xml`) is a real asset that carries
// no slash — skip it, not a redirect. Returns the offending `url` or null.
function trailingSlashOffender(url: string): string | null {
  if (!url.startsWith("/") || url.startsWith("//")) return null; // relative / cross-origin
  const path = url.split(/[?#]/)[0];
  if (path.endsWith("/")) return null;
  if (path.split("/").pop()?.includes(".")) return null; // asset, not a page
  return url;
}

describe("client-nav trailing-slash integrity (SK-WEB-022)", () => {
  test("every client-side navigation to an internal page path ends in `/`", () => {
    // Maps the first offending bare path → the file:line it appears on, so a
    // failure names the redirect and where to fix it. Root `/` and
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

  test("every prompt-persisting surface that navigates carries the SK-ANON-015 handoff", () => {
    // `/app/*` 301s to `app.nlqdb.com` (SK-AUTH-016), a different browser
    // origin — so a surface that stashes the visitor's goal and then navigates
    // there hands off nothing: localStorage does not cross. That is how the
    // `/solve`, `/vs` and `/agents` "Try this query" CTAs came to drop every
    // prompt on the floor while each file still read correctly in isolation.
    // The carrier is `attachHandoff` (`#nlq=`).
    //
    // The trigger is *any* prompt-state idiom and *any* navigation, not
    // `saveDraft` + a literal `/app/` target: `CreateForm.tsx` — the original
    // cross-origin sender — persists via `makeDraftSaver`/`savePending` and
    // hops to a server-supplied absolute `signInUrl`, so the narrow shapes
    // would leave it unguarded.
    //
    // Static analysis can't see everything. Probed and confirmed still
    // slipping: a target computed at runtime (`<a href={expr}>`); a split
    // across two files (goal saved in A, link rendered — or `location.assign`
    // called — in B); a `location` object held in a local (`const l =
    // location; l.href = target`); and a file where SOME navigations carry the
    // handoff, since one `attachHandoff(` clears the whole file. The `/solve` +
    // `/vs` stranger walkers are the browser-level backstop — they assert the
    // goal reaches the create input, whatever the mechanism.
    const offenders: Record<string, string> = {};
    for (const file of sweepFiles(WEB_SRC, /\.(ts|tsx|astro)$/)) {
      const rel = relative(REPO_ROOT, file);
      if (APP_ORIGIN_ONLY.some((dir) => rel.includes(dir))) continue;
      const src = readFileSync(file, "utf8");
      if (!TOUCHES_PROMPT.test(src)) continue;
      const navigates =
        NAVIGATES.test(src) || [...src.matchAll(HREF)].some((m) => m[1].startsWith("/app/"));
      if (navigates && !src.includes("attachHandoff(")) {
        offenders[rel] = "holds prompt state then navigates without attachHandoff";
      }
    }
    expect(offenders).toEqual({});
  });

  test("every static `<a href>` to an internal page path ends in `/`", () => {
    // The href half of the same class — the blind spot that let `href="/terms"`
    // 307-redirect for two days because check-links.mjs isn't in CI.
    const offenders: Record<string, string> = {};
    for (const file of sweepFiles(WEB_SRC, /\.(ts|tsx|astro)$/)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(HREF)) {
        const offender = trailingSlashOffender(m[1]);
        if (!offender) continue;
        const line = src.slice(0, m.index).split("\n").length;
        offenders[offender] ??= `${relative(REPO_ROOT, file)}:${line}`;
      }
    }
    expect(offenders).toEqual({});
  });
});
