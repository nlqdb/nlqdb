import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeRows, fingerprintRows } from "../src/score.ts";
import {
  majorityVote,
  type SampledPlan,
  type VoteCandidate,
  voteOverSamples,
} from "../src/self-consistency.ts";

const rows = (...r: unknown[][]): unknown[][] => r;

describe("fingerprintRows", () => {
  it("is order-insensitive by default (multiset)", () => {
    const a = fingerprintRows(rows([1, "a"], [2, "b"]), false);
    const b = fingerprintRows(rows([2, "b"], [1, "a"]), false);
    expect(a).toBe(b);
  });

  it("is sequence-strict when ordered", () => {
    const a = fingerprintRows(rows([1], [2]), true);
    const b = fingerprintRows(rows([2], [1]), true);
    expect(a).not.toBe(b);
  });

  it("separates the empty result set from a single empty-tuple row", () => {
    expect(fingerprintRows([], false)).not.toBe(fingerprintRows(rows([]), false));
  });

  it("distinguishes different multisets", () => {
    expect(fingerprintRows(rows([1]), false)).not.toBe(fingerprintRows(rows([2]), false));
  });
});

describe("majorityVote", () => {
  it("returns the unanimous answer with agreement 1", () => {
    const r = rows([42]);
    const res = majorityVote([
      { sql: "a", rows: r },
      { sql: "b", rows: r },
      { sql: "c", rows: r },
    ]);
    expect(res.sql).toBe("a");
    expect(res.clusterSize).toBe(3);
    expect(res.executable).toBe(3);
    expect(res.agreement).toBe(1);
  });

  it("picks the modal answer even when it is not first", () => {
    const res = majorityVote([
      { sql: "minority", rows: rows([1]) },
      { sql: "majority-1", rows: rows([2]) },
      { sql: "majority-2", rows: rows([2]) },
    ]);
    expect(res.sql).toBe("majority-1"); // earliest member of the winning cluster
    expect(res.index).toBe(1);
    expect(res.clusterSize).toBe(2);
    expect(res.agreement).toBe(0.6667);
  });

  it("breaks a tie toward the cluster with the earliest candidate", () => {
    const res = majorityVote([
      { sql: "first", rows: rows([1]) },
      { sql: "second", rows: rows([2]) },
    ]);
    expect(res.sql).toBe("first");
    expect(res.clusterSize).toBe(1);
  });

  it("clusters by the answer, not the SQL string", () => {
    // Two distinct queries returning the same rows out-vote the third.
    const res = majorityVote([
      { sql: "SELECT a", rows: rows([1], [2]) },
      { sql: "SELECT a ORDER BY a", rows: rows([2], [1]) },
      { sql: "SELECT b", rows: rows([9]) },
    ]);
    expect(res.clusterSize).toBe(2);
    expect(res.index).toBe(0);
  });

  it("ignores candidates that failed to execute", () => {
    const res = majorityVote([
      { sql: "bad", rows: null },
      { sql: "good", rows: rows([7]) },
      { sql: "bad2", rows: null },
    ]);
    expect(res.sql).toBe("good");
    expect(res.executable).toBe(1);
    expect(res.agreement).toBe(1);
  });

  it("returns an empty winner when nothing executed", () => {
    const res = majorityVote([
      { sql: "x", rows: null },
      { sql: "y", rows: null },
    ]);
    expect(res).toEqual({ sql: "", index: -1, clusterSize: 0, executable: 0, agreement: 0 });
  });

  it("treats an empty result set as a valid, votable answer", () => {
    const empty: VoteCandidate = { sql: "SELECT WHERE false", rows: [] };
    const res = majorityVote([empty, { sql: "other", rows: rows([1]) }, empty]);
    expect(res.clusterSize).toBe(2);
    expect(res.sql).toBe("SELECT WHERE false");
  });

  it("respects the ordered flag when clustering", () => {
    const candidates: VoteCandidate[] = [
      { sql: "p", rows: rows([1], [2]) },
      { sql: "q", rows: rows([2], [1]) },
    ];
    // Unordered: same multiset → one cluster of 2.
    expect(majorityVote(candidates, { ordered: false }).clusterSize).toBe(2);
    // Ordered: different sequence → tie, earliest wins with cluster size 1.
    const ordered = majorityVote(candidates, { ordered: true });
    expect(ordered.clusterSize).toBe(1);
    expect(ordered.sql).toBe("p");
  });
});

describe("voteOverSamples (offline — injected executor)", () => {
  // Maps each SQL string to the rows it "executes" to, so the orchestration is
  // exercised without a DB. `null` ⇒ that SQL failed to execute.
  const exec =
    (table: Record<string, unknown[][] | null>) =>
    async (sql: string): Promise<unknown[][] | null> =>
      table[sql] ?? null;

  it("executes each sample, votes the modal answer, and reports its model", async () => {
    const samples: SampledPlan[] = [
      { sql: "minority", model: "m-a" },
      { sql: "majority-1", model: "m-b" },
      { sql: "majority-2", model: "m-c" },
    ];
    const res = await voteOverSamples(
      samples,
      exec({ minority: rows([1]), "majority-1": rows([2]), "majority-2": rows([2]) }),
    );
    expect(res.sql).toBe("majority-1"); // earliest member of the winning cluster
    expect(res.model).toBe("m-b");
    expect(res.clusterSize).toBe(2);
    expect(res.samples).toBe(3);
    expect(res.agreement).toBe(0.6667);
  });

  it("clusters equivalent answers across distinct SQL into consensus", async () => {
    const samples: SampledPlan[] = [
      { sql: "SELECT a", model: "m1" },
      { sql: "SELECT a ORDER BY a", model: "m2" },
      { sql: "SELECT b", model: "m3" },
    ];
    // First two return the same multiset out of order → one cluster of 2.
    const res = await voteOverSamples(
      samples,
      exec({
        "SELECT a": rows([1], [2]),
        "SELECT a ORDER BY a": rows([2], [1]),
        "SELECT b": rows([9]),
      }),
    );
    expect(res.clusterSize).toBe(2);
    expect(res.sql).toBe("SELECT a");
  });

  it("never queries for empty SQL and drops failed candidates from the vote", async () => {
    let calls = 0;
    const counting = async (sql: string): Promise<unknown[][] | null> => {
      calls++;
      return sql === "good" ? rows([7]) : null;
    };
    const res = await voteOverSamples(
      [
        { sql: "", model: "empty" },
        { sql: "bad", model: "x" },
        { sql: "good", model: "g" },
      ],
      counting,
    );
    // Empty SQL short-circuits before the executor — only the two non-empty
    // SQLs hit it.
    expect(calls).toBe(2);
    expect(res.sql).toBe("good");
    expect(res.model).toBe("g");
    expect(res.executable).toBe(1);
    expect(res.samples).toBe(3);
  });

  it("returns an empty winner when nothing executed", async () => {
    const res = await voteOverSamples(
      [
        { sql: "x", model: "a" },
        { sql: "y", model: "b" },
      ],
      async () => null,
    );
    expect(res.sql).toBe("");
    expect(res.model).toBe("");
    expect(res.index).toBe(-1);
    expect(res.samples).toBe(2);
  });
});

describe("executeRows + voteOverSamples — end-to-end against a real SQLite fixture", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-selfconsistency-"));
    dbPath = join(dir, "fixture.sqlite");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE pet (id INTEGER PRIMARY KEY, name TEXT, species TEXT);");
    db.exec(
      "INSERT INTO pet (id, name, species) VALUES (1,'whisk','cat'),(2,'rex','dog'),(3,'milo','cat');",
    );
    db.close();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("executeRows returns positional tuples for valid SQL", async () => {
    const r = await executeRows(dbPath, "SELECT name FROM pet WHERE species='cat' ORDER BY id");
    expect(r).toEqual([["whisk"], ["milo"]]);
  });

  it("executeRows returns null for broken SQL and for empty SQL", async () => {
    expect(await executeRows(dbPath, "SELECT FROM")).toBeNull();
    expect(await executeRows(dbPath, "  ")).toBeNull();
  });

  it("votes two semantically-equivalent SQLs over a wrong third on real rows", async () => {
    const samples: SampledPlan[] = [
      // Same answer, different phrasing (equality vs IN) → cluster together.
      { sql: "SELECT name FROM pet WHERE species = 'cat'", model: "m1" },
      { sql: "SELECT name FROM pet WHERE species IN ('cat')", model: "m2" },
      // Wrong answer (all pets) → loses the vote.
      { sql: "SELECT name FROM pet", model: "m3" },
    ];
    const res = await voteOverSamples(samples, (sql) => executeRows(dbPath, sql));
    expect(res.clusterSize).toBe(2);
    expect(res.executable).toBe(3);
    expect(res.index).toBe(0);
    expect(res.agreement).toBe(0.6667);
  });
});
