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

// App-only OAuth token response Reddit returns before any search (SK-ICP-011).
function redditTokenResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: "test-reddit-token", expires_in: 3600 }),
  } as unknown as Response;
}

// Reddit creds to exercise the OAuth path in tests.
const REDDIT_CREDS = { redditClientId: "test-id", redditClientSecret: "test-secret" };

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
      if (urlStr.includes("access_token")) return redditTokenResponse();
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

    const result = await runIcpScrape({
      kv,
      fetch: stubFetch,
      tracer: stubTracer,
      ...REDDIT_CREDS,
    });

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
      // Pre-seed a cached Reddit token so dedup asserts no extra writes.
      "icp:reddit:token": "test-reddit-token",
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
      if (urlStr.includes("access_token")) return redditTokenResponse();
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
    const result = await runIcpScrape({
      kv,
      fetch: stubFetch,
      tracer: stubTracer,
      ...REDDIT_CREDS,
    });

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
      if (urlStr.includes("access_token")) return redditTokenResponse();
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

    const result = await runIcpScrape({
      kv,
      fetch: stubFetch,
      tracer: stubTracer,
      ...REDDIT_CREDS,
    });

    // Reddit item should still be stored.
    expect(result.sources["reddit"]).toBeGreaterThanOrEqual(1);
    expect(result.newItems).toBeGreaterThanOrEqual(1);
    // No HN items (source threw).
    expect(result.sources["hn"]).toBeUndefined();
  });

  it("skips Reddit entirely when OAuth credentials are absent (SK-ICP-011)", async () => {
    const kv = stubKv();
    const fetcher = makeFetch();
    const result = await runIcpScrape({ kv, fetch: fetcher, tracer: stubTracer });

    // No credentials → no token call, no oauth.reddit.com search, no reddit items.
    const calledUrls = (fetcher as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => String(u));
    expect(calledUrls.some((u) => u.includes("access_token"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("oauth.reddit.com"))).toBe(false);
    expect(result.sources["reddit"]).toBeUndefined();
  });

  it("fetches Reddit via oauth.reddit.com with a bearer token (SK-ICP-011)", async () => {
    const kv = stubKv();
    const calls: Array<{ url: string; auth?: string }> = [];
    const stubFetch: typeof fetch = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        calls.push({
          url: urlStr,
          auth: (init?.headers as Record<string, string>)?.["Authorization"],
        });
        if (urlStr.includes("access_token")) return redditTokenResponse();
        if (urlStr.includes("r/sideproject")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(redditResponse("reddit-oauth")),
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
      },
    ) as unknown as typeof fetch;

    const result = await runIcpScrape({
      kv,
      fetch: stubFetch,
      tracer: stubTracer,
      ...REDDIT_CREDS,
    });

    expect(result.sources["reddit"]).toBeGreaterThanOrEqual(1);
    // Token minted once via Basic auth; searches hit oauth host with a bearer.
    expect(calls.some((c) => c.url.includes("access_token") && c.auth?.startsWith("Basic "))).toBe(
      true,
    );
    const search = calls.find((c) => c.url.includes("oauth.reddit.com/r/sideproject"));
    expect(search?.auth).toBe("Bearer test-reddit-token");
  });

  it("caches the Reddit token in KV and reuses it across the run (SK-ICP-011)", async () => {
    const kv = stubKv();
    let tokenCalls = 0;
    const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("access_token")) {
        tokenCalls++;
        return redditTokenResponse();
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

    await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer, ...REDDIT_CREDS });
    // 16 subreddit searches in the run, but only one token mint.
    expect(tokenCalls).toBe(1);
    expect(await kv.get("icp:reddit:token")).toBe("test-reddit-token");
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

  describe("GitHub Discussions source", () => {
    function ghDiscussionResponse(nodeId: string, ageHours = 2) {
      const ts = new Date(Date.now() - ageHours * 3600 * 1000).toISOString();
      return JSON.stringify({
        data: {
          search: {
            edges: [
              {
                node: {
                  id: nodeId,
                  title: `GH Discussion ${nodeId}`,
                  url: `https://github.com/owner/repo/discussions/${nodeId.slice(-3)}`,
                  body: "How are people wiring up agent memory on Postgres for production?",
                  createdAt: ts,
                },
              },
            ],
          },
          rateLimit: { remaining: 4999 },
        },
      });
    }

    function isGhGraphql(urlStr: string): boolean {
      return urlStr.endsWith("api.github.com/graphql");
    }

    it("fetches GitHub Discussions via POST /graphql when ghToken is provided", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (isGhGraphql(urlStr)) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(ghDiscussionResponse("D_kw_test_1")),
          } as unknown as Response;
        }
        if (urlStr.includes("api.github.com/search/issues")) {
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

      const result = await runIcpScrape({
        kv,
        fetch: stubFetch,
        tracer: stubTracer,
        ghToken: "gh-test-token",
      });

      expect(result.sources["github_discussions"]).toBeGreaterThanOrEqual(1);

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, ...unknown[]]
      >;
      expect(putCalls.some(([k]) => k === "icp:seen:github_discussions:ghd-D_kw_test_1")).toBe(
        true,
      );
      expect(
        putCalls.some(
          ([k]) => k.startsWith("icp:item:") && k.endsWith(":github_discussions:ghd-D_kw_test_1"),
        ),
      ).toBe(true);
    });

    it("sends POST with Bearer token, bot User-Agent, and a `created:>` date filter", async () => {
      const kv = stubKv();
      const seen: Array<{
        method?: string;
        headers: Record<string, string>;
        body: string;
      }> = [];
      const stubFetch: typeof fetch = vi.fn(
        async (
          url: string | URL | Request,
          init?: { method?: string; headers?: Record<string, string>; body?: string },
        ) => {
          const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
          if (isGhGraphql(urlStr)) {
            seen.push({
              method: init?.method,
              headers: init?.headers ?? {},
              body: init?.body ?? "",
            });
            return {
              ok: true,
              status: 200,
              json: async () => ({ data: { search: { edges: [] } } }),
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

      await runIcpScrape({
        kv,
        fetch: stubFetch,
        tracer: stubTracer,
        ghToken: "gh-test-token",
      });

      expect(seen.length).toBeGreaterThan(0);
      for (const { method, headers, body } of seen) {
        expect(method).toBe("POST");
        expect(headers["Authorization"]).toBe("Bearer gh-test-token");
        expect(headers["User-Agent"]).toMatch(/nlqdb-icp-bot/);
        expect(headers["Content-Type"]).toBe("application/json");
        expect(body).toContain("DISCUSSION");
        expect(body).toMatch(/created:>\d{4}-\d{2}-\d{2}/);
      }
    });

    it("skips GitHub Discussions when ghToken is absent (no GraphQL call made)", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (isGhGraphql(urlStr)) {
          throw new Error("Should not call GitHub Discussions without a token");
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

    it("treats a GraphQL `errors` body as a soft failure — other sources still complete", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (isGhGraphql(urlStr)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ errors: [{ message: "rate limit exceeded" }] }),
          } as unknown as Response;
        }
        if (urlStr.includes("query=text+to+sql")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(hnResponse("hn-ghd-fail")),
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
      expect(result.sources["hn"]).toBeGreaterThanOrEqual(1);
      expect(result.sources["github_discussions"]).toBeUndefined();
    });

    it("drops discussions whose createdAt is unparseable (no NaN ts in KV)", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (isGhGraphql(urlStr)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                search: {
                  edges: [
                    {
                      node: {
                        id: "D_kw_bad_date",
                        title: "Bad date",
                        url: "https://github.com/x/y/discussions/1",
                        body: null,
                        createdAt: "not-a-date",
                      },
                    },
                  ],
                },
              },
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
        ghToken: "gh-test-token",
      });
      expect(result.sources["github_discussions"]).toBeUndefined();
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
            content_html:
              "<p>I'm a solo founder and database setup is killing my side project.</p>",
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

  describe("Dev.to source", () => {
    function devtoResponse(id: number) {
      return JSON.stringify([
        {
          id,
          title: `Dev.to Article ${id}`,
          description: "I keep wiring up Postgres for every side project and it's killing me.",
          url: `https://dev.to/tester/devto-article-${id}-abc`,
          published_timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
          public_reactions_count: 42,
          tag_list: ["database", "sql"],
        },
      ]);
    }

    it("fetches Dev.to articles and stores them with source=devto and id=devto-<id>", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("dev.to/api/articles")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(devtoResponse(3718736)),
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
      expect(result.sources["devto"]).toBeGreaterThanOrEqual(1);

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, ...unknown[]]
      >;
      expect(putCalls.some(([k]) => k === "icp:seen:devto:devto-3718736")).toBe(true);
      expect(
        putCalls.some(([k]) => k.startsWith("icp:item:") && k.endsWith(":devto:devto-3718736")),
      ).toBe(true);
    });

    it("requests Dev.to with the bot User-Agent and the top=7 server-side 7-day filter", async () => {
      const kv = stubKv();
      const seen: Array<{ url: string; headers: Record<string, string> }> = [];
      const stubFetch: typeof fetch = vi.fn(
        async (url: string | URL | Request, init?: { headers?: Record<string, string> }) => {
          const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
          if (urlStr.includes("dev.to/api/articles")) {
            seen.push({ url: urlStr, headers: init?.headers ?? {} });
            return { ok: true, status: 200, json: async () => [] } as unknown as Response;
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
        expect(url).toMatch(/[?&]tag=/);
        expect(url).toContain("top=7");
        expect(headers["User-Agent"]).toMatch(/nlqdb-icp-bot/);
      }
    });

    it("drops Dev.to articles whose published_timestamp is unparseable", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("dev.to/api/articles")) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 999,
                title: "Bad date",
                url: "https://dev.to/x/y-999",
                published_timestamp: "not-a-date",
                public_reactions_count: 0,
                tag_list: [],
              },
            ],
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
      expect(result.sources["devto"]).toBeUndefined();
    });

    it("handles Dev.to 503 gracefully — other sources still complete", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("dev.to/api/articles")) {
          return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
        }
        if (urlStr.includes("query=text+to+sql")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(hnResponse("hn-devto-fail")),
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
      expect(result.sources["devto"]).toBeUndefined();
    });
  });

  describe("Bluesky source", () => {
    function bskyResponse(cid: string, handle = "alice.bsky.social", rkey = "3kabcdef123") {
      return JSON.stringify({
        posts: [
          {
            uri: `at://did:plc:fakedid/app.bsky.feed.post/${rkey}`,
            cid,
            author: { handle },
            record: {
              $type: "app.bsky.feed.post",
              text: "My text-to-SQL agent forgets schema across turns; anyone hit this?",
              createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
            },
            likeCount: 7,
            replyCount: 2,
            repostCount: 1,
          },
        ],
        cursor: "next-cursor",
      });
    }

    it("fetches Bluesky posts and stores them with source=bluesky and id=bsky-<cid>", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.bsky.app")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(bskyResponse("bafycid123")),
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
      expect(result.sources["bluesky"]).toBeGreaterThanOrEqual(1);

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, ...unknown[]]
      >;
      expect(putCalls.some(([k]) => k === "icp:seen:bluesky:bsky-bafycid123")).toBe(true);
      const itemCall = putCalls.find(
        ([k]) => k.startsWith("icp:item:") && k.endsWith(":bluesky:bsky-bafycid123"),
      );
      expect(itemCall).toBeDefined();
      const stored = JSON.parse(itemCall?.[1] as string);
      expect(stored.url).toBe("https://bsky.app/profile/alice.bsky.social/post/3kabcdef123");
      expect(stored.score).toBe(7);
    });

    it("requests Bluesky with sort=latest, a since=<7d> filter, and the bot User-Agent", async () => {
      const kv = stubKv();
      const seen: Array<{ url: string; headers: Record<string, string> }> = [];
      const stubFetch: typeof fetch = vi.fn(
        async (url: string | URL | Request, init?: { headers?: Record<string, string> }) => {
          const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
          if (urlStr.includes("api.bsky.app")) {
            seen.push({ url: urlStr, headers: init?.headers ?? {} });
            return {
              ok: true,
              status: 200,
              json: async () => ({ posts: [] }),
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
      const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const { url, headers } of seen) {
        expect(url).toMatch(/[?&]q=/);
        expect(url).toContain("limit=25");
        expect(url).toContain("sort=latest");
        expect(url).toMatch(/[?&]since=/);
        expect(headers["User-Agent"]).toMatch(/nlqdb-icp-bot/);

        // since= value must be within 60s of seven-days-ago to confirm the rolling window.
        const m = url.match(/[?&]since=([^&]+)/);
        const sinceMs = m ? Date.parse(decodeURIComponent(m[1] ?? "")) : NaN;
        expect(Math.abs(sinceMs - sevenDaysAgoMs)).toBeLessThan(60_000);
      }
    });

    it("short-circuits the remaining queries after the AppView returns 429", async () => {
      const kv = stubKv();
      let bskyCalls = 0;
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.bsky.app")) {
          bskyCalls++;
          return { ok: false, status: 429, json: async () => ({}) } as unknown as Response;
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

      // 5 queries are configured; only the first one should hit the wire after a 429.
      expect(bskyCalls).toBe(1);
    });

    it("drops Bluesky posts whose record.createdAt is unparseable", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.bsky.app")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              posts: [
                {
                  uri: "at://did:plc:x/app.bsky.feed.post/badtime",
                  cid: "bafycid-bad",
                  author: { handle: "x.bsky.social" },
                  record: { text: "hi", createdAt: "not-a-date" },
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
      expect(result.sources["bluesky"]).toBeUndefined();
    });

    it("drops Bluesky posts whose uri does not match the app.bsky.feed.post contract", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.bsky.app")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              posts: [
                {
                  uri: "at://did:plc:x/app.bsky.feed.repost/abc",
                  cid: "bafycid-repost",
                  author: { handle: "x.bsky.social" },
                  record: { text: "hi", createdAt: new Date().toISOString() },
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
      expect(result.sources["bluesky"]).toBeUndefined();
    });

    it("handles Bluesky 503 gracefully — other sources still complete", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("api.bsky.app")) {
          return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
        }
        if (urlStr.includes("query=text+to+sql")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(hnResponse("hn-bsky-fail")),
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
      expect(result.sources["bluesky"]).toBeUndefined();
    });
  });

  describe("Mastodon source", () => {
    function mastodonResponse(
      id: string,
      content = "<p>my <em>postgres</em> setup is painful</p>",
    ) {
      return JSON.stringify([
        {
          id,
          url: `https://mastodon.social/@dev/statuses/${id}`,
          created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
          content,
          favourites_count: 4,
          sensitive: false,
        },
      ]);
    }

    it("fetches Mastodon posts, strips HTML, and stores them with source=mastodon and id=mast-<id>", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("mastodon.social/api/v1/timelines/tag")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "x-ratelimit-remaining": "299" }),
            json: async () => JSON.parse(mastodonResponse("116690000000000001")),
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
      expect(result.sources["mastodon"]).toBeGreaterThanOrEqual(1);

      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, ...unknown[]]
      >;
      expect(putCalls.some(([k]) => k === "icp:seen:mastodon:mast-116690000000000001")).toBe(true);
      const itemCall = putCalls.find(
        ([k]) => k.startsWith("icp:item:") && k.endsWith(":mastodon:mast-116690000000000001"),
      );
      expect(itemCall).toBeDefined();
      const stored = JSON.parse(itemCall?.[1] as string);
      // HTML tags must be stripped from the stored text — the LLM scoring pass
      // sees plain language, never <p>/<em>/<a> markup leaking through.
      expect(stored.text).toBe("my postgres setup is painful");
      expect(stored.title).toBe("my postgres setup is painful");
      expect(stored.url).toBe("https://mastodon.social/@dev/statuses/116690000000000001");
      expect(stored.score).toBe(4);
    });

    it("requests Mastodon with limit=25, local=false, and the bot User-Agent", async () => {
      const kv = stubKv();
      const seen: Array<{ url: string; headers: Record<string, string> }> = [];
      const stubFetch: typeof fetch = vi.fn(
        async (url: string | URL | Request, init?: { headers?: Record<string, string> }) => {
          const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
          if (urlStr.includes("mastodon.social/api/v1/timelines/tag")) {
            seen.push({ url: urlStr, headers: init?.headers ?? {} });
            return {
              ok: true,
              status: 200,
              headers: new Headers(),
              json: async () => [],
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
        expect(url).toContain("limit=25");
        expect(url).toContain("local=false");
        expect(headers["User-Agent"]).toMatch(/nlqdb-icp-bot/);
        // Tag path-segment encoded — never raw whitespace, never query-string injection.
        expect(url).toMatch(/\/timelines\/tag\/[a-zA-Z0-9%]+\?/);
      }
    });

    it("short-circuits the remaining queries after a 429 from Mastodon", async () => {
      const kv = stubKv();
      let mastCalls = 0;
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("mastodon.social/api/v1/timelines/tag")) {
          mastCalls++;
          return {
            ok: false,
            status: 429,
            headers: new Headers({ "x-ratelimit-remaining": "0" }),
            json: async () => ({}),
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

      // 5 tags are configured; only the first one hits the wire on a 429.
      expect(mastCalls).toBe(1);
    });

    it("drops Mastodon posts older than the rolling 7-day window", async () => {
      const kv = stubKv();
      const eightDaysAgoIso = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("mastodon.social/api/v1/timelines/tag")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => [
              {
                id: "old-1",
                url: "https://mastodon.social/@x/statuses/old-1",
                created_at: eightDaysAgoIso,
                content: "<p>old pain</p>",
                favourites_count: 1,
              },
            ],
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
      expect(result.sources["mastodon"]).toBeUndefined();
    });

    it("drops Mastodon posts flagged sensitive (NSFW) — evidence file is product-public", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("mastodon.social/api/v1/timelines/tag")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => [
              {
                id: "nsfw-1",
                url: "https://mastodon.social/@x/statuses/nsfw-1",
                created_at: new Date().toISOString(),
                content: "<p>still pain about sql</p>",
                favourites_count: 0,
                sensitive: true,
              },
            ],
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
      expect(result.sources["mastodon"]).toBeUndefined();
    });

    it("handles Mastodon 503 gracefully — other sources still complete", async () => {
      const kv = stubKv();
      const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("mastodon.social/api/v1/timelines/tag")) {
          return {
            ok: false,
            status: 503,
            headers: new Headers(),
            json: async () => ({}),
          } as unknown as Response;
        }
        if (urlStr.includes("query=text+to+sql")) {
          return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(hnResponse("hn-mast-fail")),
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
      expect(result.sources["mastodon"]).toBeUndefined();
    });
  });

  it("Reddit search URLs include restrict_sr=on so results stay subreddit-scoped", async () => {
    const kv = stubKv();
    const seenUrls: string[] = [];
    const stubFetch: typeof fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("access_token")) return redditTokenResponse();
      if (urlStr.includes("oauth.reddit.com")) seenUrls.push(urlStr);
      if (urlStr.includes("hn.algolia.com")) {
        return { ok: true, status: 200, json: async () => ({ hits: [] }) } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { children: [] } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await runIcpScrape({ kv, fetch: stubFetch, tracer: stubTracer, ...REDDIT_CREDS });

    expect(seenUrls.length).toBeGreaterThan(0);
    for (const u of seenUrls) {
      expect(u).toContain("restrict_sr=on");
    }
  });
});
