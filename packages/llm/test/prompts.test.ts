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
  buildRouteUser,
  ENGINE_CLASSIFY_SYSTEM,
  ROUTE_SYSTEM,
} from "../src/prompts.ts";

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
