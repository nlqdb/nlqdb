import { describe, expect, test } from "bun:test";
import { blogBySlug } from "./blog";
import {
  BENCHMARKS,
  DB_DOES_NOT_WIN,
  LANDSCAPE_VERIFIED_ON,
  LOCOMO_AUDIT,
  NLQDB_EVAL_STATUS,
  REPORTED_RESULTS,
} from "./memoryBenchmarks";

// Honesty guards for the /agent-memory-benchmarks landscape (reach R-10 b).
// The page's whole value is that it is more honest than the vendor blogs it
// surveys — so the invariants below are load-bearing, not cosmetic. If a
// future edit breaks one, the page copy is now lying and must change with it.

describe("memory benchmarks landscape", () => {
  test("every benchmark cites a real https source and is fully described", () => {
    expect(BENCHMARKS.length).toBeGreaterThanOrEqual(3);
    for (const b of BENCHMARKS) {
      for (const f of [b.name, b.publisher, b.year, b.venue, b.measures, b.scale, b.grading]) {
        expect(f.trim().length).toBeGreaterThan(0);
      }
      expect(b.source.url.startsWith("https://")).toBe(true);
      expect(b.source.label.trim().length).toBeGreaterThan(0);
    }
  });

  // The page's headline claim ("every row in the analysis column is a ✗").
  // If a published benchmark ever isolates analytical queries over memory,
  // this fails on purpose and forces the copy to be re-examined.
  test("no published benchmark isolates analysis over memory", () => {
    expect(BENCHMARKS.every((b) => b.isolatesAnalysis === false)).toBe(true);
  });

  test("every reported number is attributed and flagged — none reads as settled", () => {
    expect(REPORTED_RESULTS.length).toBeGreaterThanOrEqual(3);
    for (const r of REPORTED_RESULTS) {
      expect(r.claim.trim().length).toBeGreaterThan(0);
      expect(r.reporter.trim().length).toBeGreaterThan(0);
      expect(r.source.url.startsWith("https://")).toBe(true);
      // Only self-reported or disputed exist — the field has no clean
      // third-party-reproduced result, so the type must never gain one
      // silently.
      expect(["self-reported", "disputed"]).toContain(r.status);
    }
    // At least one open dispute, so the tables never render as a tidy
    // scoreboard.
    expect(REPORTED_RESULTS.some((r) => r.status === "disputed")).toBe(true);
  });

  test("the honest concession (where a database loses) is present", () => {
    const concession = DB_DOES_NOT_WIN.body.toLowerCase();
    expect(concession).toMatch(/embedding|vector|similarity/);
  });

  // Hard rule 1: only promise what is live in prod. The cross-strategy
  // harness (SK-PIVOT-019 / D-07) is corpus-blocked, so no nlqdb score may
  // appear, and the eval status must say so out loud.
  test("no nlqdb self-score appears anywhere on the page", () => {
    expect(REPORTED_RESULTS.some((r) => /nlqdb/i.test(r.system))).toBe(false);
    expect(BENCHMARKS.some((b) => /nlqdb/i.test(b.publisher))).toBe(false);
    expect(NLQDB_EVAL_STATUS.body.join(" ").toLowerCase()).toContain("not published");
  });

  test("the audit callout cites its source", () => {
    expect(LOCOMO_AUDIT.findings.length).toBeGreaterThanOrEqual(1);
    expect(LOCOMO_AUDIT.source.url.startsWith("https://")).toBe(true);
  });

  test("verified-on is a valid ISO date", () => {
    expect(LANDSCAPE_VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(LANDSCAPE_VERIFIED_ON))).toBe(false);
  });

  test("the forward link to the survey blog post is not dead", () => {
    expect(blogBySlug(NLQDB_EVAL_STATUS.blogSlug)).toBeDefined();
  });
});
