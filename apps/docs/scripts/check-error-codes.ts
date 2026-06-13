#!/usr/bin/env bun
// WS06-T4 drift guard. The error-code table in reference/http-api.mdx is
// hand-written (it carries editorial columns — meaning, retryable,
// recovery — a generator can't author). This check keeps it in lockstep
// with the canonical `ApiErrorCode` union in packages/sdk/src/index.ts:
// it fails the docs build (wired into the `gen` script) if the table is
// missing a union member or lists a stale one. deploy-docs.yml watches
// packages/sdk/**, so a union change re-triggers the build and this guard.

import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "../../..");
const SDK_ENTRY = join(REPO_ROOT, "packages/sdk/src/index.ts");
const MDX = join(REPO_ROOT, "apps/docs/src/content/docs/reference/http-api.mdx");

// Pull the body of `export type ApiErrorCode = … ;` and collect every
// double-quoted string-literal member. Comments are stripped first so a
// quoted word in a `//` note (e.g. "Cancel") isn't mistaken for a member;
// the open-ended `(string & {})` tail has no literal, so it's skipped.
function unionCodes(): Set<string> {
  const src = readFileSync(SDK_ENTRY, "utf8");
  const m = src.match(/export type ApiErrorCode\s*=([\s\S]*?);/);
  if (!m) {
    console.error("✗ check-error-codes: could not locate `export type ApiErrorCode` in the SDK");
    process.exit(1);
  }
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return new Set([...body.matchAll(/"([A-Za-z0-9_]+)"/g)].map((x) => x[1]));
}

// Codes the doc table documents: the first cell of each row, `| `code` |`.
function tableCodes(): Set<string> {
  const doc = readFileSync(MDX, "utf8");
  return new Set([...doc.matchAll(/^\|\s*`([A-Za-z0-9_]+)`\s*\|/gm)].map((x) => x[1]));
}

const union = unionCodes();
const table = tableCodes();
const missing = [...union].filter((c) => !table.has(c)).sort();
const stale = [...table].filter((c) => !union.has(c)).sort();

if (missing.length || stale.length) {
  console.error(
    `✗ check-error-codes: ${relative(REPO_ROOT, MDX)} is out of sync with ApiErrorCode`,
  );
  if (missing.length) console.error(`  missing from the table: ${missing.join(", ")}`);
  if (stale.length) console.error(`  stale in the table (not in the union): ${stale.join(", ")}`);
  console.error("  Update the Error codes table in reference/http-api.mdx to match the SDK union.");
  process.exit(1);
}

console.info(`✓ Error codes: ${union.size} ApiErrorCode members all documented`);
