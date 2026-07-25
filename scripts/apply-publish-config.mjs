#!/usr/bin/env node
// Applies `publishConfig`'s package.json *field* overrides into the manifest,
// because npm does not.
//
// Why this exists. Workspace packages expose TypeScript source
// (`main`/`exports` → `src/index.ts`): every in-workspace consumer resolves
// through Bun or Vite, both TS-aware, so source resolution is what makes
// `bun run test` see an SDK edit without a build step. A published tarball must
// instead point at built `dist/`. `publishConfig` looks like the answer and is
// how pnpm behaves — but **npm ignores every publishConfig key that is not one
// of its own config keys** (`access`, `provenance`, `registry`, `tag`);
// overriding `main`/`types`/`exports` from it is pnpm-only
// (https://github.com/npm/cli/issues/7586, still open 2026-07-25).
//
// That silently shipped a broken package: `@nlqdb/sdk` 0.1.0 → 0.2.1 all
// published `main`/`types`/`exports` → `./src/index.ts` while `files` shipped
// only `dist/`, so `import "@nlqdb/sdk"` threw ERR_MODULE_NOT_FOUND on every
// version ever released. Nothing failed at build time; the registry manifest is
// just derived from the tarball's package.json.
//
// So we run the override ourselves in `prepack`, npm's own hook for exactly
// this (npm/cli#7586's documented workaround), and undo it in `postpack`.
// `prepack` runs before the tarball is written, so the published manifest gets
// the overrides while the working tree keeps source resolution.
//
// Rejected: custom export conditions (the "live types in a monorepo" pattern).
// It is the tidier mechanism, but a condition only helps if every resolver opts
// in — that is `customConditions` in tsconfig.base.json plus `resolve.conditions`
// in six vitest/astro configs plus `--conditions` on every `bun` invocation.
// Same outcome, an order of magnitude more config to keep in sync (P5).
//
// `npm-tarball-entrypoint-integrity.test.ts` pins the transform below and fails
// if any publishable package's effective entrypoints fall outside its `files`.

import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// npm's *own* config keys inside publishConfig. Everything else is a
// package.json field override — pnpm's semantics, which we implement here.
const NPM_CONFIG_KEYS = new Set(["access", "provenance", "registry", "tag"]);

const BACKUP_SUFFIX = ".prepack-backup";

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
  const backupPath = manifestPath + BACKUP_SUFFIX;

  if (restore) {
    // postpack also fires when prepack made no change, so a missing backup is
    // the normal no-op — never an error.
    if (existsSync(backupPath)) renameSync(backupPath, manifestPath);
    return;
  }

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
  const applied = Object.keys(overrides).join(", ");
  process.stdout.write(`apply-publish-config: ${manifest.name} → applied ${applied}\n`);
}

// Only act when run as a script; the integrity guard imports the pure helpers.
if (process.argv[1]?.endsWith("apply-publish-config.mjs")) {
  try {
    main();
  } catch (err) {
    console.error(`apply-publish-config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

export { BACKUP_SUFFIX };
