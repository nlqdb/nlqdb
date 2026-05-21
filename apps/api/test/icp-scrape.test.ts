// Unit tests for the ICP pain-signal scraper — verifies dedup, storage,
// and error-resilience without any real network calls.

import type { Span } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { runIcpScrape, type IcpScrapeDeps } from "../src/icp-scrape.ts";

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
      return { ok: true, status: 200, json: async () => JSON.parse(bodyStr) } as unknown as Response;
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

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls as Array<[string, ...unknown[]]>;

    // Both seen-keys should be written.
    expect(putCalls.some(([k]) => k.startsWith("icp:seen:hn:story-abc"))).toBe(true);
    expect(putCalls.some(([k]) => k.startsWith("icp:seen:reddit:reddit-xyz"))).toBe(true);

    // Both item-keys should be written.
    expect(putCalls.some(([k]) => k.includes("icp:item:") && k.includes(":hn:story-abc"))).toBe(true);
    expect(putCalls.some(([k]) => k.includes("icp:item:") && k.includes(":reddit:reddit-xyz"))).toBe(true);
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
});
