import { describe, expect, test } from "bun:test";
import { BLOG_POSTS } from "../../data/blog.ts";
import { GET } from "../rss.xml.ts";

// The RSS feed is hand-rolled over BLOG_POSTS (same pattern as the sitemap).
// These guards pin the invariants a feed reader / dev.to import relies on:
// every post appears once, dates are valid RFC-822, and free-text titles are
// XML-escaped so a `&` in a headline can't break the feed.

const body = await (GET({} as never) as Response).text();

describe("rss.xml", () => {
  test("serves a well-formed RSS 2.0 channel", () => {
    expect(body).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<rss version="2.0"');
    expect(body).toContain("<title>nlqdb blog</title>");
    expect(body).toContain("<link>https://nlqdb.com/blog/</link>");
    expect(body).toContain('<atom:link href="https://nlqdb.com/rss.xml" rel="self"');
  });

  test("advertises the application/rss+xml content type", () => {
    const res = GET({} as never) as Response;
    expect(res.headers.get("Content-Type")).toContain("application/rss+xml");
  });

  test("emits one item per blog post with a trailing-slash permalink", () => {
    const itemCount = body.split("<item>").length - 1;
    expect(itemCount).toBe(BLOG_POSTS.length);
    for (const p of BLOG_POSTS) {
      const link = `https://nlqdb.com/blog/${p.slug}/`;
      expect(body).toContain(`<link>${link}</link>`);
      expect(body).toContain(`<guid isPermaLink="true">${link}</guid>`);
    }
  });

  test("pubDate is valid RFC-822 (parses to the post's ISO date)", () => {
    const pubDates = [...body.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => m[1]!);
    expect(pubDates.length).toBe(BLOG_POSTS.length);
    pubDates.forEach((raw, i) => {
      const parsed = new Date(raw);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      // Same UTC calendar day as the source post (newest-first order).
      expect(parsed.toISOString().slice(0, 10)).toBe(BLOG_POSTS[i]!.date);
    });
  });

  test("XML-escapes free-text titles and descriptions", () => {
    // No raw ampersand may survive outside an entity — the classic feed break.
    expect(body).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#)/);
  });
});
