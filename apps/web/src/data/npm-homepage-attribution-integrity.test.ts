import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// SK-GTM-007 — npm is a *live* acquisition channel only because every
// published `@nlqdb/*` package's `homepage` is the bare marketing host tagged
// `?utm_source=npm`: that is the "Homepage" link npmjs renders, and its
// click-throughs are the only npm→product signal `captureFirstTouch` can
// attribute (npmjs sends no useful referrer). The tag was added one file at a
// time (package.json run 99) and has drifted before — the companion
// `readme-attribution-integrity` guard's own comment flags exactly this
// pattern, yet it only sweeps markdown `](…)` links and never sees a JSON
// `homepage` field, so the npm side stayed unguarded. This closes that hole:
// derive the published set from the package manifests themselves (never a
// hand-typed list, so a new published package can't slip through) and assert
// each carries the marketing homepage with its ledger key. A published package
// that deliberately points `homepage` elsewhere is a channel decision — it
// updates this guard, it doesn't silently drop npm attribution.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

// The bare marketing host tagged with the npm ledger key. Subdomains
// (docs./elements./mcp./app.) are internal to captureFirstTouch and can't
// acquire a first touch, so only the bare host counts (attribution.ts).
const EXPECTED_HOMEPAGE = "https://nlqdb.com/?utm_source=npm";

// Every workspace package manifest. `private: true` is npm's own "never
// publish" flag, so those never render a Homepage link — the wrappers are all
// private today (only @nlqdb/sdk + @nlqdb/cli publish).
function publishedManifests(): { name: string; homepage?: string; file: string }[] {
  const pkgDir = join(REPO_ROOT, "packages");
  const out: { name: string; homepage?: string; file: string }[] = [];
  for (const name of readdirSync(pkgDir)) {
    const file = join(pkgDir, name, "package.json");
    let json: { name?: string; private?: boolean; homepage?: string };
    try {
      json = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue; // no manifest in this dir
    }
    if (json.private === true) continue;
    out.push({ name: json.name ?? name, homepage: json.homepage, file });
  }
  return out;
}

describe("npm homepage acquisition-attribution integrity (SK-GTM-007)", () => {
  test("every published @nlqdb package's homepage is the marketing host tagged utm_source=npm", () => {
    const published = publishedManifests();
    // Guard the guard: if this ever finds nothing, the sweep broke — npm
    // attribution would look green while measuring an empty set.
    expect(published.length).toBeGreaterThan(0);

    // Maps an offending package name → what it declared and where, so a
    // failure names the untagged manifest and the exact fix.
    const offenders: Record<string, string> = {};
    for (const pkg of published) {
      if (pkg.homepage === EXPECTED_HOMEPAGE) continue;
      offenders[pkg.name] = `${relative(REPO_ROOT, pkg.file)} → homepage=${pkg.homepage ?? "(missing)"}`;
    }
    expect(offenders).toEqual({});
  });
});
