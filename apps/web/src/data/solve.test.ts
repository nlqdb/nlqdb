import { describe, expect, test } from "bun:test";
import { SOLVE_ENTRIES, solveBySlug } from "./solve.ts";

// `/solve/<slug>` data is loaded by 4 surfaces (page template, /solve
// index, sitemap, llms.txt). These checks pin the invariants the
// template + AEO best-practice (SK-SOLVE-001 / SK-SOLVE-002 /
// SK-SOLVE-003) rely on.

describe("SOLVE_ENTRIES data integrity", () => {
  test("every solve entry has a unique slug", () => {
    const slugs = SOLVE_ENTRIES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every slug is URL-safe (lower-kebab)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("searchTitle is non-empty and under 90 chars (LLM citation-panel width)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.searchTitle.length).toBeGreaterThan(0);
      expect(s.searchTitle.length).toBeLessThanOrEqual(90);
    }
  });

  test("oneLiner stays under the 60-word AEO direct-answer ceiling", () => {
    for (const s of SOLVE_ENTRIES) {
      const wordCount = s.oneLiner.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(60);
    }
  });

  test("painContext is non-empty (sets the search-intent context)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.painContext.length).toBeGreaterThan(0);
    }
  });

  test("demoGoal is non-empty (drives <nlq-data> + draft-storage seed)", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.demoGoal.length).toBeGreaterThan(0);
    }
  });

  test("SK-SOLVE-001: every entry has ≥3 howNlqdbAnswers bullets", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.howNlqdbAnswers.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("SK-SOLVE-002: every entry has ≥2 honest 'whatItDoesnt' bullets", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.whatItDoesnt.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("SK-SOLVE-001: every entry has ≥3 FAQs", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.faqs.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("SK-SOLVE-003: every entry cites ≥2 enduring discussion-hub URLs", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(s.sources.length).toBeGreaterThanOrEqual(2);
      for (const src of s.sources) {
        expect(src.url).toMatch(/^https:\/\//);
        expect(src.label.length).toBeGreaterThan(0);
      }
    }
  });

  test("persona is one of the documented P1-P4 slugs (matches docs/research/personas.md)", () => {
    const valid = new Set([
      "P1 solo builder",
      "P2 agent builder",
      "P3 analyst",
      "P4 backend engineer",
    ]);
    for (const s of SOLVE_ENTRIES) {
      expect(valid.has(s.persona)).toBe(true);
    }
  });

  test("FAQ answers stay under 80 words each (LLM lift-verbatim sweet spot)", () => {
    for (const s of SOLVE_ENTRIES) {
      for (const f of s.faqs) {
        const wordCount = f.a.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(80);
      }
    }
  });

  test("solveBySlug returns the matching entry", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(solveBySlug(s.slug)).toBe(s);
    }
  });

  test("solveBySlug returns undefined for unknown slug (404 path)", () => {
    expect(solveBySlug("definitely-not-a-real-pain")).toBeUndefined();
  });
});
