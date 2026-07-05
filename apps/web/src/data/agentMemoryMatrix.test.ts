import { describe, expect, test } from "bun:test";
import { AGENT_MEMORY_MATRIX, MATRIX_VERIFIED_ON } from "./agentMemoryMatrix.ts";

// The capability matrix (SK-PIVOT-001) is a published persuasion asset, so
// these checks pin the honesty invariants the render (WS-06 run 2) and the
// AEO best-practice rely on: every cell is a known claim, the wedge rows
// are the ones only nlqdb wins, and the verified date is fresh.

describe("AGENT_MEMORY_MATRIX integrity", () => {
  const CLAIMS = new Set(["shipped", "partial", "no"]);

  test("every cell is a valid ComparisonClaim", () => {
    for (const row of AGENT_MEMORY_MATRIX) {
      for (const cell of [row.mem0, row.zep, row.letta, row.nlqdb]) {
        expect(CLAIMS.has(cell)).toBe(true);
      }
    }
  });

  test("the wedge holds: a row exists where only nlqdb ships", () => {
    const wedgeRows = AGENT_MEMORY_MATRIX.filter(
      (r) => r.nlqdb === "shipped" && r.mem0 === "no" && r.zep === "no" && r.letta === "no",
    );
    // GROUP BY/JOIN/HAVING, top-N, aggregation, schema design, diff preview…
    expect(wedgeRows.length).toBeGreaterThanOrEqual(5);
  });

  test("recall is honestly shown as table stakes (all four ship it)", () => {
    const recall = AGENT_MEMORY_MATRIX.filter(
      (r) =>
        r.mem0 === "shipped" &&
        r.zep === "shipped" &&
        r.letta === "shipped" &&
        r.nlqdb === "shipped",
    );
    expect(recall.length).toBeGreaterThanOrEqual(2);
  });

  test("verifiedOn is a valid, non-future ISO date < 60 days old (staleness alert)", () => {
    expect(MATRIX_VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = Date.parse(MATRIX_VERIFIED_ON);
    // A regex-shaped but impossible date (e.g. "2026-13-45") parses to NaN.
    expect(Number.isNaN(parsed)).toBe(false);
    const ageDays = (Date.now() - parsed) / 86_400_000;
    // A future date's negative age silently passes `< 60` and disables the
    // staleness alert — reject it, with 1 day of tolerance because the date
    // parses as UTC midnight, so a "today" written east of UTC is briefly
    // future. To fix: re-verify against docs/competitors.md §4, then set
    // MATRIX_VERIFIED_ON to that reconciliation date.
    expect(ageDays).toBeGreaterThanOrEqual(-1);
    expect(ageDays).toBeLessThan(60);
  });
});
