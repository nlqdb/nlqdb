// Unit tests for the goal-kind classifier. Covers each rule in
// `classifier.ts` so a swap-in to the LLM version (follow-up PR)
// can verify it preserves the same call-site behaviour on these
// canonical fixtures.

import { describe, expect, it } from "vitest";
import { classifyKind } from "./classifier.ts";

describe("classifyKind — heuristic v0", () => {
  describe("kind = create — high-precision matches", () => {
    it.each([
      "an orders tracker for my coffee shop",
      "build me a leaderboard",
      "set up a journal for my running times",
      "create a directory of api endpoints",
      "spin up an inventory for my warehouse",
      "make a ledger for monthly expenses",
      "scaffold a catalog for product photos",
    ])("classifies %j as create", (goal) => {
      const result = classifyKind(goal);
      expect(result.kind).toBe("create");
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toMatch(/^create_token_match:/);
    });
  });

  describe("kind = write — high-precision matches", () => {
    it.each([
      "add an order: alice, latte, $4.50",
      "insert a customer named bob",
      "delete record 42",
      "promote everyone with 100 orders to gold",
      "update status to shipped",
      "refund order 4127",
      "remove old entries",
      "save current configuration",
    ])("classifies %j as write", (goal) => {
      const result = classifyKind(goal);
      expect(result.kind).toBe("write");
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toMatch(/^write_token_match:/);
    });
  });

  describe("kind = query — high-precision read framings", () => {
    it.each([
      "today's revenue",
      "how many signups today",
      "show me yesterday's orders",
      "what's my average order value",
      "list customers",
      "find orders from last week",
      "total count of users",
    ])("classifies %j as query", (goal) => {
      const result = classifyKind(goal);
      expect(result.kind).toBe("query");
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toMatch(/^read_token_match:/);
    });
  });

  describe("ambiguous / unrecognised — defaults to query", () => {
    it("falls through to query+0.5 for goals the heuristic can't read", () => {
      // "a CRM for two-person startups" carries no token in any
      // bucket. The heuristic returns query (the safe default —
      // misclassifying create as query just returns 0 rows;
      // misclassifying as create would mint an unwanted db).
      // The LLM follow-up will recover this case.
      const result = classifyKind("a CRM for two-person startups");
      expect(result.kind).toBe("query");
      expect(result.confidence).toBe(0.5);
    });

    it("biases mixed create+read goals to query (read tokens win)", () => {
      // "show me a journal of my running times" — the read frame
      // wins over the create-noun "journal".
      const result = classifyKind("show me a journal of my running times");
      expect(result.kind).toBe("query");
    });
  });

  describe("edge cases", () => {
    it("returns query+0.5 for empty goal so the read/write orchestrator surfaces the validation error", () => {
      const result = classifyKind("");
      expect(result).toEqual({
        kind: "query",
        confidence: 0.5,
        reason: "empty_goal_default",
      });
    });

    it("returns query+0.5 for unrecognised goals (LLM follow-up will improve recall)", () => {
      const result = classifyKind("zigzag fizzbuzz quux");
      expect(result).toEqual({
        kind: "query",
        confidence: 0.5,
        reason: "default_fallback",
      });
    });

    it("is case-insensitive and tolerates punctuation", () => {
      const result = classifyKind("BUILD me a TRACKER, please.");
      expect(result.kind).toBe("create");
    });

    it("includes the matched tokens in the reason for traceability", () => {
      const result = classifyKind("create a journal");
      expect(result.reason).toContain("create");
      expect(result.reason).toContain("journal");
    });
  });
});
