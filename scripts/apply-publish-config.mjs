#!/usr/bin/env node
// Applies `publishConfig`'s package.json *field* overrides into the manifest at
// pack time, because npm does not.
//
// Workspace packages point `main`/`exports` at TypeScript source so every
// in-workspace consumer (Bun, Vite — both TS-aware) sees an edit with no build
// step; a published tarball must instead point at built `dist/`. `publishConfig`
// looks like the answer and is how pnpm behaves, but **npm honours only its own
// config keys there** (`access`, `provenance`, `registry`, `tag`) and silently
// drops field overrides (https://github.com/npm/cli/issues/7586, open
// 2026-07-25). That shipped `@nlqdb/sdk` 0.1.0 → 0.2.1 with `main` →
// `./src/index.ts` while `files` shipped only `dist/`, so `import "@nlqdb/sdk"`
// threw ERR_MODULE_NOT_FOUND on every version ever released — with nothing
// failing at build time, because the registry manifest is just the tarball's
// package.json.
//
// So apply the override ourselves in `prepack` (npm/cli#7586's documented
// workaround) and undo it in `postpack`: the tarball gets `dist/`, the working
// tree keeps source resolution. Rejected alternative — custom export conditions
// — needs every resolver to opt in (`customConditions`, six `resolve.conditions`
// blocks, `--conditions` on every `bun` call) for the same outcome (P5).
//
// `npm-tarball-entrypoint-integrity.test.ts` pins both the transform and this
// script's apply/restore round trip.

import {
  copyFileSync,
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// npm's *own* config keys inside publishConfig. Everything else is a
// package.json field override — pnpm's semantics, which we implement here.
const NPM_CONFIG_KEYS = new Set(["access", "provenance", "registry", "tag"]);

// `._*` is on npm's unconditional ignore list, so the backup can never reach a
// tarball even from a package that publishes without a `files` allowlist. Also
// a name nothing else writes, so its presence always means *our* interrupted
// pack — `*.orig` is equally unpackable but is what `git mergetool` and
// `patch` leave behind, and restoring a stranger's copy overwrites the manifest.
const BACKUP_FILE = "._package.json.prepack";

/**
 * Splits a `publishConfig` block into the npm config keys npm honours itself
 * and the manifest-field overrides it silently drops.
 * @param {Record<string, unknown> | undefined} publishConfig
 * @returns {Record<string, unknown>} field overrides only
 */
export function manifestOverrides(publishConfig) {
  const out = /** @type {Record<string, unknown>} */ ({});
  for (const [key, value] of Object.entries(publishConfig ?? {})) {
    if (!NPM_CONFIG_KEYS.has(key)) out[key] = value;
  }
  return out;
}

/**
 * The manifest npm *would* publish if it honoured publishConfig — i.e. what
 * `prepack` writes. Pure, so the integrity guard can assert on it without
 * packing anything.
 * @template {Record<string, unknown>} T
 * @param {T} manifest
 * @returns {T}
 */
export function effectivePublishedManifest(manifest) {
  return { ...manifest, ...manifestOverrides(manifest.publishConfig) };
}

function main() {
  const restore = process.argv.includes("--restore");
  const manifestPath = join(process.cwd(), "package.json");
  const backupPath = join(process.cwd(), BACKUP_FILE);

  // A backup on disk means an earlier pack was interrupted before `postpack`,
  // so the manifest in place is the rewritten one and the backup is the only
  // copy of the source-resolving original. Restoring first makes both paths
  // idempotent; backing up over it would destroy that original for good.
  if (existsSync(backupPath)) renameSync(backupPath, manifestPath);
  if (restore) return;

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const overrides = manifestOverrides(manifest.publishConfig);
  if (Object.keys(overrides).length === 0) return;

  // Back up first: if the write below dies, postpack still restores.
  copyFileSync(manifestPath, backupPath);
  try {
    writeFileSync(
      manifestPath,
      `${JSON.stringify(effectivePublishedManifest(manifest), null, 2)}\n`,
    );
  } catch (err) {
    renameSync(backupPath, manifestPath);
    throw err;
  }
  process.stdout.write(
    `apply-publish-config: ${manifest.name} → applied ${Object.keys(overrides).join(", ")}\n`,
  );
}

// Act only when invoked as the script — the integrity guard imports the pure
// helpers. Compared by real path, not filename, so neither renaming this file
// nor reaching it through a symlink (`argv[1]` keeps the link, `import.meta`
// resolves it) can turn `prepack` into a no-op that ships a broken tarball.
if (process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename) {
  try {
    main();
  } catch (err) {
    console.error(`apply-publish-config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export { BACKUP_FILE };
