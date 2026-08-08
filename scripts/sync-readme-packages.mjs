#!/usr/bin/env node
// Regenerates the "Packages on npm" table in the root README between the
// `<!-- BEGIN:packages -->` / `<!-- END:packages -->` markers. A package earns
// a row when its `package.json` is **not** `"private": true` — the exact gate
// `release-npm.yml` and changesets publish on, so the table lists whatever is
// live on npm and nothing that isn't. Version numbers are left to live
// shields.io badges, so the only thing that moves this file is a package
// un-gating (or its description changing) — both of which flow through the
// Version PR that runs `changeset:version`, beside `sync-source-versions.mjs`:
// same job, different derived file.
//
// Pass `--check` to fail (exit 1) instead of writing when the table is stale —
// the release job's guard against a forgotten regeneration.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = join(ROOT, "packages");
const README = join(ROOT, "README.md");
const BEGIN = "<!-- BEGIN:packages -->";
const END = "<!-- END:packages -->";

const rows = [];
for (const dir of readdirSync(PACKAGES).sort()) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(PACKAGES, dir, "package.json"), "utf8"));
  } catch {
    continue; // no npm manifest here (Swift/Ruby/Rust SDKs)
  }
  if (pkg.private === true || !pkg.name?.startsWith("@nlqdb/")) continue;
  const npm = `https://www.npmjs.com/package/${pkg.name}`;
  const badge = `https://img.shields.io/npm/v/${pkg.name}?label=npm&color=cb3837`;
  rows.push(
    `| [\`${pkg.name}\`](${npm}) | [![${pkg.name}](${badge})](${npm}) | ${pkg.description ?? ""} | [\`packages/${dir}\`](./packages/${dir}) |`,
  );
}

const table = [
  BEGIN,
  "| Package | Version | What it is | Source |",
  "|---|---|---|---|",
  ...rows,
  END,
].join("\n");

const before = readFileSync(README, "utf8");
const region = new RegExp(`${BEGIN}[\\s\\S]*?${END}`);
if (!region.test(before)) {
  process.stderr.write(`sync-readme-packages: markers ${BEGIN} … ${END} not found in README.md\n`);
  process.exit(1);
}
const after = before.replace(region, () => table); // function form: no `$` replacement patterns

if (after === before) {
  process.stdout.write("sync-readme-packages: README package table already in sync\n");
  process.exit(0);
}
if (process.argv.includes("--check")) {
  process.stderr.write(
    "sync-readme-packages: README package table is stale — run `node scripts/sync-readme-packages.mjs`\n",
  );
  process.exit(1);
}
writeFileSync(README, after);
process.stdout.write(
  `sync-readme-packages: rewrote README package table (${rows.length} packages)\n`,
);
