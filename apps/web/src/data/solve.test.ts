import { describe, expect, test } from "bun:test";
import { SOLVE_ENTRIES, SOLVE_PERSONA_ORDER, SOLVE_PERSONAS, solveBySlug } from "./solve.ts";

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

  // The howNlqdbAnswers "Each ≤25 words" rule (solve.ts) is an AEO scannability
  // invariant — these bullets are lifted onto the card and into LLM citation
  // panels, where a 35-word "bullet" reads as a paragraph and gets demoted. It
  // lived only in a code comment and had silently drifted (25 of ~50 bullets
  // over budget); this guard moves it into the one layer that can't forget, and
  // names the offenders on failure so the next over-long bullet fails in the PR
  // that writes it (mirrors the /vs SK-CMP-001 bullet guard).
  test("every howNlqdbAnswers bullet stays under the 25-word AEO scannability ceiling", () => {
    const over: string[] = [];
    for (const s of SOLVE_ENTRIES) {
      s.howNlqdbAnswers.forEach((b, i) => {
        const words = b.trim().split(/\s+/).length;
        if (words > 25) over.push(`${s.slug} [bullet ${i}] (${words}w): ${b}`);
      });
    }
    expect(over).toEqual([]);
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

  test("SOLVE_PERSONAS has an entry for every persona used in SOLVE_ENTRIES", () => {
    for (const s of SOLVE_ENTRIES) {
      expect(SOLVE_PERSONAS[s.persona]).toBeDefined();
    }
  });

  test("SOLVE_PERSONAS labels and descriptions are user-facing — no internal P1/P2/P3/P4 codes leak", () => {
    for (const info of Object.values(SOLVE_PERSONAS)) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
      expect(info.label).not.toMatch(/\bP[1-9]\b/);
      expect(info.description).not.toMatch(/\bP[1-9]\b/);
    }
  });

  test("SOLVE_PERSONA_ORDER covers every persona key in SOLVE_PERSONAS exactly once", () => {
    expect(new Set(SOLVE_PERSONA_ORDER).size).toBe(SOLVE_PERSONA_ORDER.length);
    const keys = Object.keys(SOLVE_PERSONAS).sort();
    const ordered = [...SOLVE_PERSONA_ORDER].sort();
    expect(ordered).toEqual(keys);
  });
});
