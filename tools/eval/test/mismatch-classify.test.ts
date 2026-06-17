import { describe, expect, it } from "bun:test";

import { _testing, classifyReport } from "../src/mismatch-classify.ts";

const { baseTables, classifyMismatch } = _testing;

describe("baseTables — quoted-identifier aware", () => {
  it("captures bare, double-quoted, backtick, and bracket table names", () => {
    const sql =
      'SELECT * FROM gasstations g JOIN "transactions_1k" t ON g.id=t.gid JOIN `products` p ON 1 JOIN [year month] y ON 1'.toUpperCase();
    expect(baseTables(sql)).toEqual(
      new Set(["GASSTATIONS", "TRANSACTIONS_1K", "PRODUCTS", "YEAR MONTH"]),
    );
  });

  it("does not treat a FROM-subquery as a table named SELECT", () => {
    const sql = "SELECT * FROM (SELECT id FROM t) x".toUpperCase();
    expect(baseTables(sql)).toEqual(new Set(["T"]));
  });
});

describe("classifyMismatch", () => {
  it("flags a missing join table as table_set (quoting must not false-positive)", () => {
    // Same two tables, one quoted on each side — must NOT read as table_set.
    const pred = 'SELECT c FROM gasstations g JOIN "transactions_1k" t ON 1';
    const gold = "SELECT c FROM gasstations g JOIN transactions_1k t ON 1";
    expect(classifyMismatch(pred, gold)).toEqual(["value_diff"]);
    // Gold needs a third table; predicted omits it ⇒ table_set.
    const gold3 = "SELECT c FROM gasstations g JOIN transactions_1k t ON 1 JOIN yearmonth y ON 1";
    expect(classifyMismatch(pred, gold3)).toContain("table_set");
  });

  it("flags aggregate, distinct, group_by, order_limit, and subquery axes", () => {
    expect(classifyMismatch("SELECT COUNT(*) FROM t", "SELECT SUM(x) FROM t")).toContain("agg_fn");
    expect(classifyMismatch("SELECT DISTINCT x FROM t", "SELECT x FROM t")).toContain("distinct");
    expect(classifyMismatch("SELECT x FROM t GROUP BY x", "SELECT x FROM t")).toContain("group_by");
    expect(
      classifyMismatch("SELECT x FROM t ORDER BY x LIMIT 1", "SELECT x FROM t"),
    ).toContain("order_limit");
    expect(
      classifyMismatch("SELECT x FROM t WHERE y IN (SELECT y FROM u)", "SELECT x FROM t"),
    ).toContain("subquery");
  });

  it("falls back to value_diff only when every structural axis agrees", () => {
    expect(classifyMismatch("SELECT x FROM t WHERE y='A'", "SELECT x FROM t WHERE y='B'")).toEqual([
      "value_diff",
    ]);
  });
});

describe("classifyReport", () => {
  it("counts only mismatch rows and tallies unclassified when gold is missing", () => {
    const results = [
      { question_id: 1, outcome: "match" as const, predicted_sql: "SELECT 1" },
      {
        question_id: 2,
        outcome: "mismatch" as const,
        predicted_sql: "SELECT x FROM t WHERE y='A'",
      },
      { question_id: 3, outcome: "mismatch" as const, predicted_sql: "SELECT COUNT(*) FROM t" },
      { question_id: 4, outcome: "mismatch" as const, predicted_sql: "" }, // no predicted SQL
    ];
    const gold = new Map<number, string>([
      [2, "SELECT x FROM t WHERE y='B'"],
      [3, "SELECT SUM(x) FROM t"],
    ]);
    const out = classifyReport(results, gold);
    expect(out.mismatch_total).toBe(3);
    expect(out.unclassified).toBe(1);
    expect(out.by_class.value_diff).toBe(1);
    expect(out.by_class.agg_fn).toBe(1);
  });
});
