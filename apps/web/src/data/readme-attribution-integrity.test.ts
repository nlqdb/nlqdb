import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// SK-GTM-007 — every externally published, browser-navigable nlqdb URL must
// carry its ledger `utm_source`, or the acquiring channel's yield can't be
// read on `/app/admin`. GitHub-rendered READMEs (repo root + `examples/`) are
// the developer-eval surface, and GitHub strips the referrer on external
// README links — so an untagged product CTA there lands as `direct`, never
// `github` (proven by run 101, which had to tag the root README's CTA for
// exactly this reason). The rule was being applied one file at a time (npm
// package.json run 99, root README run 101, examples run 110) and drifting;
// this guard derives truth from the markdown itself so the next example can't
// ship an untagged CTA. Only the *bare* marketing host is browser-navigable
// from a click — `docs.`/`elements.`/`mcp.`/`app.` subdomains are internal to
// captureFirstTouch (attribution.ts `isInternalHost`) and don't match.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

// GitHub-rendered README surfaces: the repo root README + every `examples/`
// README. (Package READMEs published to registries other than npm are Phase-2
// placeholders — added here when they ship real content.)
function githubReadmes(): string[] {
  const out = [join(REPO_ROOT, "README.md")];
  const examples = join(REPO_ROOT, "examples");
  const sweep = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) sweep(p);
      else if (name === "README.md") out.push(p);
    }
  };
  sweep(examples);
  return out;
}

// The other rendered-README surface: npmjs.com renders a published package's
// README as its package page, so its CTAs acquire through the `npm` key, not
// `github`. Derived from the manifests (`private: true` is npm's own gate) so
// the next un-gated package can't ship an untagged CTA.
function npmReadmes(): string[] {
  const pkgDir = join(REPO_ROOT, "packages");
  const out: string[] = [];
  for (const name of readdirSync(pkgDir)) {
    let manifest: { private?: boolean };
    try {
      manifest = JSON.parse(readFileSync(join(pkgDir, name, "package.json"), "utf8"));
    } catch {
      continue; // no npm manifest here (Swift/Ruby/Rust SDKs)
    }
    const readme = join(pkgDir, name, "README.md");
    if (manifest.private !== true && existsSync(readme)) out.push(readme);
  }
  return out;
}

// A markdown link `](href)` whose href is the bare marketing host. The capture
// is the path+query+hash after the host — a `curl … https://nlqdb.com/install`
// bare URL (no `](`) never matches, so install commands are excluded for free.
const MARKETING_LINK = /\]\(https?:\/\/(?:www\.)?nlqdb\.com(\/[^)\s]*)?\)/g;

// Non-acquisition paths a click can't "acquire" through: the legal footer.
// A utm on `/privacy` would be noise, not a channel signal.
const EXEMPT_PREFIXES = ["/privacy", "/terms"];

/** Maps each untagged href → `file:line`, so a failure names the exact fix. */
function untagged(files: string[], key: string): Record<string, string> {
  const offenders: Record<string, string> = {};
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(MARKETING_LINK)) {
      const pathQuery = m[1] ?? "/";
      const path = pathQuery.split(/[?#]/)[0];
      if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) continue;
      if (pathQuery.includes(`utm_source=${key}`)) continue;
      const href = m[0].slice(2, -1); // strip the `](` … `)`
      const line = src.slice(0, m.index).split("\n").length;
      offenders[href] ??= `${relative(REPO_ROOT, file)}:${line}`;
    }
  }
  return offenders;
}

describe("README acquisition-attribution integrity (SK-GTM-007)", () => {
  test("every GitHub-rendered product CTA to the marketing host carries utm_source=github", () => {
    expect(untagged(githubReadmes(), "github")).toEqual({});
  });

  test("every published package README's CTA to the marketing host carries utm_source=npm", () => {
    const files = npmReadmes();
    // Guard the guard: an empty sweep would report green while measuring nothing.
    expect(files.length).toBeGreaterThan(0);
    expect(untagged(files, "npm")).toEqual({});
  });
});
