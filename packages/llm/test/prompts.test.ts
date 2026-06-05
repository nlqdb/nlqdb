// Asserts the engine-classifier and route prompts encode their
// canonical contracts.
//
// The engine-classifier prompt embeds the SK-MULTIENG-002 fit table
// verbatim — that table is the canonical source per
// `docs/features/multi-engine-adapter/FEATURE.md`. Drift between the
// prompt and the table would fork the LLM's worldview from the docs.
//
// The route prompt encodes SK-ASK-009: the cheap-tier classifier
// receives recent tables and must return `{kind, targetDbId,
// referencedTables, confidence, reason}` as strict JSON.

import { describe, expect, it } from "vitest";
import {
  buildEngineClassifyUser,
  buildPlanUser,
  buildRouteUser,
  ENGINE_CLASSIFY_SYSTEM,
  PLAN_FEW_SHOT,
  PLAN_SYSTEM,
  ROUTE_SYSTEM,
} from "../src/prompts.ts";

describe("PLAN_SYSTEM (SK-LLM-018 schema-fidelity directives)", () => {
  it("names the dialect-strict, single-statement contract", () => {
    expect(PLAN_SYSTEM).toMatch(/single SQL statement for the named dialect/);
    expect(PLAN_SYSTEM).toContain('"sql"');
    expect(PLAN_SYSTEM).toContain("No prose, no code fences");
  });

  it("requires schema-literal identifiers + verbatim casing (DIN-SQL / C3-SQL schema-link)", () => {
    expect(PLAN_SYSTEM).toMatch(
      /Use only tables and columns that appear literally in the provided schema/,
    );
    expect(PLAN_SYSTEM).toMatch(/preserve identifier casing exactly/);
  });

  it("escalates BIRD's `Evidence:` block from hint to authoritative", () => {
    expect(PLAN_SYSTEM).toMatch(/`Evidence:`/);
    expect(PLAN_SYSTEM).toMatch(/authoritative annotator context/);
  });

  it("appends the SK-LLM-026 few-shot exemplars after the directives", () => {
    expect(PLAN_SYSTEM).toContain(PLAN_FEW_SHOT);
    // Directives must precede the examples so the contract is read first.
    expect(PLAN_SYSTEM.indexOf("Respond with strict JSON")).toBeLessThan(
      PLAN_SYSTEM.indexOf(PLAN_FEW_SHOT),
    );
  });
});

describe("PLAN_FEW_SHOT (SK-LLM-026 static few-shot exemplars)", () => {
  it("ships three Question→answer exemplars", () => {
    expect(PLAN_FEW_SHOT.match(/^Dialect: sqlite$/gm)).toHaveLength(3);
    expect(PLAN_FEW_SHOT.match(/^Goal: /gm)).toHaveLength(3);
  });

  it("each answer is strict JSON of {sql} with no trailing semicolon (echoes PLAN_DIRECTIVES)", () => {
    const answers = PLAN_FEW_SHOT.split("\n").filter((l) => l.startsWith("{"));
    expect(answers).toHaveLength(3);
    for (const a of answers) {
      const parsed = JSON.parse(a) as { sql: string };
      expect(typeof parsed.sql).toBe("string");
      expect(parsed.sql.length).toBeGreaterThan(0);
      expect(parsed.sql.endsWith(";")).toBe(false);
    }
  });

  it("demonstrates verbatim casing, the Evidence formula, and a top-N aggregation", () => {
    // Mixed-case + quoted identifiers carried verbatim (SK-LLM-018 casing rule).
    expect(PLAN_FEW_SHOT).toContain('"Album"');
    expect(PLAN_FEW_SHOT).toContain("ArtistId");
    // One exemplar applies an `Evidence:` formula end-to-end.
    expect(PLAN_FEW_SHOT).toMatch(/Evidence: income per resident = total_income \/ residents/);
    expect(PLAN_FEW_SHOT).toContain("total_income / residents");
    // Top-N idiom: ORDER BY <agg> DESC LIMIT 1.
    expect(PLAN_FEW_SHOT).toMatch(/ORDER BY SUM\(amount\) DESC LIMIT 1/);
  });

  it("carries no code fences (the exemplars model the no-fence contract)", () => {
    expect(PLAN_FEW_SHOT).not.toContain("```");
  });
});

describe("buildPlanUser (SK-LLM-018 retry framing)", () => {
  const baseReq = {
    goal: "count cats",
    schema: "CREATE TABLE pet (id INTEGER, species TEXT)",
    dialect: "sqlite",
  } as const;

  it("emits dialect + schema + goal blocks on first attempt with no previousAttempt clutter", () => {
    const out = buildPlanUser(baseReq);
    expect(out).toContain("Dialect: sqlite");
    expect(out).toContain("Schema:\nCREATE TABLE pet (id INTEGER, species TEXT)");
    expect(out).toContain("Goal: count cats");
    expect(out).not.toContain("Previous attempt");
  });

  it("renders the diagnostic retry block when previousAttempt is set", () => {
    const out = buildPlanUser({
      ...baseReq,
      previousAttempt: { sql: "SELECT * FROM cat", error: "no such table: cat" },
    });
    expect(out).toContain("Previous attempt failed:");
    expect(out).toContain("SQL: SELECT * FROM cat");
    expect(out).toContain("Error: no such table: cat");
    // The three diagnostic-first directives — same Goal, schema-only identifiers, surgical fix.
    expect(out).toMatch(/Answer the same Goal/);
    expect(out).toMatch(/Use only tables and columns from the Schema/);
    expect(out).toMatch(/Diagnose the error first, then change only what the error names/);
    // The pre-SK-LLM-018 "different shape" phrasing must be gone — it invited over-correction.
    expect(out).not.toMatch(/different SQL shape/);
  });

  it("omits the SQL line when previousAttempt carries an error but no SQL (LLM-throw case)", () => {
    const out = buildPlanUser({
      ...baseReq,
      previousAttempt: { error: "provider 503" },
    });
    expect(out).toContain("Error: provider 503");
    expect(out).not.toMatch(/^SQL: /m);
  });

  it("caps the prior SQL at 500 chars so the retry prompt's token budget stays predictable", () => {
    const longSql = "SELECT ".concat("col,".repeat(200), "x FROM t");
    const out = buildPlanUser({
      ...baseReq,
      previousAttempt: { sql: longSql, error: "syntax" },
    });
    const sqlLine = out.split("\n").find((l) => l.startsWith("SQL: ")) ?? "";
    expect(sqlLine.length - "SQL: ".length).toBeLessThanOrEqual(500);
  });
});

describe("ENGINE_CLASSIFY_SYSTEM (SK-DB-010 / SK-MULTIENG-002)", () => {
  it("embeds the SK-MULTIENG-002 engine-fit table header verbatim", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain(
      "| Engine | Strong fit | Avoid when | Free-tier ceiling |",
    );
  });

  it("includes the postgres row with Neon and the 'tracker / app data' default phrase", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("**postgres** (Neon)");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain('default for "tracker / app data" goals');
  });

  it("includes the clickhouse row with Tinybird and the 10 GB free-tier ceiling", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("**clickhouse** (Tinybird)");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("10 GB + 1 k reads/day");
  });

  it("flags sqlite + redis as deferred so the LLM can't pick them today", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("sqlite");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("redis");
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("*deferred*");
    expect(ENGINE_CLASSIFY_SYSTEM).toMatch(/only return "postgres" or "clickhouse"/);
  });

  it("forces strict JSON output to keep parseJsonResponse happy", () => {
    expect(ENGINE_CLASSIFY_SYSTEM).toContain('"engine"');
    expect(ENGINE_CLASSIFY_SYSTEM).toContain('"confidence"');
    expect(ENGINE_CLASSIFY_SYSTEM).toContain("No prose, no code fences.");
  });
});

describe("buildEngineClassifyUser", () => {
  it("formats the user-prompt as `Goal: <text>`", () => {
    expect(buildEngineClassifyUser({ goal: "an orders tracker" })).toBe("Goal: an orders tracker");
  });
});

describe("ROUTE_SYSTEM (SK-ASK-009)", () => {
  it("names the three kinds the LLM may return", () => {
    expect(ROUTE_SYSTEM).toContain('"create"');
    expect(ROUTE_SYSTEM).toContain('"query"');
    expect(ROUTE_SYSTEM).toContain('"write"');
  });

  it("requires the four output fields including referencedTables", () => {
    expect(ROUTE_SYSTEM).toContain("targetDbId");
    expect(ROUTE_SYSTEM).toContain("referencedTables");
    expect(ROUTE_SYSTEM).toContain("confidence");
    expect(ROUTE_SYSTEM).toContain("reason");
  });

  it("encodes the 'unknown table → create' rule (the load-bearing case)", () => {
    expect(ROUTE_SYSTEM).toMatch(/NOT in any recent list/);
    expect(ROUTE_SYSTEM).toMatch(/treat it as "create"/);
  });

  it("forces strict JSON output to keep parseJsonResponse happy", () => {
    expect(ROUTE_SYSTEM).toContain("No prose, no code fences.");
  });
});

describe("buildRouteUser", () => {
  it("emits goal + dbs + recentTables as JSON blocks", () => {
    const out = buildRouteUser({
      goal: "show orders",
      dbs: [{ id: "db1", slug: "orders" }],
      recentTables: [{ dbId: "db1", table: "orders" }],
    });
    expect(out).toContain("Goal: show orders");
    expect(out).toContain('Databases (JSON):\n[{"id":"db1","slug":"orders"}]');
    expect(out).toContain('RecentTables (JSON):\n[{"dbId":"db1","table":"orders"}]');
  });

  it("caps dbs at 25 and recentTables at 100", () => {
    const dbs = Array.from({ length: 30 }, (_, i) => ({ id: `db${i}`, slug: `slug${i}` }));
    const recentTables = Array.from({ length: 200 }, (_, i) => ({
      dbId: "db1",
      table: `t${i}`,
    }));
    const out = buildRouteUser({ goal: "g", dbs, recentTables });
    expect(out).toContain('"id":"db24"');
    expect(out).not.toContain('"id":"db25"');
    expect(out).toContain('"table":"t99"');
    expect(out).not.toContain('"table":"t100"');
  });
});
