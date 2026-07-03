import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { GoldTable } from "../src/csv.ts";
import {
  _testing,
  compareMultiPandasTable,
  comparePandasTable,
  hasOrderBy,
  normaliseConditionCols,
  scoreOne,
  scoreOneSpider2,
} from "../src/score.ts";

const { canonicalize, rowsMatch, normalizeSql, vectorsMatch, cellsEqual, rowsToColumnMajor } =
  _testing;

describe("canonicalize", () => {
  it("treats null and undefined the same", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(undefined)).toBe("null");
  });

  it("emits stable form for objects regardless of key order", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it("normalises a bigint cell to its numeric form (no JSON.stringify throw)", () => {
    expect(canonicalize(7n)).toBe(canonicalize(7));
    expect(canonicalize([7n])).toBe(canonicalize([7]));
  });

  it("encodes Uint8Array via base64 so blob rows compare", () => {
    const a = canonicalize(new Uint8Array([1, 2, 3]));
    const b = canonicalize(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a.startsWith("b64:")).toBe(true);
  });
});

describe("rowsMatch", () => {
  const A = { id: 1, name: "alice" };
  const B = { id: 2, name: "bob" };

  it("unordered: multiset match regardless of order", () => {
    expect(rowsMatch([A, B], [B, A], false)).toBe(true);
  });

  it("ordered: sequence-strict", () => {
    expect(rowsMatch([A, B], [B, A], true)).toBe(false);
    expect(rowsMatch([A, B], [A, B], true)).toBe(true);
  });

  it("rejects when row counts differ", () => {
    expect(rowsMatch([A], [A, A], false)).toBe(false);
  });

  it("respects duplicates in multiset comparison", () => {
    expect(rowsMatch([A, A, B], [A, B, B], false)).toBe(false);
    expect(rowsMatch([A, A, B], [A, B, A], false)).toBe(true);
  });
});

describe("hasOrderBy", () => {
  it("matches case-insensitive word boundaries", () => {
    expect(hasOrderBy("SELECT 1 ORDER BY id")).toBe(true);
    expect(hasOrderBy("select * from t order  by name desc")).toBe(true);
  });

  it("ignores 'orderby' as a single identifier", () => {
    expect(hasOrderBy("SELECT orderby FROM t")).toBe(false);
  });
});

describe("normalizeSql", () => {
  it("strips trailing semicolons and whitespace", () => {
    expect(normalizeSql("SELECT 1; \n")).toBe("SELECT 1");
  });

  it("removes leading line comments", () => {
    expect(normalizeSql("-- gold\nSELECT 1")).toBe("SELECT 1");
  });
});

describe("scoreOne — against an on-disk SQLite fixture", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-eval-"));
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

  it("scores match when both queries return the same multiset", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT name FROM pet WHERE species='cat'",
      predictedSql: "SELECT name FROM pet WHERE species = 'cat'",
    });
    expect(r.outcome).toBe("match");
  });

  // SK-QUAL-010 — canonical BIRD compares positional tuples (`set(fetchall())`),
  // so a different output alias / function-name casing on identical values must
  // still match. The pre-fix name-keyed comparison false-mismatched these.
  it("ignores output column aliases (positional-tuple parity with canonical BIRD)", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT COUNT(*) FROM pet WHERE species='cat'",
      predictedSql: "SELECT count(*) AS cat_total FROM pet WHERE species = 'cat'",
    });
    expect(r.outcome).toBe("match");
  });

  // Positional comparison also correctly *rejects* a column swap that the
  // name-keyed form would have spuriously accepted — values are position-bound.
  it("rejects a swapped column order (positional, not name-keyed)", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT id, species FROM pet WHERE id = 1",
      predictedSql: "SELECT species, id FROM pet WHERE id = 1",
    });
    expect(r.outcome).toBe("mismatch");
  });

  it("scores mismatch when the predicted set differs", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT name FROM pet WHERE species='cat'",
      predictedSql: "SELECT name FROM pet",
    });
    expect(r.outcome).toBe("mismatch");
  });

  it("scores exec_error when predicted SQL is broken", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT 1",
      predictedSql: "SELECT FROM",
    });
    expect(r.outcome).toBe("exec_error");
    expect(r.error).toBeTruthy();
  });

  it("scores gold_error when gold SQL itself is broken", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT FROM nope",
      predictedSql: "SELECT 1",
    });
    expect(r.outcome).toBe("gold_error");
  });

  it("scores no_sql when predicted SQL is empty", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT 1",
      predictedSql: "",
    });
    expect(r.outcome).toBe("no_sql");
  });

  it("respects ORDER BY in gold (sequence-strict)", async () => {
    const gold = "SELECT name FROM pet ORDER BY id DESC";
    const r = await scoreOne({
      dbPath,
      goldSql: gold,
      predictedSql: "SELECT name FROM pet ORDER BY id ASC",
    });
    expect(r.outcome).toBe("mismatch");
  });

  // SK-QUAL-021 — a runaway predicted query (unbounded recursive CTE here;
  // a cartesian join over BIRD's larger fixtures in the field) must come
  // back as a scored exec_error at the deadline, never hang the runner:
  // in-process bun:sqlite is synchronous and uninterruptible, which froze
  // four consecutive 45-min smoke windows with a flat checkpoint.
  it("kills a runaway predicted query at the deadline and scores exec_error", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT 1",
      predictedSql:
        "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT count(*) FROM c",
      timeoutMs: 300,
    });
    expect(r.outcome).toBe("exec_error");
    expect(r.error).toContain("SK-QUAL-021");
  });

  it("kills a runaway gold query at the deadline and scores gold_error", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql:
        "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT count(*) FROM c",
      predictedSql: "SELECT 1",
      timeoutMs: 300,
    });
    expect(r.outcome).toBe("gold_error");
  });

  it("round-trips blob and bigint cells through the exec subprocess", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT CAST('abc' AS BLOB), 9007199254740991",
      predictedSql: "SELECT CAST('abc' AS BLOB), 9007199254740991",
    });
    expect(r.outcome).toBe("match");
  });
});

// SK-QUAL-008 — canonical pandas-comparator port. Tests verify the three
// invariants that must not drift from upstream (`evaluation_suite/evaluate_utils.py`):
// numeric tolerance = 1e-2, ignore_order sorts on (null, str, is-numeric),
// and `condition_cols` restricts gold but never restricts the prediction.
describe("cellsEqual", () => {
  it("treats null and undefined as equivalent NaN sentinels", () => {
    expect(cellsEqual(null, null)).toBe(true);
    expect(cellsEqual(null, undefined)).toBe(true);
  });

  it("applies the 1e-2 absolute tolerance on numeric pairs", () => {
    expect(cellsEqual(1.005, 1.0)).toBe(true);
    expect(cellsEqual(1.02, 1.0)).toBe(false);
    expect(cellsEqual(100, 100.005)).toBe(true);
  });

  it("treats a number and its string representation as a mismatch (pandas dtype-divergence rule)", () => {
    expect(cellsEqual(5, "5")).toBe(false);
  });

  it("uses string equality otherwise", () => {
    expect(cellsEqual("abc", "abc")).toBe(true);
    expect(cellsEqual("abc", "abd")).toBe(false);
  });
});

describe("vectorsMatch", () => {
  it("sequence-strict when ignoreOrder=false", () => {
    expect(vectorsMatch([1, 2, 3], [1, 2, 3], false)).toBe(true);
    expect(vectorsMatch([1, 2, 3], [3, 2, 1], false)).toBe(false);
  });

  it("ignores order when ignoreOrder=true", () => {
    expect(vectorsMatch([1, 2, 3], [3, 2, 1], true)).toBe(true);
  });

  it("returns false when lengths differ even under ignoreOrder", () => {
    expect(vectorsMatch([1, 2], [1, 2, 3], true)).toBe(false);
  });

  it("uses the (null, str, is-numeric) sort key — numeric 5 and string '5' end adjacent but unequal under cellsEqual", () => {
    // Predicted as string "5" should NOT match gold as number 5 even with sort.
    expect(vectorsMatch([5, 5], ["5", "5"], true)).toBe(false);
  });

  it("respects null in sorted multisets without crashing on the comparator", () => {
    expect(vectorsMatch([null, 1, 2], [2, 1, null], true)).toBe(true);
  });
});

// SK-QUAL-010 — positional transpose preserves duplicate-named columns that
// a name-keyed object would have collapsed.
describe("rowsToColumnMajor", () => {
  it("transposes positional rows into column vectors", () => {
    expect(
      rowsToColumnMajor([
        ["a", 1],
        ["b", 2],
      ]),
    ).toEqual([
      ["a", "b"],
      [1, 2],
    ]);
  });

  it("keeps two same-named predicted columns distinct (would collapse as object keys)", () => {
    // `SELECT name, name` yields two positional columns; an object keyed by
    // name would drop one. bigint normalises to number; null passes through.
    expect(
      rowsToColumnMajor([
        ["x", "x"],
        [null, 7n],
      ]),
    ).toEqual([
      ["x", null],
      ["x", 7],
    ]);
  });

  it("returns [] for an empty result set", () => {
    expect(rowsToColumnMajor([])).toEqual([]);
  });
});

describe("comparePandasTable", () => {
  it("matches when every gold column finds any matching pred column", () => {
    const pred = [
      [1, 2, 3],
      ["a", "b", "c"],
    ];
    const gold = [["a", "b", "c"]];
    expect(comparePandasTable(pred, gold, [], true)).toBe(true);
  });

  it("mismatches when a gold column has no matching pred column", () => {
    const pred = [[1, 2, 3]];
    const gold = [["a", "b", "c"]];
    expect(comparePandasTable(pred, gold, [], true)).toBe(false);
  });

  it("restricts gold to condition_cols, leaves pred unrestricted", () => {
    const pred = [
      ["x", "y", "z"],
      [1, 2, 3],
    ];
    // Gold has 3 cols; only col 1 must find a pred match.
    const gold = [
      ["a", "b", "c"],
      ["x", "y", "z"],
      [99, 99, 99],
    ];
    expect(comparePandasTable(pred, gold, [1], true)).toBe(true);
    // Col 0 must match — it shouldn't.
    expect(comparePandasTable(pred, gold, [0], true)).toBe(false);
  });

  it("returns false when condition_cols points past the last gold column", () => {
    expect(comparePandasTable([], [["a"]], [5], true)).toBe(false);
  });
});

describe("normaliseConditionCols", () => {
  it("broadcasts a flat number[] across multiple golds", () => {
    expect(normaliseConditionCols([1, 2], 3)).toEqual([
      [1, 2],
      [1, 2],
      [1, 2],
    ]);
  });

  it("passes a per-gold number[][] through verbatim", () => {
    expect(normaliseConditionCols([[1], [2], [3]], 3)).toEqual([[1], [2], [3]]);
  });

  it("treats empty list as no restriction on any gold", () => {
    expect(normaliseConditionCols([], 2)).toEqual([[], []]);
  });

  it("treats [[]] as no restriction on any gold (canonical Python edge case)", () => {
    expect(normaliseConditionCols([[]], 2)).toEqual([[], []]);
  });

  it("treats null/undefined as no restriction", () => {
    expect(normaliseConditionCols(null, 2)).toEqual([[], []]);
    expect(normaliseConditionCols(undefined, 2)).toEqual([[], []]);
  });

  it("passes a single-gold flat list verbatim (no broadcast when goldCount=1)", () => {
    expect(normaliseConditionCols([0], 1)).toEqual([[0]]);
  });
});

describe("compareMultiPandasTable", () => {
  const goldA: GoldTable = { columns: ["x"], cells: [["a", "b"]] };
  const goldB: GoldTable = { columns: ["x"], cells: [["a", "z"]] };

  it("returns match when prediction matches any of the multi-gold tables", () => {
    const pred = [["b", "a"]];
    expect(compareMultiPandasTable(pred, [goldA, goldB], [], true)).toBe(true);
  });

  it("returns mismatch when prediction matches none of the multi-gold tables", () => {
    const pred = [["q", "r"]];
    expect(compareMultiPandasTable(pred, [goldA, goldB], [], true)).toBe(false);
  });

  it("applies per-gold condition_cols when provided as number[][]", () => {
    // Two golds, both have two columns. Pred has only one column that matches gold col 0 of gold A.
    const gA: GoldTable = {
      columns: ["x", "y"],
      cells: [
        ["a", "b"],
        [1, 2],
      ],
    };
    const gB: GoldTable = {
      columns: ["x", "y"],
      cells: [
        ["q", "r"],
        [3, 4],
      ],
    };
    const pred = [["b", "a"]];
    // Force gA to check col 1 only (numeric → mismatch with pred string col).
    // Force gB to check col 0 only (string "q","r" — mismatch).
    expect(compareMultiPandasTable(pred, [gA, gB], [[1], [0]], true)).toBe(false);
    // Now check gA col 0 (matches) — should win regardless of gB.
    expect(compareMultiPandasTable(pred, [gA, gB], [[0], [1]], true)).toBe(true);
  });

  it("returns false when goldTables is empty (canonical: nothing to match against)", () => {
    expect(compareMultiPandasTable([["a"]], [], [], true)).toBe(false);
  });
});

describe("scoreOneSpider2 — execution + multi-CSV scoring", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-spider2score-"));
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

  it("scores match when predicted SELECT yields a column matching the gold CSV", async () => {
    const gold: GoldTable = { columns: ["name"], cells: [["whisk", "milo"]] };
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "SELECT name FROM pet WHERE species='cat'",
      goldTables: [gold],
      conditionCols: [],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("match");
  });

  it("scores mismatch when no pred column matches", async () => {
    const gold: GoldTable = { columns: ["name"], cells: [["nope"]] };
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "SELECT name FROM pet",
      goldTables: [gold],
      conditionCols: [],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("mismatch");
  });

  it("scores match when prediction has extra columns alongside the matching one", async () => {
    const gold: GoldTable = { columns: ["name"], cells: [["whisk", "milo"]] };
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "SELECT id, name, species FROM pet WHERE species='cat'",
      goldTables: [gold],
      conditionCols: [],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("match");
  });

  it("uses condition_cols to restrict gold (broadcast across multi-gold)", async () => {
    // Gold has two columns; condition_cols restricts to col 0 only.
    const gold: GoldTable = {
      columns: ["name", "id"],
      cells: [
        ["whisk", "milo"],
        [1, 3],
      ],
    };
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "SELECT name FROM pet WHERE species='cat'",
      goldTables: [gold],
      conditionCols: [0],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("match");
  });

  it("scores exec_error on broken predicted SQL", async () => {
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "SELECT FROM",
      goldTables: [{ columns: ["x"], cells: [[1]] }],
      conditionCols: [],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("exec_error");
    expect(r.error).toBeTruthy();
  });

  it("scores no_sql when predicted SQL is empty", async () => {
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "",
      goldTables: [{ columns: ["x"], cells: [[1]] }],
      conditionCols: [],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("no_sql");
  });

  it("scores gold_error when no gold tables are provided (defensive guard)", async () => {
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "SELECT 1",
      goldTables: [],
      conditionCols: [],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("gold_error");
  });

  it("uses tolerance on numeric columns (matches Spider 2.0's 1e-2 abs_tol)", async () => {
    // Predicted query yields 3 (count), gold has 3.005 — should still match.
    const gold: GoldTable = { columns: ["c"], cells: [[3.005]] };
    const r = await scoreOneSpider2({
      dbPath,
      predictedSql: "SELECT COUNT(*) AS c FROM pet",
      goldTables: [gold],
      conditionCols: [],
      ignoreOrder: true,
    });
    expect(r.outcome).toBe("match");
  });
});
