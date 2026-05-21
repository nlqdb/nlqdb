import { describe, expect, test } from "bun:test";
import { COMPETITORS, competitorBySlug } from "./competitors.ts";

// Comparison-page data is loaded by 4 surfaces (page template, /vs
// index, sitemap, llms.txt). These checks pin the invariants the
// template + AEO best-practice (SK-CMP-001 / SK-CMP-003) rely on.

describe("COMPETITORS data integrity", () => {
  test("every competitor has a unique slug", () => {
    const slugs = COMPETITORS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every slug is URL-safe (lower-kebab)", () => {
    for (const c of COMPETITORS) {
      expect(c.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("every competitor URL is absolute https", () => {
    for (const c of COMPETITORS) {
      expect(c.url).toMatch(/^https:\/\//);
    }
  });

  test("SK-CMP-001: every competitor lists ≥3 'when to choose them' bullets", () => {
    for (const c of COMPETITORS) {
      expect(c.whenChooseThem.length).toBeGreaterThanOrEqual(3);
      expect(c.whenChooseUs.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("SK-CMP-003: every competitor has ≥4 FAQs", () => {
    for (const c of COMPETITORS) {
      expect(c.faqs.length).toBeGreaterThanOrEqual(4);
    }
  });

  test("SK-CMP-003: at least one FAQ question names the competitor verbatim", () => {
    for (const c of COMPETITORS) {
      const namedInFaq = c.faqs.some((f) => f.q.includes(c.name));
      expect(namedInFaq).toBe(true);
    }
  });

  test("every comparison table row uses valid claim values", () => {
    const valid = new Set(["shipped", "partial", "no"]);
    for (const c of COMPETITORS) {
      for (const row of c.features) {
        expect(valid.has(row.us)).toBe(true);
        expect(valid.has(row.them)).toBe(true);
      }
    }
  });

  test("competitorBySlug returns the matching entry", () => {
    for (const c of COMPETITORS) {
      expect(competitorBySlug(c.slug)).toBe(c);
    }
  });

  test("competitorBySlug returns undefined for unknown slug (404 path)", () => {
    expect(competitorBySlug("definitely-not-a-real-competitor")).toBeUndefined();
  });
});
