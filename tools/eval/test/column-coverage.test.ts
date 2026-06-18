import { describe, expect, it } from "bun:test";

import { coverage, coveredByGoal, goldColumns, isKeyLike } from "../src/column-coverage.ts";

describe("goldColumns", () => {
  it("extracts qualified alias.column references, lowercased", () => {
    const sql =
      "SELECT T1.Segment FROM customers AS T1 JOIN ym AS T2 ON T1.CustomerID = T2.CustomerID";
    expect(goldColumns(sql)).toEqual(new Set(["segment", "customerid"]));
  });

  it("ignores string literals so a quoted value is not read as a column", () => {
    // `c.Currency = 'CustomerID'` — the literal must not leak in as a column.
    const sql = "SELECT c.Currency FROM customers AS c WHERE c.Currency = 'CustomerID'";
    expect(goldColumns(sql)).toEqual(new Set(["currency"]));
  });

  it("ignores bare (unqualified) identifiers — only alias.column counts", () => {
    // `Consumption` is unqualified, so it is deliberately not counted (it
    // collides with table/alias names); only `ym.CustomerID` is.
    const sql = "SELECT SUM(Consumption) FROM yearmonth AS ym GROUP BY ym.CustomerID";
    expect(goldColumns(sql)).toEqual(new Set(["customerid"]));
  });
});

describe("isKeyLike", () => {
  it("matches concatenated keys BIRD writes without a separator", () => {
    for (const c of ["raceid", "driverid", "customerid", "cdscode", "setcode", "owneruserid"])
      expect(isKeyLike(c)).toBe(true);
  });

  it("matches separated and prefixed FK conventions", () => {
    for (const c of ["user_id", "foreign_key", "link_to_member", "fk_owner"])
      expect(isKeyLike(c)).toBe(true);
  });

  it("does not match value/measure columns", () => {
    for (const c of ["segment", "currency", "displayname", "year", "fastestlapspeed"])
      expect(isKeyLike(c)).toBe(false);
  });
});

describe("coveredByGoal", () => {
  it("is true when a column token appears in the goal token set", () => {
    // "consumption" tokenizes to {consumption}; the column shares it.
    const goalTokens = new Set(["total", "consumption", "customer"]);
    expect(coveredByGoal("consumption", goalTokens)).toBe(true);
    expect(coveredByGoal("segment", goalTokens)).toBe(false);
  });
});

describe("coverage", () => {
  it("partitions every qualified ref into covered | key | value (sums to total)", () => {
    const gold = [
      {
        // goal names "segment" and "consumption"; CustomerID is an uncovered key.
        question: "total consumption by segment",
        SQL: "SELECT T1.Segment, SUM(T2.Consumption) FROM c AS T1 JOIN ym AS T2 ON T1.CustomerID = T2.CustomerID GROUP BY T1.Segment",
      },
      {
        // goal names neither column; Currency is an uncovered value, raceId a key.
        question: "which year had the most paid races",
        SQL: "SELECT r.Year FROM races AS r JOIN paid AS p ON r.RaceId = p.RaceId WHERE p.Currency = 'EUR'",
      },
    ];
    const r = coverage(gold);
    expect(r.covered + r.uncoveredKey + r.uncoveredValue).toBe(r.total);
    // segment + consumption covered; year covered ("year" is in goal 2).
    expect(r.covered).toBe(3);
    // customerid + raceid are keys.
    expect(r.uncoveredKey).toBe(2);
    // currency is the lone value/measure miss.
    expect(r.uncoveredValue).toBe(1);
    expect(r.topValueMisses).toContainEqual(["currency", 1]);
  });

  it("reports coverage as a 4-dp ratio and tolerates empty gold", () => {
    expect(coverage([]).coverage).toBe(0);
    const r = coverage([{ question: "x", SQL: "SELECT t.a FROM t" }]);
    expect(r.coverage).toBe(0); // 'a' shares no token with 'x'
  });
});
