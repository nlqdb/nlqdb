// Direct-import tests of the postinstall helpers + install(). We don't spawn
// child processes — the sandboxed CI runner blocks child→parent loopback —
// so the I/O is exercised via an in-process server with same-process fetch.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";
import {
  archiveSuffix,
  buildUrls,
  install,
  inWorkspace,
  parseChecksums,
  shouldSkip,
} from "./postinstall.mjs";

test("archiveSuffix maps every supported platform/arch", () => {
  assert.deepEqual(archiveSuffix("darwin", "x64"), { os: "macOS", arch: "x86_64" });
  assert.deepEqual(archiveSuffix("darwin", "arm64"), { os: "macOS", arch: "arm64" });
  assert.deepEqual(archiveSuffix("linux", "x64"), { os: "linux", arch: "x86_64" });
  assert.deepEqual(archiveSuffix("linux", "arm64"), { os: "linux", arch: "arm64" });
});

test("archiveSuffix throws on unsupported targets", () => {
  assert.throws(() => archiveSuffix("win32", "x64"), /unsupported platform/);
  assert.throws(() => archiveSuffix("linux", "ia32"), /unsupported platform/);
});

test("buildUrls uses GitHub by default and respects env overrides", () => {
  const def = buildUrls("0.3.2", {}, "linux", "arm64");
  assert.equal(def.archive, "nlq_0.3.2_linux_arm64.tar.gz");
  assert.equal(
    def.archiveUrl,
    "https://github.com/nlqdb/nlqdb/releases/download/v0.3.2/nlq_0.3.2_linux_arm64.tar.gz",
  );
  assert.equal(
    def.checksumsUrl,
    "https://github.com/nlqdb/nlqdb/releases/download/v0.3.2/checksums.txt",
  );

  const over = buildUrls(
    "0.3.2",
    { NLQDB_CLI_BINARY_URL: "http://m/a.tgz", NLQDB_CLI_CHECKSUMS_URL: "http://m/c.txt" },
    "linux",
    "arm64",
  );
  assert.equal(over.archiveUrl, "http://m/a.tgz");
  assert.equal(over.checksumsUrl, "http://m/c.txt");
});

test("parseChecksums extracts the matching line, ignoring others", () => {
  const txt = [
    "abc123  other-file.tar.gz",
    "DEADBEEF1234567890abcdef1234567890abcdef1234567890abcdef12345678  nlq_0.1.0_linux_x86_64.tar.gz",
    "0000  unrelated",
  ].join("\n");
  assert.equal(
    parseChecksums(txt, "nlq_0.1.0_linux_x86_64.tar.gz"),
    "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
  );
  assert.equal(parseChecksums(txt, "missing.tar.gz"), null);
});

test("parseChecksums tolerates BSD `*` binary-mode prefix", () => {
  // BSD-style sha tool emits `<sha>  *file` (asterisk on binary mode).
  const sha = "aa".repeat(32);
  const txt = `${sha}  *nlq_1.0.0_macOS_arm64.tar.gz`;
  assert.equal(parseChecksums(txt, "nlq_1.0.0_macOS_arm64.tar.gz"), sha);
});

test("shouldSkip detects all opt-outs", () => {
  assert.equal(shouldSkip({ NLQDB_CLI_SKIP_DOWNLOAD: "1" }), "NLQDB_CLI_SKIP_DOWNLOAD=1");
  assert.equal(shouldSkip({ npm_command: "pack" }), "npm pack");
  assert.equal(shouldSkip({}), null);
});

test("inWorkspace returns true when grandparent package.json declares workspaces", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "nlq-shim-ws-"));
  try {
    const pkgDir = path.join(tmp, "packages", "cli-shim");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
    );
    assert.equal(inWorkspace(pkgDir), true);
    assert.equal(shouldSkip({}, pkgDir), "monorepo workspace");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("inWorkspace returns false outside a workspace (normal `npm i -g` install)", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "nlq-shim-nows-"));
  try {
    // Mimic node_modules layout: pkgDir = <prefix>/lib/node_modules/@nlqdb/cli.
    // The grandparent has no package.json with workspaces.
    const pkgDir = path.join(tmp, "lib", "node_modules", "@nlqdb", "cli");
    mkdirSync(pkgDir, { recursive: true });
    assert.equal(inWorkspace(pkgDir), false);
    assert.equal(shouldSkip({}, pkgDir), null);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// Direct-import e2e: install() is exercised against a localhost HTTP server in
// the SAME process — so the sandboxed child-process loopback restriction
// doesn't apply.
async function withFixture(sha, archive, tarBytes, run) {
  const server = createServer((req, res) => {
    if (req.url === "/archive") {
      res.setHeader("content-type", "application/gzip");
      res.end(tarBytes);
    } else if (req.url === "/checksums") {
      res.setHeader("content-type", "text/plain");
      res.end(`${sha}  ${archive}\n`);
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const tmp = await mkdtemp(path.join(tmpdir(), "nlq-shim-it-"));
  try {
    await run({ tmp, port });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(tmp, { recursive: true, force: true });
  }
}

function makeTarball(dir, body = "#!/bin/sh\necho 'fake-nlq invoked'\n") {
  writeFileSync(path.join(dir, "nlq"), body);
  chmodSync(path.join(dir, "nlq"), 0o755);
  const tar = path.join(dir, "nlq-fixture.tar.gz");
  const res = spawnSync("tar", ["-czf", tar, "-C", dir, "nlq"]);
  if (res.status !== 0) throw new Error(`tar create: ${res.stderr}`);
  return tar;
}

test("install() downloads, verifies sha, extracts, and chmods +x", async () => {
  const fix = await mkdtemp(path.join(tmpdir(), "nlq-shim-tar-"));
  const tar = makeTarball(fix);
  const tarBytes = await readFile(tar);
  const sha = createHash("sha256").update(tarBytes).digest("hex");
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const { archive } = buildUrls("9.9.9", {}, platform, arch);

  try {
    await withFixture(sha, archive, tarBytes, async ({ tmp, port }) => {
      const binPath = path.join(tmp, "bin", "nlq-bin");
      const result = await install({
        version: "9.9.9",
        binPath,
        env: {
          NLQDB_CLI_BINARY_URL: `http://127.0.0.1:${port}/archive`,
          NLQDB_CLI_CHECKSUMS_URL: `http://127.0.0.1:${port}/checksums`,
        },
        platform,
        arch,
        logger: () => {},
      });
      assert.equal(result.status, "installed");
      assert.equal(result.sha, sha);
      assert.ok(existsSync(binPath), `expected binary at ${binPath}`);
      assert.equal(statSync(binPath).mode & 0o111, 0o111, "binary should be executable");
      const run = spawnSync(binPath, [], { encoding: "utf8" });
      assert.match(run.stdout, /fake-nlq invoked/);
    });
  } finally {
    await rm(fix, { recursive: true, force: true });
  }
});

test("install() refuses sha256 mismatch and leaves no binary", async () => {
  const fix = await mkdtemp(path.join(tmpdir(), "nlq-shim-bad-"));
  const tar = makeTarball(fix);
  const tarBytes = await readFile(tar);
  const fakeSha = "f".repeat(64);
  const platform = "linux";
  const arch = "x64";
  const { archive } = buildUrls("9.9.9", {}, platform, arch);

  try {
    await withFixture(fakeSha, archive, tarBytes, async ({ tmp, port }) => {
      const binPath = path.join(tmp, "bin", "nlq-bin");
      await assert.rejects(
        install({
          version: "9.9.9",
          binPath,
          env: {
            NLQDB_CLI_BINARY_URL: `http://127.0.0.1:${port}/archive`,
            NLQDB_CLI_CHECKSUMS_URL: `http://127.0.0.1:${port}/checksums`,
          },
          platform,
          arch,
          logger: () => {},
        }),
        /sha256 mismatch/,
      );
      assert.ok(!existsSync(binPath), "no binary should be left on disk after mismatch");
    });
  } finally {
    await rm(fix, { recursive: true, force: true });
  }
});

test("install() is idempotent when the binary is already present", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "nlq-shim-idem-"));
  try {
    const binPath = path.join(tmp, "bin", "nlq-bin");
    mkdirSync(path.dirname(binPath), { recursive: true });
    writeFileSync(binPath, "preinstalled");
    let fetched = false;
    const result = await install({
      version: "9.9.9",
      binPath,
      env: {},
      fetchImpl: async () => {
        fetched = true;
        throw new Error("should not fetch");
      },
      platform: "linux",
      arch: "x64",
      logger: () => {},
    });
    assert.equal(result.status, "already-installed");
    assert.equal(fetched, false, "should not have hit the network");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("install() skips when NLQDB_CLI_SKIP_DOWNLOAD=1 and never writes a binary", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "nlq-shim-skip-"));
  try {
    const binPath = path.join(tmp, "bin", "nlq-bin");
    const result = await install({
      version: "9.9.9",
      binPath,
      env: { NLQDB_CLI_SKIP_DOWNLOAD: "1" },
      platform: "linux",
      arch: "x64",
      logger: () => {},
    });
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "NLQDB_CLI_SKIP_DOWNLOAD=1");
    assert.ok(!existsSync(binPath));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("wrapper exits with a helpful message when binary is missing", () => {
  // The wrapper is just a few lines; exercising it via spawnSync is fine
  // because it doesn't open a network socket — the sandbox restriction only
  // affects child→parent loopback, not Node→file-system + exit.
  const wrapper = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "bin",
    "nlq.cjs",
  );
  const res = spawnSync(process.execPath, [wrapper, "--version"], { encoding: "utf8" });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /binary missing/);
});
