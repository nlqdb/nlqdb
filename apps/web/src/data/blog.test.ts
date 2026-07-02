import { describe, expect, test } from "bun:test";
import { parseInline } from "../lib/blog-inline.ts";
import { BLOG_POSTS, BLOG_POSTS_BY_DATE, blogBySlug } from "./blog.ts";

// `/blog/<slug>` data is loaded by 4 surfaces (post template, /blog index,
// sitemap, llms.txt). These checks pin the invariants the template + AEO
// best-practice rely on — mirrors solve.test.ts.

describe("BLOG_POSTS data integrity", () => {
  test("every post has a unique slug", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every slug is URL-safe (lower-kebab)", () => {
    for (const p of BLOG_POSTS) {
      expect(p.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("every date is ISO YYYY-MM-DD", () => {
    for (const p of BLOG_POSTS) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("title is non-empty and under 90 chars (SERP + LLM headline width)", () => {
    for (const p of BLOG_POSTS) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.title.length).toBeLessThanOrEqual(90);
    }
  });

  test("description stays under the 160-char meta-description ceiling", () => {
    for (const p of BLOG_POSTS) {
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.description.length).toBeLessThanOrEqual(160);
    }
  });

  test("takeaway is non-empty (lede + BlogPosting abstract)", () => {
    for (const p of BLOG_POSTS) {
      expect(p.takeaway.length).toBeGreaterThan(0);
    }
  });

  test("every post has a non-empty body", () => {
    for (const p of BLOG_POSTS) {
      expect(p.body.length).toBeGreaterThan(0);
    }
  });

  test("code blocks carry a language and non-empty source", () => {
    for (const p of BLOG_POSTS) {
      for (const b of p.body) {
        if (b.kind === "code") {
          expect(b.lang.length).toBeGreaterThan(0);
          expect(b.code.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("every post cites ≥1 enduring source with an https URL and label", () => {
    for (const p of BLOG_POSTS) {
      expect(p.sources.length).toBeGreaterThanOrEqual(1);
      for (const src of p.sources) {
        expect(src.url).toMatch(/^https:\/\//);
        expect(src.label.length).toBeGreaterThan(0);
      }
    }
  });

  test("anchor path, when present, is a site-relative /solve or /vs link", () => {
    for (const p of BLOG_POSTS) {
      if (p.anchors) {
        expect(p.anchors.path).toMatch(/^\/(solve|vs)\//);
        expect(p.anchors.label.length).toBeGreaterThan(0);
      }
    }
  });

  test("blogBySlug returns the matching post", () => {
    for (const p of BLOG_POSTS) {
      expect(blogBySlug(p.slug)).toBe(p);
    }
  });

  test("blogBySlug returns undefined for unknown slug (404 path)", () => {
    expect(blogBySlug("definitely-not-a-real-post")).toBeUndefined();
  });

  test("BLOG_POSTS_BY_DATE is the same set, newest first", () => {
    expect(BLOG_POSTS_BY_DATE.length).toBe(BLOG_POSTS.length);
    const dates = BLOG_POSTS_BY_DATE.map((p) => p.date);
    const descending = [...dates].sort().reverse();
    expect(dates).toEqual(descending);
  });
});

describe("parseInline", () => {
  test("plain text is one non-code span", () => {
    expect(parseInline("hello world")).toEqual([{ code: false, text: "hello world" }]);
  });

  test("splits a single backtick pair into text / code / text", () => {
    expect(parseInline("use `NOT EXISTS` here")).toEqual([
      { code: false, text: "use " },
      { code: true, text: "NOT EXISTS" },
      { code: false, text: " here" },
    ]);
  });

  test("handles multiple code spans", () => {
    expect(parseInline("`a` and `b`")).toEqual([
      { code: true, text: "a" },
      { code: false, text: " and " },
      { code: true, text: "b" },
    ]);
  });

  test("an unterminated backtick leaves the remainder as code (odd count) without throwing", () => {
    // Degrades gracefully: split(`) yields ["x ", "oops"], index 1 is odd → code.
    const spans = parseInline("x `oops");
    expect(spans).toEqual([
      { code: false, text: "x " },
      { code: true, text: "oops" },
    ]);
  });

  test("empty string yields no spans", () => {
    expect(parseInline("")).toEqual([]);
  });
});
