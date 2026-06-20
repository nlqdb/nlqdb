import { describe, expect, it } from "bun:test";

import { fingerprintRows } from "../src/score.ts";
import { majorityVote, type VoteCandidate } from "../src/self-consistency.ts";

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
