#!/usr/bin/env node
// Rewrites every `export const PACKAGE_VERSION = "…"` under `packages/*/src`
// to its own manifest's version, so `changeset version` can't leave a source
// constant behind. `@nlqdb/mcp` hand-maintains one (a JSON import isn't
// portable across the Node/Bun/Workers runtimes it loads in) and pins it with a
// test — without this step the first bump after un-gating opens a red Version
// PR. Runs from `changeset:version`, beside `bun install --lockfile-only`:
// same job, different derived file.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), "..", "packages");
const DECLARATION = /(export const PACKAGE_VERSION = ")[^"]*(")/;

for (const pkg of readdirSync(PACKAGES)) {
  let version;
  try {
    version = JSON.parse(readFileSync(join(PACKAGES, pkg, "package.json"), "utf8")).version;
  } catch {
    continue; // no npm manifest here (Swift/Ruby/Rust SDKs)
  }
  const src = join(PACKAGES, pkg, "src");
  let entries;
  try {
    entries = readdirSync(src, { recursive: true });
  } catch {
    continue;
  }
  for (const entry of entries) {
    const file = join(src, entry);
    if (!file.endsWith(".ts")) continue;
    const before = readFileSync(file, "utf8");
    const after = before.replace(DECLARATION, `$1${version}$2`);
    if (after === before) continue;
    writeFileSync(file, after);
    process.stdout.write(`sync-source-versions: ${pkg} → PACKAGE_VERSION ${version}\n`);
  }
}
