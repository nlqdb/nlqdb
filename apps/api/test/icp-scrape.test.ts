// Unit tests for the ICP pain-signal scraper — verifies dedup, storage,
// and error-resilience without any real network calls.

import type { Span } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { type IcpScrapeDeps, runIcpScrape } from "../src/icp-scrape.ts";

// Map-backed KV stub mirroring the pattern in waitlist.test.ts.
function stubKv(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  } as unknown as KVNamespace;
}

// A minimal stub tracer that runs the callback with a no-op span.
const stubTracer: IcpScrapeDeps["tracer"] = {
  startActiveSpan: async (_name: string, fn: (span: Span) => Promise<unknown>) => {
    const noop = {
      setAttribute: () => {},
      recordException: () => {},
      end: () => {},
    } as unknown as Span;
    return fn(noop);
  },
};

// Minimal HN Algolia response for one story.
function hnResponse(objectID: string) {
  return JSON.stringify({
    hits: [
      {
        objectID,
        title: `HN Story ${objectID}`,
        url: `https://example.com/${objectID}`,
        points: 42,
        created_at_i: Math.floor(Date.now() / 1000) - 3600,
      },
    ],
  });
}

// Minimal Reddit search response for one post.
function redditResponse(id: string) {
  return JSON.stringify({
    data: {
      children: [
        {
          data: {
            id,
            title: `Reddit Post ${id}`,
            permalink: `/r/sideproject/comments/${id}/test/`,
            selftext: "some body text",
            score: 10,
            created_utc: Math.floor(Date.now() / 1000) - 7200,
          },
        },
      ],
    },
  });
}

// Returns a fetch stub that succeeds for all URLs by default.
function makeFetch(overrides: Record<string, string | null> = {}): typeof fetch {
  return vi.fn(async (url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (urlStr in overrides) {
      const body = overrides[urlStr] ?? null;
      if (body === null) {
        return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
      }
      const bodyStr: string = body;
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(bodyStr),
      } as unknown as Response;
    }
    // Default: return empty results for HN and Reddit.
    if (urlStr.includes("hn.algolia.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ hits: [] }),
      } as unknown as Response;
    }
    if (urlStr.includes("reddit.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { children: [] } }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("runIcpScrape", () => {
  it("returns empty result when KV has no seen items and sources return nothing", async () => {
    const kv = stubKv();
    const result = await runIcpScrape({
      kv,
      fetch: makeFetch(),
      tracer: stubTracer,
    });
    expect(result.newItems).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.sources).toEqual({});
  });

  it("stores new items in KV and counts them correctly", async () => {
    const kv = stubKv();
    // One HN story for the first query ("text+to+sql") + one Reddit post.
    const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("query=text+to+sql")) {
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(hnResponse("story-abc")),
        } as unknown as Response;
      }
      if (urlStr.includes("hn.algolia.com")) {
        return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
      }
      if (urlStr.includes("r/sideproject")) {
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(redditResponse("reddit-xyz")),
        } as unknown as Response;
      }
      if (urlStr.includes("reddit.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;

    const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });

    expect(result.newItems).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.sources["hn"]).toBe(1);
    expect(result.sources["reddit"]).toBe(1);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, ...unknown[]]
    >;

    // Both seen-keys should be written.
    expect(putCalls.some(([k]) => k.startsWith("icp:seen:hn:story-abc"))).toBe(true);
    expect(putCalls.some(([k]) => k.startsWith("icp:seen:reddit:reddit-xyz"))).toBe(true);

    // Both item-keys should be written.
    expect(putCalls.some(([k]) => k.includes("icp:item:") && k.includes(":hn:story-abc"))).toBe(
      true,
    );
    expect(
      putCalls.some(([k]) => k.includes("icp:item:") && k.includes(":reddit:reddit-xyz")),
    ).toBe(true);
  });

  it("skips already-seen items (dedup works)", async () => {
    // Pre-populate the seen-keys for both items.
    const kv = stubKv({
      "icp:seen:hn:story-abc": "1",
      "icp:seen:reddit:reddit-xyz": "1",
    });

    const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("query=text+to+sql")) {
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(hnResponse("story-abc")),
        } as unknown as Response;
      }
      if (urlStr.includes("hn.algolia.com")) {
        return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
      }
      if (urlStr.includes("r/sideproject")) {
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(redditResponse("reddit-xyz")),
        } as unknown as Response;
      }
      if (urlStr.includes("reddit.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;

    const initialPutCount = (kv.put as ReturnType<typeof vi.fn>).mock.calls.length;
    const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });

    expect(result.newItems).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.sources).toEqual({});
    // No new puts after construction.
    expect((kv.put as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialPutCount);
  });

  it("handles per-source fetch errors gracefully — one source fails, others succeed", async () => {
    const kv = stubKv();

    // HN always returns a network-level exception; Reddit returns a post.
    const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("hn.algolia.com")) {
        throw new Error("HN network failure");
      }
      if (urlStr.includes("r/sideproject")) {
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(redditResponse("reddit-ok")),
        } as unknown as Response;
      }
      if (urlStr.includes("reddit.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;

    const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });

    // Reddit item should still be stored.
    expect(result.sources["reddit"]).toBeGreaterThanOrEqual(1);
    expect(result.newItems).toBeGreaterThanOrEqual(1);
    // No HN items (source threw).
    expect(result.sources["hn"]).toBeUndefined();
  });

  it("respects the fetch override — no real network calls are made", async () => {
    const kv = stubKv();
    const customFetch = makeFetch();

    await runIcpScrape({ kv, fetch: customFetch, tracer: stubTracer });

    // Every network call should have gone through our stub, not global fetch.
    expect(customFetch).toHaveBeenCalled();
  });

  describe("Stack Exchange (Stack Overflow) source", () => {
    function seResponse(questionId: number) {
      return JSON.stringify({
        items: [
          {
            question_id: questionId,
            title: `SO Question ${questionId}`,
            body: "Why is Postgres setup so painful for a small project?",
            link: `https://stackoverflow.com/questions/${questionId}/why`,
            creation_date: Math.floor(Date.now() / 1000) - 3600,
            score: 7,
            tags: ["postgresql"],
          },
        ],
        quota_remaining: 299,
      });
    }

    it("fetches Stack Exchange questions and stores them with source=stackoverflow", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.stackexchange.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(seResponse(424242)),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });
      expect(result.sources["stackoverflow"]).toBeGreaterThanOrEqual(1);

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, ...unknown[]]
      >;
      expect(putCalls.some(([k]) => k.startsWith("icp:seen:stackoverflow:so-424242"))).toBe(true);
      expect(
        putCalls.some(([k]) => k.includes("icp:item:") && k.includes(":stackoverflow:so-424242")),
      ).toBe(true);
    });

    it("requests scoped by tag, site=stackoverflow, and fromdate (7-day window)", async () => {
      const kv = stubKv();
      const seenUrls: string[] = [];
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.stackexchange.com")) {
          seenUrls.push(urlStr);
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [] }),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });

      expect(seenUrls.length).toBeGreaterThan(0);
      for (const u of seenUrls) {
        expect(u).toContain("site=stackoverflow");
        expect(u).toContain("tagged=");
        expect(u).toMatch(/fromdate=\d+/);
        expect(u).toContain("sort=creation");
      }
    });

    it("handles Stack Exchange 502 error gracefully — other sources still complete", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.stackexchange.com")) {
          return { ok: false, status: 502, json: async () => ({}) } as unknown as Response;
        }
        if (urlStr.includes("query=text+to+sql")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(hnResponse("hn-x")),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });
      expect(result.sources["hn"]).toBeGreaterThanOrEqual(1);
      expect(result.sources["stackoverflow"]).toBeUndefined();
    });
  });

  describe("GitHub Issues source", () => {
    function ghSearchResponse(id: number) {
      return JSON.stringify({
        items: [
          {
            id,
            title: `GH Issue ${id}`,
            body: "I hate writing SQL queries for every new table",
            html_url: `https://github.com/org/repo/issues/${id}`,
            created_at: "2026-05-01T10:00:00Z",
          },
        ],
      });
    }

    it("fetches GitHub issues when ghToken is provided", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.github.com/search/issues")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(ghSearchResponse(9001)),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({
        kv,
        fetch: stubFetch,
        tracer: stubTracer,
        ghToken: "gh-test-token",
      });

      expect(result.sources["github"]).toBeGreaterThanOrEqual(1);
      expect(result.newItems).toBeGreaterThanOrEqual(1);

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, ...unknown[]]
      >;
      expect(putCalls.some(([k]) => k.includes(":github:"))).toBe(true);
    });

    it("skips GitHub source when ghToken is absent", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.github.com")) {
          throw new Error("Should not call GitHub without a token");
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      await expect(
        runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer }),
      ).resolves.not.toThrow();
    });

    it("handles GitHub 403 error gracefully — other sources still complete", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.github.com")) {
          return { ok: false, status: 403, json: async () => ({}) } as unknown as Response;
        }
        if (urlStr.includes("query=text+to+sql")) {
          return {
            ok: true,
            status: 200,
            json: async () =>
              JSON.parse(
                JSON.stringify({
                  hits: [
                    {
                      objectID: "hn-1",
                      title: "HN Story",
                      url: "https://example.com",
                      points: 5,
                      created_at_i: Math.floor(Date.now() / 1000) - 3600,
                    },
                  ],
                }),
              ),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({
        kv,
        fetch: stubFetch,
        tracer: stubTracer,
        ghToken: "gh-test-token",
      });

      // HN item should still have been stored despite GitHub failing.
      expect(result.sources["hn"]).toBeGreaterThanOrEqual(1);
      expect(result.sources["github"]).toBeUndefined();
    });

    it("sends a User-Agent header on every GitHub call (GitHub returns 403 without one)", async () => {
      const kv = stubKv();
      const seenHeaders: Array<Record<string, string>> = [];
      const stubFetch: typeof fetch = vi.fn(
        async (url: string | URL | Request, init?: { headers?: Record<string, string> }) => {
          const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
          if (urlStr.includes("api.github.com")) {
            seenHeaders.push(init?.headers ?? {});
            return {
              ok: true,
              status: 200,
              json: async () => JSON.parse(ghSearchResponse(7777)),
            } as unknown as Response;
          }
          if (urlStr.includes("hn.algolia.com")) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ hits: [] }),
            } as unknown as Response;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { children: [] } }),
          } as unknown as Response;
        },
      ) as unknown as typeof fetch;

      await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer, ghToken: "t" });

      expect(seenHeaders.length).toBeGreaterThan(0);
      for (const h of seenHeaders) {
        expect(h["User-Agent"]).toBeTruthy();
      }
    });

    it("skips GitHub issues whose created_at is unparseable (no NaN ts in KV)", async () => {
      const kv = stubKv();
      // Only the first GH query returns data; the rest return empty so we can
      // assert exactly which items make it past the NaN guard.
      let firstQueryServed = false;
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.github.com")) {
          if (firstQueryServed) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ items: [] }),
            } as unknown as Response;
          }
          firstQueryServed = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 1,
                  title: "Good issue",
                  html_url: "https://github.com/x/y/issues/1",
                  created_at: "2026-05-01T10:00:00Z",
                  body: "ok",
                },
                {
                  id: 2,
                  title: "Bad issue",
                  html_url: "https://github.com/x/y/issues/2",
                  created_at: "not-a-date",
                  body: "ok",
                },
              ],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({
        kv,
        fetch: stubFetch,
        tracer: stubTracer,
        ghToken: "t",
      });

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, string, ...unknown[]]
      >;
      const itemPuts = putCalls.filter(
        ([k]) => k.startsWith("icp:item:") && k.includes(":github:"),
      );
      expect(itemPuts.length).toBe(1);
      for (const [, value] of itemPuts) {
        const stored = JSON.parse(value) as { ts: number };
        expect(Number.isFinite(stored.ts)).toBe(true);
      }
      expect(result.sources["github"]).toBe(1);
    });
  });

  describe("Indie Hackers source", () => {
    function ihResponse(id: string, ageDays = 1) {
      const ts = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();
      return JSON.stringify({
        version: "https://jsonfeed.org/version/1",
        items: [
          {
            url: `https://feed.indiehackers.world/post/${id}`,
            title: `IH Post ${id}`,
            content_html: "<p>I'm a solo founder and database setup is killing my side project.</p>",
            date_modified: ts,
            author: { name: "Tester" },
          },
        ],
      });
    }

    it("fetches Indie Hackers posts and stores them with source=indiehackers", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("feed.indiehackers.world")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(ihResponse("a66b5fbe33")),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });
      expect(result.sources["indiehackers"]).toBeGreaterThanOrEqual(1);

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, ...unknown[]]
      >;
      expect(putCalls.some(([k]) => k.startsWith("icp:seen:indiehackers:a66b5fbe33"))).toBe(true);
      expect(
        putCalls.some(([k]) => k.includes("icp:item:") && k.includes(":indiehackers:a66b5fbe33")),
      ).toBe(true);
    });

    it("requests the IH feed with q=, exclude=link-post, and the IH bot User-Agent", async () => {
      const kv = stubKv();
      const seen: Array<{ url: string; headers: Record<string, string> }> = [];
      const stubFetch: typeof fetch = vi.fn(
        async (url: string | URL | Request, init?: { headers?: Record<string, string> }) => {
          const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
          if (urlStr.includes("feed.indiehackers.world")) {
            seen.push({ url: urlStr, headers: init?.headers ?? {} });
            return {
              ok: true,
              status: 200,
              json: async () => ({ items: [] }),
            } as unknown as Response;
          }
          if (urlStr.includes("hn.algolia.com")) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ hits: [] }),
            } as unknown as Response;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { children: [] } }),
          } as unknown as Response;
        },
      ) as unknown as typeof fetch;

      await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });

      expect(seen.length).toBeGreaterThan(0);
      for (const { url, headers } of seen) {
        expect(url).toMatch(/[?&]q=/);
        expect(url).toContain("exclude=link-post");
        expect(headers["User-Agent"]).toMatch(/nlqdb-icp-bot/);
      }
    });

    it("drops IH posts older than the 7-day window (client-side filter)", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("feed.indiehackers.world")) {
          // 30-day-old post — should be filtered out client-side because the
          // mirror has no fromdate parameter.
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(ihResponse("staleid", 30)),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });
      expect(result.sources["indiehackers"]).toBeUndefined();
    });

    it("drops IH posts whose URL does not match the /post/<id> contract", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("feed.indiehackers.world")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  // Malformed: no /post/<id> path — dedup id would be unstable.
                  url: "https://feed.indiehackers.world/something-else",
                  title: "Malformed URL",
                  date_modified: new Date().toISOString(),
                },
              ],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });
      expect(result.sources["indiehackers"]).toBeUndefined();
    });

    it("handles IH feed 502 gracefully — other sources still complete", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("feed.indiehackers.world")) {
          return { ok: false, status: 502, json: async () => ({}) } as unknown as Response;
        }
        if (urlStr.includes("query=text+to+sql")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(hnResponse("hn-y")),
          } as unknown as Response;
        }
        if (urlStr.includes("hn.algolia.com")) {
          return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
        } as unknown as Response;
      }) as unknown as typeof fetch;

      const result = await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });
      expect(result.sources["hn"]).toBeGreaterThanOrEqual(1);
      expect(result.sources["indiehackers"]).toBeUndefined();
    });
  });

  it("Reddit search URLs include restrict_sr=on so results stay subreddit-scoped", async () => {
    const kv = stubKv();
    const seenUrls: string[] = [];
    const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("reddit.com")) seenUrls.push(urlStr);
      if (urlStr.includes("hn.algolia.com")) {
        return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { children: [] } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer });

    expect(seenUrls.length).toBeGreaterThan(0);
    for (const u of seenUrls) {
      expect(u).toContain("restrict_sr=on");
    }
  });
});
