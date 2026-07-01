import { describe, expect, test } from "bun:test";
import { renderInline } from "../lib/inline-md.ts";
import { BLOG_POSTS, type BlogBlock } from "./blog.ts";

// Data-integrity guards for the /blog source of truth — same posture as
// solve.test.ts / competitors.test.ts: the invariants the templates and
// the AEO surface depend on live here, not in reviewers' memories.

const inlineTexts = (b: BlogBlock): string[] => {
  if (b.kind === "p" || b.kind === "h2") return [b.text];
  if (b.kind === "ul" || b.kind === "ol") return b.items;
  return [];
};

describe("blog data", () => {
  test("slugs are unique, lower-kebab, URL-safe", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  test("dates are valid ISO yyyy-mm-dd and posts are newest-first", () => {
    for (const p of BLOG_POSTS) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(p.date))).toBe(false);
    }
    const dates = BLOG_POSTS.map((p) => p.date);
    expect([...dates].sort().reverse().join()).toBe(dates.join());
  });

  test("title and description fit their surfaces", () => {
    for (const p of BLOG_POSTS) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.title.length).toBeLessThanOrEqual(110);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.description.length).toBeLessThanOrEqual(200);
      expect(p.body.length).toBeGreaterThan(0);
    }
  });

  test("anchors point at site-relative /vs or /solve paths", () => {
    for (const p of BLOG_POSTS) {
      if (!p.anchor) continue;
      expect(p.anchor.path).toMatch(/^\/(vs|solve)\/[a-z0-9-]+$/);
    }
  });

  test("no post copy mentions the retired gate/waitlist or a stage other than pre-beta", () => {
    // Founder directive 2026-07-01: the product is open pre-beta — no
    // waitlist, no invite, no "pre-alpha" in new copy.
    const all = JSON.stringify(BLOG_POSTS).toLowerCase();
    for (const banned of ["waitlist", "invite", "pre-alpha", "prealpha"]) {
      expect(all).not.toContain(banned);
    }
  });

  test("inline text respects the renderer's documented limit (no code span inside strong/em)", () => {
    for (const p of BLOG_POSTS) {
      for (const b of p.body) {
        for (const text of inlineTexts(b)) {
          // If a strong/em marker survives rendering outside a code span,
          // an emphasis span wrapped a code span (lib/inline-md.ts limit)
          // or a pair is unbalanced — fix the copy.
          const outsideCode = renderInline(text).replace(/<code>[^<]*<\/code>/g, "");
          expect(outsideCode).not.toContain("*");
        }
      }
    }
  });
});
