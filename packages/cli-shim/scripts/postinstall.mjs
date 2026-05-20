#!/usr/bin/env node
/**
 * Downloads the host-matching `nlq` binary from the GitHub Release pinned to
 * this package's version, verifies its sha256 against the release's
 * checksums.txt, and lands it at bin/nlq-bin. The CommonJS wrapper at
 * bin/nlq.cjs is the npm `bin` entry — it execs `nlq-bin` at runtime.
 *
 * Honored env:
 *   NLQDB_CLI_SKIP_DOWNLOAD=1   → skip download (CI / airgapped / `npm pack`)
 *   NLQDB_CLI_BINARY_URL=<url>  → fetch tarball from this URL (mirrors)
 *   NLQDB_CLI_CHECKSUMS_URL=<url> → matching checksums.txt URL (mirrors)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const OS_MAP = { darwin: "macOS", linux: "linux" };
export const ARCH_MAP = { x64: "x86_64", arm64: "arm64" };

export function archiveSuffix(platform = process.platform, arch = process.arch) {
  const os = OS_MAP[platform];
  const a = ARCH_MAP[arch];
  if (!os || !a) {
    const supported = "darwin/{x64,arm64}, linux/{x64,arm64}";
    throw new Error(
      `unsupported platform ${platform}/${arch} — supported: ${supported}. ` +
        "Build from source: https://github.com/nlqdb/nlqdb/tree/main/cli",
    );
  }
  return { os, arch: a };
}

export function buildUrls(
  version,
  env = process.env,
  platform = process.platform,
  arch = process.arch,
) {
  const { os, arch: a } = archiveSuffix(platform, arch);
  const archive = `nlq_${version}_${os}_${a}.tar.gz`;
  const base = `https://github.com/nlqdb/nlqdb/releases/download/v${version}`;
  return {
    archive,
    archiveUrl: env.NLQDB_CLI_BINARY_URL || `${base}/${archive}`,
    checksumsUrl: env.NLQDB_CLI_CHECKSUMS_URL || `${base}/checksums.txt`,
  };
}

export function parseChecksums(text, archiveName) {
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([0-9a-f]{64})\s+\*?(\S+)$/i);
    if (m && m[2] === archiveName) return m[1].toLowerCase();
  }
  return null;
}

export function shouldSkip(env = process.env, pkgDir = null) {
  if (env.NLQDB_CLI_SKIP_DOWNLOAD === "1") return "NLQDB_CLI_SKIP_DOWNLOAD=1";
  // npm sets npm_command=pack during `npm pack`; we don't bake the binary into
  // the published tarball, only into the user's local node_modules.
  if (env.npm_command === "pack") return "npm pack";
  if (pkgDir && inWorkspace(pkgDir)) return "monorepo workspace";
  return null;
}

// True when the package is being installed inside its own monorepo (the
// parent's parent has a `workspaces` field naming us). Inside the source
// monorepo there's no binary to fetch — devs `go build` cli/ directly.
export function inWorkspace(pkgDir) {
  try {
    const root = path.resolve(pkgDir, "..", "..");
    const rootPkgPath = path.join(root, "package.json");
    if (!existsSync(rootPkgPath)) return false;
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
    return Array.isArray(rootPkg.workspaces) || typeof rootPkg.workspaces === "object";
  } catch {
    return false;
  }
}

async function fetchBuffer(url, fetchImpl = fetch, attempt = 1) {
  const res = await fetchImpl(url, { redirect: "follow" });
  if (!res.ok) {
    if (res.status >= 500 && attempt < 4) {
      const delayMs = 2000 * 2 ** (attempt - 1);
      process.stderr.write(
        `@nlqdb/cli: HTTP ${res.status} — retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/4)\n`,
      );
      await sleep(delayMs);
      return fetchBuffer(url, fetchImpl, attempt + 1);
    }
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function fetchToFile(url, dest, fetchImpl = fetch, attempt = 1) {
  const res = await fetchImpl(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    if ((res.status >= 500 || !res.body) && attempt < 4) {
      const delayMs = 2000 * 2 ** (attempt - 1);
      process.stderr.write(
        `@nlqdb/cli: HTTP ${res.status} — retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/4)\n`,
      );
      await sleep(delayMs);
      return fetchToFile(url, dest, fetchImpl, attempt + 1);
    }
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const hash = createHash("sha256");
  const out = createWriteStream(dest);
  const reader = res.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    hash.update(value);
    if (!out.write(Buffer.from(value))) {
      await new Promise((resolve) => out.once("drain", resolve));
    }
  }
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  return hash.digest("hex");
}

function extractBinary(tarball, destDir) {
  // `tar` ships with macOS, every Linux distro, and Windows 10+. Extract one
  // entry to avoid leaking the archive's other contents (LICENSE, README).
  const res = spawnSync("tar", ["-xzf", tarball, "-C", destDir, "nlq"], { stdio: "pipe" });
  if (res.status !== 0) {
    throw new Error(`tar extract failed: ${res.stderr?.toString() || `exit ${res.status}`}`);
  }
}

export async function install({
  version,
  binPath,
  env = process.env,
  fetchImpl = fetch,
  platform = process.platform,
  arch = process.arch,
  logger = (msg) => process.stderr.write(`@nlqdb/cli: ${msg}\n`),
} = {}) {
  if (!version) throw new Error("install() needs an explicit version");
  if (!binPath) throw new Error("install() needs an explicit binPath");

  const skip = shouldSkip(env, path.dirname(path.dirname(binPath)));
  if (skip) {
    logger(`skipping download (${skip}) — run \`npm install\` again without it to fetch.`);
    return { status: "skipped", reason: skip };
  }

  if (existsSync(binPath) && statSync(binPath).size > 0) {
    logger(`binary already present at ${binPath} — skipping download.`);
    return { status: "already-installed" };
  }

  const binDir = path.dirname(binPath);
  mkdirSync(binDir, { recursive: true });
  const { archive, archiveUrl, checksumsUrl } = buildUrls(version, env, platform, arch);
  const tmp = await mkdtemp(path.join(tmpdir(), "nlqdb-cli-"));
  try {
    logger(`downloading ${archive} from ${archiveUrl}`);
    const tarPath = path.join(tmp, archive);
    const actualSha = await fetchToFile(archiveUrl, tarPath, fetchImpl);

    const checksumsText = (await fetchBuffer(checksumsUrl, fetchImpl)).toString("utf8");
    const expectedSha = parseChecksums(checksumsText, archive);
    if (!expectedSha) {
      throw new Error(`${archive} missing from checksums.txt at ${checksumsUrl}`);
    }
    if (actualSha !== expectedSha) {
      throw new Error(`sha256 mismatch: expected ${expectedSha}, got ${actualSha}`);
    }

    extractBinary(tarPath, tmp);
    const extracted = path.join(tmp, "nlq");
    if (!existsSync(extracted)) {
      throw new Error(`tar extracted but ${extracted} not found`);
    }
    // Atomic publish: write to .partial then rename, so a killed install never
    // leaves a half-written binary in place.
    const partial = `${binPath}.partial`;
    if (existsSync(partial)) unlinkSync(partial);
    copyFileSync(extracted, partial);
    chmodSync(partial, 0o755);
    renameSync(partial, binPath);
    logger(`installed nlq ${version} → ${binPath}`);
    return { status: "installed", binPath, sha: actualSha };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function pkgInfo() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgDir = path.resolve(here, "..");
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const binName = process.platform === "win32" ? "nlq-bin.exe" : "nlq-bin";
  return { version: pkg.version, binPath: path.join(pkgDir, "bin", binName) };
}

async function main() {
  try {
    const { version, binPath } = pkgInfo();
    await install({ version, binPath });
  } catch (err) {
    process.stderr.write(
      `@nlqdb/cli: ${err instanceof Error ? err.message : String(err)}\n` +
        "  Workaround: set NLQDB_CLI_SKIP_DOWNLOAD=1 and install the binary another way " +
        "(curl -fsSL https://nlqdb.com/install | sh, brew install nlqdb/tap/nlq, or build from source).\n",
    );
    process.exit(1);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();
