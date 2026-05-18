import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _testing, loadBirdMini } from "../../src/datasets/bird-mini.ts";

const { parseQuestions } = _testing;

const SAMPLE = [
  {
    question_id: 0,
    db_id: "pets",
    question: "How many cats?",
    evidence: "species column distinguishes cats vs dogs",
    SQL: "SELECT COUNT(*) FROM pet WHERE species='cat'",
    difficulty: "simple",
  },
  {
    question_id: 1,
    db_id: "pets",
    question: "Newest pet name",
    SQL: "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
  },
];

describe("parseQuestions", () => {
  it("accepts both `SQL` and `sql` keys", () => {
    const out = parseQuestions([
      { db_id: "x", question: "q", SQL: "select 1" },
      { db_id: "y", question: "q2", sql: "select 2" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.sql).toBe("select 1");
    expect(out[1]?.sql).toBe("select 2");
  });

  it("rejects entries missing required fields", () => {
    expect(() => parseQuestions([{ question: "q", SQL: "select 1" }])).toThrow(/missing required/);
    expect(() => parseQuestions([{ db_id: "x", SQL: "select 1" }])).toThrow(/missing required/);
    expect(() => parseQuestions([{ db_id: "x", question: "q" }])).toThrow(/missing required/);
  });

  it("normalises difficulty to the typed enum or undefined", () => {
    const out = parseQuestions([
      { db_id: "x", question: "q", SQL: "s", difficulty: "weird" },
      { db_id: "x", question: "q", SQL: "s", difficulty: "moderate" },
    ]);
    expect(out[0]?.difficulty).toBeUndefined();
    expect(out[1]?.difficulty).toBe("moderate");
  });

  it("fills missing question_id with the array index", () => {
    const out = parseQuestions([
      { db_id: "x", question: "q1", SQL: "s" },
      { db_id: "x", question: "q2", SQL: "s" },
    ]);
    expect(out[0]?.question_id).toBe(0);
    expect(out[1]?.question_id).toBe(1);
  });
});

describe("loadBirdMini — file mode", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-bird-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads questions from a local JSON file", async () => {
    const p = join(dir, "questions.json");
    writeFileSync(p, JSON.stringify(SAMPLE));
    const out = await loadBirdMini({ questionsJsonPath: p });
    expect(out.questions).toHaveLength(2);
    expect(out.questions[0]?.db_id).toBe("pets");
  });

  it("applies limit deterministically", async () => {
    const p = join(dir, "questions.json");
    writeFileSync(p, JSON.stringify(SAMPLE));
    const out = await loadBirdMini({ questionsJsonPath: p, limit: 1 });
    expect(out.questions).toHaveLength(1);
    expect(out.questions[0]?.question_id).toBe(0);
  });

  it("returns null from resolveDbPath when dataDir is absent", async () => {
    const p = join(dir, "questions.json");
    writeFileSync(p, JSON.stringify(SAMPLE));
    const out = await loadBirdMini({ questionsJsonPath: p });
    expect(await out.resolveDbPath("pets")).toBeNull();
  });

  it("returns null from resolveDbPath when fixture missing on disk", async () => {
    const p = join(dir, "questions.json");
    writeFileSync(p, JSON.stringify(SAMPLE));
    const out = await loadBirdMini({ questionsJsonPath: p, dataDir: dir });
    expect(await out.resolveDbPath("pets")).toBeNull();
  });
});
