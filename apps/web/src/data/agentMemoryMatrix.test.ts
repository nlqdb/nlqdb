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
      (r) => r.mem0 === "shipped" && r.zep === "shipped" && r.letta === "shipped" && r.nlqdb === "shipped",
    );
    expect(recall.length).toBeGreaterThanOrEqual(2);
  });

  test("verifiedOn is an ISO date < 60 days old (staleness alert)", () => {
    expect(MATRIX_VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ageDays = (Date.now() - Date.parse(MATRIX_VERIFIED_ON)) / 86_400_000;
    expect(ageDays).toBeLessThan(60);
  });
});
