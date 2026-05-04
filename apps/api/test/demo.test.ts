import { describe, expect, it } from "vitest";
import { buildDemoResult } from "../src/demo.ts";

describe("buildDemoResult", () => {
  it("returns the orders fixture by default", () => {
    const result = buildDemoResult("show me anything");
    expect(result.kind).toBe("ok");
    expect(result.rows.length).toBe(6);
    expect(result.rows[0]).toHaveProperty("drink");
    expect(result.sql).toContain("orders");
  });

  it("matches the memory fixture", () => {
    const result = buildDemoResult("a memory store for my AI agent");
    expect(result.rows[0]).toHaveProperty("thread_id");
    expect(result.sql).toContain("agent_memory");
  });

  it("matches the CRM fixture", () => {
    const result = buildDemoResult("a CRM for two-person startups");
    expect(result.rows[0]).toHaveProperty("company");
    expect(result.sql).toContain("contacts");
  });

  it("matches the leaderboard fixture", () => {
    const result = buildDemoResult("a leaderboard for our internal hackathon");
    expect(result.rows[0]).toHaveProperty("score");
  });

  it("matches the feedback fixture", () => {
    const result = buildDemoResult("a feedback inbox with auto-tags");
    expect(result.rows[0]).toHaveProperty("tags");
  });

  it("echoes the goal in the summary", () => {
    const result = buildDemoResult("a CRM for two-person startups");
    expect(result.summary).toContain("two-person startups");
  });

  it("filters rows when the goal contains a column value (orders / americano)", () => {
    const result = buildDemoResult("show me americano");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toMatchObject({ drink: "americano" });
    expect(result.rowCount).toBe(1);
    expect(result.sql).toContain("LIKE '%americano%'");
    expect(result.summary.toLowerCase()).toContain("americano");
  });

  it("filters CRM contacts by status (warm)", () => {
    const result = buildDemoResult("CRM contacts that are warm");
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThan(5);
    for (const row of result.rows) {
      expect(row).toMatchObject({ status: "warm" });
    }
    expect(result.summary.toLowerCase()).toContain("warm");
  });

  it("returns the unfiltered fixture when no token in goal matches any row value", () => {
    const result = buildDemoResult("hi");
    expect(result.rows.length).toBe(6);
    expect(result.summary).not.toContain("Filtered to");
  });
});

// `makeRateLimiter` was deleted with the /v1/demo/ask route
// (SK-WEB-008); per-IP anon rate-limiting now lives in
// `apps/api/test/anon-rate-limit.test.ts`.
