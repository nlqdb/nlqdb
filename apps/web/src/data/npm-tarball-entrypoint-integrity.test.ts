import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — plain .mjs helper, no type declarations.
import {
  BACKUP_SUFFIX,
  effectivePublishedManifest,
} from "../../../../scripts/apply-publish-config.mjs";

// A published package whose entrypoints are not inside its own `files` allowlist
// is dead on arrival, and nothing in a normal build says so — `@nlqdb/sdk` 0.1.0
// → 0.2.1 all published `main` → `./src/index.ts` while `files` shipped only
// `dist/`, so `import "@nlqdb/sdk"` threw ERR_MODULE_NOT_FOUND on every version
// while build, typecheck, test and the release job stayed green. The full root
// cause is in `scripts/apply-publish-config.mjs`, whose transform this imports
// rather than reimplements. Reachability, not existence: `dist/` is absent from
// a fresh clone, so this asserts each entrypoint *would* be packed.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "apply-publish-config.mjs");

// npm packs these regardless of `files`, so an entrypoint pointing at one is
// still reachable. (`package.json` matters: it is the manifest itself.)
const ALWAYS_PACKED = [
  /^package\.json$/,
  /^readme(\.|$)/i,
  /^licen[cs]e(\.|$)/i,
  /^changelog(\.|$)/i,
];

type Manifest = {
  name?: string;
  private?: boolean;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  browser?: unknown;
  bin?: unknown;
  exports?: unknown;
  files?: string[];
  publishConfig?: Record<string, unknown>;
};

/** `./dist/index.js` and `dist/index.js` are the same tarball path. */
function normalize(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Every relative file path the manifest points a consumer at. */
function entrypoints(manifest: Manifest): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      // Bare package names in an `exports` target (rare, but legal) are not
      // file paths — only relative specifiers are packed from this tarball.
      if (value.startsWith(".")) found.push(normalize(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  for (const field of [manifest.main, manifest.module, manifest.types, manifest.typings]) {
    if (typeof field === "string") found.push(normalize(field));
  }
  walk(manifest.browser);
  walk(manifest.bin);
  walk(manifest.exports);
  return [...new Set(found)];
}

/** Would npm pack `path`, given this `files` allowlist? */
function isPacked(path: string, files: string[] | undefined): boolean {
  if (ALWAYS_PACKED.some((re) => re.test(path))) return true;
  // No `files` at all means "pack everything not ignored" — can't be the defect.
  if (files === undefined) return true;
  return files.some((entry) => {
    const pattern = normalize(entry).replace(/\/$/, "");
    if (path === pattern || path.startsWith(`${pattern}/`)) return true;
    if (!pattern.includes("*")) return false;
    const re = new RegExp(
      "^" +
        pattern
          .split("**")
          .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
          .join(".*") +
        "(/|$)",
    );
    return re.test(path);
  });
}

/** Manifests npm would actually publish — `private: true` is npm's own gate. */
function publishableManifests(): { manifest: Manifest; file: string }[] {
  const out: { manifest: Manifest; file: string }[] = [];
  for (const dir of readdirSync(join(REPO_ROOT, "packages"))) {
    const file = join(REPO_ROOT, "packages", dir, "package.json");
    let manifest: Manifest;
    try {
      manifest = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue; // no manifest in this dir (Swift/Ruby/Rust SDKs)
    }
    if (manifest.private === true) continue;
    out.push({ manifest, file });
  }
  return out;
}

describe("npm tarball entrypoint integrity (GLOBAL-001)", () => {
  test("every publishable package's entrypoints are inside its own files allowlist", () => {
    const publishable = publishableManifests();
    // Guard the guard: an empty sweep would report green while measuring nothing.
    expect(publishable.length).toBeGreaterThan(0);

    // package name → the unreachable entrypoints and where they were declared,
    // so a failure names the file and the exact paths to fix.
    const offenders: Record<string, string> = {};
    let checked = 0;
    for (const { manifest, file } of publishable) {
      const published = effectivePublishedManifest(manifest) as Manifest;
      const declared = entrypoints(published);
      checked += declared.length;
      const unreachable = declared.filter((p) => !isPacked(p, published.files));
      if (unreachable.length === 0) continue;
      offenders[manifest.name ?? file] =
        `${relative(REPO_ROOT, file)} → ${unreachable.join(", ")} not matched by files=[${(published.files ?? []).join(", ")}]`;
    }
    expect(offenders).toEqual({});
    // Every publishable package declares at least one entrypoint; zero would
    // mean `entrypoints()` stopped reading the fields it claims to read.
    expect(checked).toBeGreaterThanOrEqual(publishable.length);
  });

  test("publishConfig carries no field override npm would silently drop", () => {
    // npm honours only its own config keys here (npm/cli#7586). Anything else
    // is inert unless `prepack` applies it, so a package that declares field
    // overrides must wire up scripts/apply-publish-config.mjs — otherwise the
    // manifest documents an intent that never reaches the registry.
    const offenders: Record<string, string> = {};
    for (const { manifest, file } of publishableManifests()) {
      const overrides = Object.keys(manifest.publishConfig ?? {}).filter(
        (key) => !["access", "provenance", "registry", "tag"].includes(key),
      );
      if (overrides.length === 0) continue;
      const scripts = (manifest as { scripts?: Record<string, string> }).scripts ?? {};
      if (
        scripts.prepack?.includes("apply-publish-config") &&
        scripts.postpack?.includes("--restore")
      ) {
        continue;
      }
      offenders[manifest.name ?? file] =
        `${relative(REPO_ROOT, file)} overrides ${overrides.join(", ")} via publishConfig but has no apply-publish-config prepack/postpack pair`;
    }
    expect(offenders).toEqual({});
  });

  // The tests above assert the pure transform; this one runs the script the way
  // npm does, because a prepack that no-ops or a postpack that fails to restore
  // is the same class of green-build-ships-nothing defect one layer down.
  test("the prepack script applies at pack time and postpack restores byte-for-byte", () => {
    const dir = mkdtempSync(join(tmpdir(), "prepack-roundtrip-"));
    const manifestPath = join(dir, "package.json");
    const original = `${JSON.stringify(
      {
        name: "roundtrip-probe",
        version: "1.0.0",
        main: "./src/index.ts",
        files: ["dist"],
        publishConfig: { main: "./dist/index.js", access: "public" },
      },
      null,
      2,
    )}\n`;
    const run = (...args: string[]) => {
      const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: "utf8" });
      expect(r.status).toBe(0);
      return r;
    };
    const read = () => JSON.parse(readFileSync(manifestPath, "utf8"));
    const strays = () => readdirSync(dir).filter((f) => f !== "package.json");

    try {
      writeFileSync(manifestPath, original);

      run();
      expect(read().main).toBe("./dist/index.js");
      // `access` is npm's own key, so it must stay in publishConfig, not leak up.
      expect(read().access).toBeUndefined();

      // Re-running prepack after an interrupted pack must not overwrite the
      // backup with the already-rewritten manifest — that would lose the
      // source-resolving original permanently and break every in-repo consumer.
      run();
      run("--restore");
      expect(readFileSync(manifestPath, "utf8")).toBe(original);
      expect(strays()).toEqual([]);

      // postpack fires even when prepack changed nothing; that must be a no-op.
      run("--restore");
      expect(readFileSync(manifestPath, "utf8")).toBe(original);

      // The backup must carry a suffix npm ignores unconditionally, or a package
      // publishing without a `files` allowlist would ship it. `.orig` is on that
      // list — verified with `npm pack --dry-run`; re-verify before changing it.
      expect(BACKUP_SUFFIX).toBe(".orig");
      run();
      expect(strays()).toEqual([`package.json${BACKUP_SUFFIX}`]);
      run("--restore");
      expect(existsSync(join(dir, `package.json${BACKUP_SUFFIX}`))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
