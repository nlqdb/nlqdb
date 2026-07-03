// Dead-link sweep over the built output (`dist/`). Run `astro build` first,
// then `bun run check:links` (or `node scripts/check-links.mjs`).
//
// Checks every internal href/src in built HTML, plus every URL advertised in
// sitemap.xml and llms.txt, against the dist file tree. With
// `trailingSlash: "always"` a bare internal path (`/foo`) is served as a 307
// to `/foo/` (see the run-69 lesson in docs/research/distribution-queue.md),
// so bare paths are reported as redirects — the sweep's hard failures are
// targets with no file at all.
//
// Exit code: 1 when any dead link exists, else 0.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;
const SITE = "https://nlqdb.com";

if (!existsSync(DIST)) {
  console.error("check-links: dist/ not found — run `astro build` first");
  process.exit(2);
}

const htmlFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".html")) htmlFiles.push(p);
  }
})(DIST);

// A target resolves when dist has the literal file, or `<path>/index.html`.
function resolves(path) {
  const clean = decodeURIComponent(path.split("#")[0].split("?")[0]);
  if (clean === "" || clean === "/") return true;
  const rel = clean.replace(/^\//, "").replace(/\/$/, "");
  return (
    existsSync(join(DIST, rel)) || existsSync(join(DIST, rel, "index.html"))
  );
}

function isInternal(url) {
  if (url.startsWith(SITE)) return true;
  if (/^(https?:|mailto:|tel:|data:|javascript:|#)/.test(url)) return false;
  return url.startsWith("/");
}

function toPath(url) {
  return url.startsWith(SITE) ? url.slice(SITE.length) || "/" : url;
}

const dead = [];
const redirects = [];
const seen = new Set();

function check(url, source, { deadOnly = false } = {}) {
  const path = toPath(url);
  const key = `${path} ← ${source}`;
  if (seen.has(key)) return;
  seen.add(key);
  const clean = path.split("#")[0].split("?")[0];
  if (!resolves(path)) {
    dead.push(key);
  } else if (
    !deadOnly &&
    !clean.endsWith("/") &&
    !/\.[a-z0-9]+$/i.test(clean) &&
    clean !== ""
  ) {
    redirects.push(key); // bare path: serves as a 307 to the slashed URL
  }
}

for (const file of htmlFiles) {
  const src = relative(DIST, file);
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (isInternal(url)) check(url, src);
  }
}

// llms.txt is dead-checked only: its body quotes URLs inside code snippets
// (e.g. the `curl https://nlqdb.com/install | sh` one-liner) where the bare
// short form is deliberate and curl -L follows the hop.
for (const [name, pattern, opts] of [
  ["sitemap.xml", /<loc>([^<]+)<\/loc>/g, {}],
  ["llms.txt", /https:\/\/nlqdb\.com[^\s)]*/g, { deadOnly: true }],
]) {
  const p = join(DIST, name);
  if (!existsSync(p)) {
    dead.push(`/${name} ← (missing from dist)`);
    continue;
  }
  for (const m of readFileSync(p, "utf8").matchAll(pattern)) {
    check(m[1] ?? m[0], name, opts);
  }
}

const links = seen.size;
console.log(
  `check-links: ${htmlFiles.length} pages, ${links} internal links — ${dead.length} dead, ${redirects.length} redirecting (bare path)`,
);
if (redirects.length) {
  console.log("\nRedirecting (link the trailing-slash URL instead):");
  for (const r of redirects.sort()) console.log(`  307 ${r}`);
}
if (dead.length) {
  console.log("\nDead:");
  for (const d of dead.sort()) console.log(`  404 ${d}`);
  process.exit(1);
}
