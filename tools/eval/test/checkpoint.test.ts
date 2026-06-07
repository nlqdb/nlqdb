// SK-QUAL-011 — checkpoint round-trip: load → skip → append → complete.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendCheckpoint,
  checkpointKey,
  checkpointPath,
  completeCheckpoint,
  loadCheckpoint,
} from "../src/checkpoint.ts";
import type { QuestionResult } from "../src/types.ts";

function row(question_id: number, lane: QuestionResult["lane"]): QuestionResult {
  return {
    question_id,
    db_id: "pets",
    lane,
    outcome: "match",
    predicted_sql: "SELECT 1",
    model: "m",
    latency_ms: 5,
  };
}

describe("SK-QUAL-011 — checkpoint", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-cp-"));
    path = checkpointPath(dir, "bird-mini-dev-sqlite");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("a missing file loads as an empty checkpoint", async () => {
    const cp = await loadCheckpoint(path);
    expect(cp.done.size).toBe(0);
    expect(cp.results).toEqual([]);
  });

  it("round-trips appended rows: load reports them done and replays them", async () => {
    await appendCheckpoint(path, row(0, "free"));
    await appendCheckpoint(path, row(0, "frontier"));
    await appendCheckpoint(path, row(1, "free"));

    const cp = await loadCheckpoint(path);
    expect(cp.results).toHaveLength(3);
    expect(cp.done.has(checkpointKey(0, "free"))).toBe(true);
    expect(cp.done.has(checkpointKey(0, "frontier"))).toBe(true);
    expect(cp.done.has(checkpointKey(1, "free"))).toBe(true);
    // A pair that was never appended is not done.
    expect(cp.done.has(checkpointKey(1, "frontier"))).toBe(false);
  });

  it("tolerates a torn final line (crash mid-write) — keeps the parseable rows", async () => {
    await appendCheckpoint(path, row(0, "free"));
    // Simulate a half-written final line by appending raw bytes with no newline.
    await Bun.write(path, `${await Bun.file(path).text()}{"question_id":1,"la`);

    const cp = await loadCheckpoint(path);
    // The torn line is dropped; the intact row survives.
    expect(cp.results).toHaveLength(1);
    expect(cp.done.has(checkpointKey(0, "free"))).toBe(true);
  });

  it("completeCheckpoint removes the file and is idempotent", async () => {
    await appendCheckpoint(path, row(0, "free"));
    expect(existsSync(path)).toBe(true);
    await completeCheckpoint(path);
    expect(existsSync(path)).toBe(false);
    // A second call on a missing file must not throw (force).
    await completeCheckpoint(path);
    expect(existsSync(path)).toBe(false);
  });
});
