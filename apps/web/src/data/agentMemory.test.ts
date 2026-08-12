import { describe, expect, test } from "bun:test";
import { AGENT_MEMORY } from "./agentMemory.ts";

// The `/agents` dogfood block is the launch's proof surface and the fifth
// SK-PIVOT-016 criterion. These invariants guard the two ways it quietly
// turns dishonest: a number printed without (or past) its as-of date, and
// a raw memory row leaking into what must be aggregates-only.

describe("agentMemory snapshot", () => {
  test("asOf is a real, past ISO date (SK-PIVOT-019: no number without its date)", () => {
    expect(AGENT_MEMORY.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const asOf = new Date(`${AGENT_MEMORY.asOf}T00:00:00Z`);
    expect(Number.isNaN(asOf.getTime())).toBe(false);
    // A snapshot dated in the future is a generator bug, not a proof.
    expect(asOf.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test("a staleness bound is set so D-06 run 2 can redden CI on a stale snapshot", () => {
    expect(AGENT_MEMORY.staleAfterDays).toBeGreaterThan(0);
  });

  test("provenance names the public, non-privileged path", () => {
    expect(AGENT_MEMORY.provenance.toLowerCase()).toContain("mcp");
    expect(AGENT_MEMORY.dbId).toMatch(/^db_agent_memory_v1_/);
  });

  test("distributions are consistent with the table counts they roll up", () => {
    const countFor = (table: string) =>
      AGENT_MEMORY.tableCounts.find((t) => t.table === table)?.count;
    const facts = countFor("facts");
    const entities = countFor("entities");
    expect(facts).toBeDefined();
    expect(entities).toBeDefined();
    const factSum = AGENT_MEMORY.factsByKind.reduce((s, d) => s + d.count, 0);
    const entitySum = AGENT_MEMORY.entitiesByType.reduce((s, d) => s + d.count, 0);
    // The shown distribution may be a subset (top kinds), never MORE than the total.
    expect(factSum).toBeLessThanOrEqual(facts ?? 0);
    expect(entitySum).toBeLessThanOrEqual(entities ?? 0);
  });

  test("golden queries are real GROUP-BY aggregates with result rows", () => {
    expect(AGENT_MEMORY.goldenQueries.length).toBeGreaterThanOrEqual(2);
    for (const g of AGENT_MEMORY.goldenQueries) {
      expect(g.sql.toUpperCase()).toContain("GROUP BY");
      expect(g.rows.length).toBeGreaterThan(0);
      for (const row of g.rows) {
        expect(row).toHaveLength(2);
        expect(typeof row[1]).toBe("number");
      }
    }
  });

  test("aggregates only — no raw memory row (no free-text `content` field anywhere)", () => {
    // The block must never render a stored memory row's content. Every leaf
    // value is a count, a label, a timestamp, a SQL string, or prose we wrote
    // — assert no key named like a raw memory column exists on the snapshot.
    const forbidden = ["content", "body", "text", "value", "embedding"];
    const walk = (obj: unknown): void => {
      if (obj === null || typeof obj !== "object") return;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        expect(forbidden).not.toContain(k);
        walk(v);
      }
    };
    walk(AGENT_MEMORY);
  });

  test("the workload's one wrong answer is published, not hidden", () => {
    expect(AGENT_MEMORY.knownGap.length).toBeGreaterThan(0);
    expect(AGENT_MEMORY.totalAsks).toBeGreaterThan(0);
    expect(AGENT_MEMORY.firstTenSuccessPct).toBeGreaterThanOrEqual(95);
  });
});
