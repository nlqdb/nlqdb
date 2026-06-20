import { describe, expect, it } from "bun:test";

import {
  canonDate,
  classifyMismatch,
  histogram,
  isDateLiteralOnly,
  isLiteralOnly,
  literalsIn,
  tablesIn,
} from "../src/analyze-mismatches.ts";

describe("tablesIn", () => {
  it("counts quoted table names (the bug that inflated fewer_tables)", () => {
    // A bare-word-only regex would miss `"transactions_1k"` and report 2.
    const sql = `SELECT p.Description FROM "transactions_1k" AS t
      JOIN gasstations AS g ON t.GasStationID = g.GasStationID
      JOIN products AS p ON t.ProductID = p.ProductID`;
    expect(tablesIn(sql.toLowerCase())).toEqual(
      new Set(["transactions_1k", "gasstations", "products"]),
    );
  });

  it("handles backtick and bracket quoting", () => {
    expect(tablesIn("select * from `a` join [b] on a.id = b.id")).toEqual(new Set(["a", "b"]));
  });
});

describe("classifyMismatch", () => {
  it("does not flag fewer_tables when a quoted table balances the count", () => {
    const gold = `SELECT DISTINCT T3.Description FROM transactions_1k AS T1
      INNER JOIN gasstations AS T2 ON T1.GasStationID = T2.GasStationID
      INNER JOIN products AS T3 ON T1.ProductID = T3.ProductID`;
    const pred = `SELECT p.Description FROM "transactions_1k" AS t
      JOIN gasstations AS g ON t.GasStationID = g.GasStationID
      JOIN products AS p ON t.ProductID = p.ProductID`;
    const tags = classifyMismatch(pred, gold);
    expect(tags).not.toContain("fewer_tables");
    expect(tags).toContain("missing_DISTINCT"); // the real diff here
  });

  it("flags extra_DISTINCT and agg_fn_diff when the model adds DISTINCT and a COUNT", () => {
    const gold =
      "SELECT COUNT(*) FROM yearmonth AS T1 JOIN customers AS T2 ON T1.CustomerID = T2.CustomerID";
    const pred =
      "SELECT COUNT(DISTINCT ym.CustomerID) FROM customers AS c JOIN yearmonth AS ym ON c.CustomerID = ym.CustomerID";
    const tags = classifyMismatch(pred, gold);
    expect(tags).toContain("extra_DISTINCT");
  });

  it("flags fewer_tables when the prediction genuinely drops a join", () => {
    const gold =
      "SELECT T2.Country FROM transactions_1k AS T1 JOIN gasstations AS T2 ON T1.GasStationID = T2.GasStationID JOIN yearmonth AS T3 ON T1.CustomerID = T3.CustomerID";
    const pred = "SELECT gs.Country FROM gasstations AS gs WHERE gs.Country IS NOT NULL";
    expect(classifyMismatch(pred, gold)).toContain("fewer_tables");
  });

  it("tags a casing-only constant diff as literal_case_only, not the catch-all", () => {
    const gold = "SELECT name FROM t WHERE country = 'CZE'";
    const pred = "SELECT name FROM t WHERE country = 'cze'";
    const tags = classifyMismatch(pred, gold);
    expect(tags).toContain("literal_diff");
    expect(tags).toContain("literal_case_only");
    expect(tags).not.toContain("other_predicate_or_value");
  });

  it("tags a date-encoding constant diff as date_literal_only, not casing (§4 #2c)", () => {
    const gold = "SELECT name FROM t WHERE d = '2019-08-20'";
    const pred = "SELECT name FROM t WHERE d = '2019-8-20'";
    const tags = classifyMismatch(pred, gold);
    expect(tags).toContain("literal_diff");
    expect(tags).toContain("date_literal_only");
    expect(tags).not.toContain("literal_case_only");
  });

  it("does not tag date_literal_only when a literal genuinely differs (wrong value)", () => {
    const gold = "SELECT name FROM t WHERE city = 'Paris'";
    const pred = "SELECT name FROM t WHERE city = 'Lyon'";
    const tags = classifyMismatch(pred, gold);
    expect(tags).toContain("literal_diff");
    expect(tags).not.toContain("date_literal_only");
  });

  it("does not flag literal_diff when constants are identical (pure structural)", () => {
    const gold = "SELECT DISTINCT name FROM t WHERE country = 'CZE'";
    const pred = "SELECT name FROM t WHERE country = 'CZE'";
    const tags = classifyMismatch(pred, gold);
    expect(tags).not.toContain("literal_diff");
    expect(tags).toContain("missing_DISTINCT");
  });

  it("tags an empty prediction and ignores empty gold", () => {
    expect(classifyMismatch("", "SELECT 1")).toEqual(["empty_pred"]);
    expect(classifyMismatch("SELECT 1", "")).toEqual([]);
  });
});

describe("literalsIn / isLiteralOnly", () => {
  it("extracts string literals case-preserved", () => {
    expect(literalsIn("WHERE a = 'SME' AND b = 'CZK'")).toEqual(["SME", "CZK"]);
  });

  it("isLiteralOnly is true when only string literals differ", () => {
    expect(isLiteralOnly("SELECT x FROM t WHERE c = 'a'", "SELECT x FROM t WHERE c = 'b'")).toBe(
      true,
    );
  });

  it("isLiteralOnly is false when the structure also differs", () => {
    expect(
      isLiteralOnly("SELECT DISTINCT x FROM t WHERE c = 'a'", "SELECT x FROM t WHERE c = 'b'"),
    ).toBe(false);
  });

  it("isLiteralOnly is false when literals are identical (no value error to fix)", () => {
    expect(isLiteralOnly("SELECT x FROM t WHERE c = 'a'", "SELECT x FROM t WHERE c = 'a'")).toBe(
      false,
    );
  });
});

describe("canonDate / isDateLiteralOnly (§4 #2c date-normalisation lever)", () => {
  it("canonicalises unpadded dates and strips one trailing LIKE wildcard", () => {
    expect(canonDate("2019-8-20")).toBe("2019-08-20");
    expect(canonDate("2019-08-20%")).toBe("2019-08-20");
    expect(canonDate("2019-8-2")).toBe("2019-08-02");
  });

  it("preserves a time component (date-only must not equal a datetime)", () => {
    expect(canonDate("2019-8-20 12:00:00")).toBe("2019-08-20 12:00:00");
  });

  it("passes non-date literals through unchanged", () => {
    expect(canonDate("SME")).toBe("SME");
    expect(canonDate("12-34")).toBe("12-34");
  });

  it("isDateLiteralOnly is true when only date encoding differs and structure matches", () => {
    expect(
      isDateLiteralOnly(
        "SELECT x FROM t WHERE d = '2019-8-20'",
        "SELECT x FROM t WHERE d = '2019-08-20'",
      ),
    ).toBe(true);
  });

  it("isDateLiteralOnly is false when an operator also differs (LIKE '…%' vs = '…')", () => {
    // The literal diff vanishes under canonicalisation, but `LIKE` vs `=` is a
    // structural change a date directive alone cannot make — so not date-only.
    expect(
      isDateLiteralOnly(
        "SELECT x FROM t WHERE d LIKE '2019-10-08%'",
        "SELECT x FROM t WHERE d = '2019-10-08'",
      ),
    ).toBe(false);
  });

  it("isDateLiteralOnly is false for a genuine wrong-value literal", () => {
    expect(
      isDateLiteralOnly(
        "SELECT x FROM t WHERE d = '2019-08-21'",
        "SELECT x FROM t WHERE d = '2019-08-20'",
      ),
    ).toBe(false);
  });
});

describe("histogram", () => {
  it("joins on question_id and tallies only mismatches", () => {
    const results = [
      { question_id: 1, outcome: "match", predicted_sql: "SELECT 1" },
      { question_id: 2, outcome: "mismatch", predicted_sql: "SELECT name FROM t" },
      { question_id: 3, outcome: "mismatch", predicted_sql: "SELECT DISTINCT name FROM t" },
    ];
    const gold = [
      { question_id: 1, SQL: "SELECT 1" },
      { question_id: 2, SQL: "SELECT DISTINCT name FROM t" },
      { question_id: 3, SQL: "SELECT name FROM t" },
    ];
    const { joined, total, tally } = histogram(results, gold);
    expect(total).toBe(2);
    expect(joined).toBe(2);
    const map = Object.fromEntries(tally);
    expect(map["missing_DISTINCT"]).toBe(1);
    expect(map["extra_DISTINCT"]).toBe(1);
  });
});
