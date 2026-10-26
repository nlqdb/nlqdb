import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// SK-GTM-012: the founder's only address in this public repo is
// `omer@nlqdb.com`. Retired addresses are stored as SHA-256 hashes so
// this guard never publishes what it guards. Add one with:
//   printf %s 'name@example.com' | shasum -a 256

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const RETIRED = new Set([
  "1de25277ebcb3e31ecd876d28681996fce8e6f12c8c7a57ca4077e5599f204c2",
  "930c79600ed329b8ed029ddae2b18849f08b367dad648d5f9f2cdcbd0b8cd00d",
  "a6cd5a4c6cd2e6298fe025ff54c7670690b43200aa783ff8ce9f4f8114510692",
]);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

describe("founder identity", () => {
  test("no retired founder address appears in a tracked file", () => {
    const res = spawnSync(
      "git",
      ["grep", "-I", "-o", "-h", "-E", "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]+", "--", "."],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    // git grep: 0 = matches found, 1 = none, anything else = git failed.
    if (res.status !== 0 && res.status !== 1) {
      throw new Error(`git grep failed (${res.status}): ${res.stderr}`);
    }
    const hits = res.stdout
      .split("\n")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => RETIRED.has(sha256(e)));
    expect(hits).toEqual([]);
  });
});
