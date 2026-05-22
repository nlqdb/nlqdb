// Unit tests for SK-ICP-003 (ICP evidence-file generator — runIcpCluster).

import { describe, expect, it, vi } from "vitest";
import { runIcpCluster } from "../src/icp-cluster.ts";
import type { IcpScoredItem } from "../src/icp-score.ts";

// --- Stubs ---

function makeScored(id: string, persona: "p1" | "p2" | "p3" | "p6" = "p1"): IcpScoredItem {
  return {
    source: "hn",
    id,
    url: `https://example.com/${id}`,
    title: `Pain post ${id}`,
    ts: 1_748_000_000,
    p1: persona === "p1" ? 8 : 1,
    p2: persona === "p2" ? 7 : 1,
    p3: persona === "p3" ? 7 : 1,
    p6: persona === "p6" ? 6 : 1,
    quote: "hate writing SQL migrations",
  };
}

function stubKv(scored: Record<string, string> = {}): KVNamespace {
  return {
    put: vi.fn(),
    get: vi.fn(async (k: string) => scored[k] ?? null),
    delete: vi.fn(),
    list: vi.fn(async ({ prefix = "" }: { prefix?: string } = {}) => ({
      keys: Object.keys(scored)
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
      cursor: undefined,
      cacheStatus: null,
    })),
  } as unknown as KVNamespace;
}

function makeClusterResponse(clusters: object[]): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ clusters }) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function makeGhGetResponse(sha: string): Response {
  return new Response(JSON.stringify({ sha, name: "icp-evidence-2026-05.md" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeGhNotFound(): Response {
  return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
}

function makeGhPutResponse(): Response {
  return new Response(JSON.stringify({ content: { sha: "newsha123" } }), { status: 201 });
}

const CLUSTER_PAYLOAD = [
  {
    label: "SQL migration pain",
    description: "Developers frustrated by ORM migrations",
    count: 5,
    best_quote: "spent hours on a trivial migration",
    top_urls: ["https://example.com/1"],
  },
];

// --- Tests ---

describe("runIcpCluster", () => {
  it("returns written=false immediately for empty KV", async () => {
    const kv = stubKv();
    const result = await runIcpCluster({ kv, ghToken: "tok" });
    expect(result).toEqual({ personaItems: {}, clustered: 0, written: false });
  });

  it("returns written=false when all KV values are missing after listing", async () => {
    // list returns keys but get returns null (TTL expired between list and get).
    const kv = {
      list: vi.fn(async () => ({
        keys: [{ name: "icp:scored:20260522:hn:x1" }],
        list_complete: true,
      })),
      get: vi.fn(async () => null),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as KVNamespace;

    const result = await runIcpCluster({ kv, ghToken: "tok" });
    expect(result.written).toBe(false);
    expect(result.clustered).toBe(0);
  });

  it("returns written=false when no LLM key is set", async () => {
    const item = makeScored("a1");
    const kv = stubKv({ "icp:scored:20260522:hn:a1": JSON.stringify(item) });
    const fetcher = vi.fn();
    const result = await runIcpCluster({ kv, ghToken: "tok", fetch: fetcher });
    expect(result.clustered).toBe(0);
    expect(result.written).toBe(false);
  });

  it("writes evidence file to GitHub for new file (no existing SHA)", async () => {
    const item = makeScored("b1");
    const kv = stubKv({ "icp:scored:20260522:hn:b1": JSON.stringify(item) });

    const fetcher = vi.fn(
      async (url: string | URL | Request, opts?: { method?: string; body?: string }) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("groq.com")) return makeClusterResponse(CLUSTER_PAYLOAD);
        if (urlStr.includes("github.com")) {
          if (opts?.method === "PUT") return makeGhPutResponse();
          return makeGhNotFound();
        }
        return new Response("{}", { status: 200 });
      },
    ) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher });

    expect(result.written).toBe(true);
    expect(result.clustered).toBeGreaterThan(0);
    expect(result.personaItems["p1"]).toBe(1);

    const allCalls = (fetcher as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, { method?: string; body?: string }]
    >;
    const putCall = allCalls.find(
      ([u, opts]) => typeof u === "string" && u.includes("github.com") && opts?.method === "PUT",
    ) as [string, { method?: string; body?: string }] | undefined;

    expect(putCall).toBeDefined();
    const rawBody = putCall?.[1].body ?? "{}";
    const body = JSON.parse(rawBody) as { sha?: string; content?: string };
    expect(body.sha).toBeUndefined(); // new file — no SHA
    expect(typeof body.content).toBe("string"); // base64 content present
  });

  it("includes existing SHA in PUT when file already exists", async () => {
    const item = makeScored("c1");
    const kv = stubKv({ "icp:scored:20260522:hn:c1": JSON.stringify(item) });

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("groq.com")) return makeClusterResponse(CLUSTER_PAYLOAD);
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhGetResponse("existingsha456");
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher });

    const putCall = (fetcher as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => (args[1] as { method?: string } | undefined)?.method === "PUT",
    ) as [string, { body?: string }] | undefined;

    const rawBody = putCall?.[1].body ?? "{}";
    const body = JSON.parse(rawBody) as { sha?: string };
    expect(body.sha).toBe("existingsha456");
    expect(result.written).toBe(true);
  });

  it("returns written=false when GitHub write fails, without throwing", async () => {
    const item = makeScored("d1");
    const kv = stubKv({ "icp:scored:20260522:hn:d1": JSON.stringify(item) });

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("groq.com")) return makeClusterResponse(CLUSTER_PAYLOAD);
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return new Response("Forbidden", { status: 403 });
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher });
    expect(result.written).toBe(false);
    expect(result.clustered).toBeGreaterThan(0); // clustering still succeeded
  });

  it("falls back to Gemini when Groq fails during clustering", async () => {
    const item = makeScored("e1");
    const kv = stubKv({ "icp:scored:20260522:hn:e1": JSON.stringify(item) });

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("groq.com")) return new Response("Service unavailable", { status: 503 });
      if (urlStr.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ clusters: CLUSTER_PAYLOAD }) }] } },
            ],
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runIcpCluster({
      kv,
      ghToken: "tok",
      groqApiKey: "gq",
      geminiApiKey: "gm",
      fetch: fetcher,
    });

    expect(result.clustered).toBeGreaterThan(0);
    expect(result.written).toBe(true);
  });

  it("does not retry Gemini when Gemini is the only provider and it fails", async () => {
    const item = makeScored("e2");
    const kv = stubKv({ "icp:scored:20260522:hn:e2": JSON.stringify(item) });
    let geminiCallCount = 0;

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("generativelanguage.googleapis.com")) {
        geminiCallCount++;
        return new Response("Service unavailable", { status: 503 });
      }
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runIcpCluster({
      kv,
      ghToken: "tok",
      geminiApiKey: "gm", // no groqApiKey — Gemini-only mode
      fetch: fetcher,
    });

    expect(geminiCallCount).toBe(1); // called once, not retried
    expect(result.clustered).toBe(0);
  });

  it("gracefully handles malformed LLM cluster JSON without throwing", async () => {
    const item = makeScored("f1");
    const kv = stubKv({ "icp:scored:20260522:hn:f1": JSON.stringify(item) });

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("groq.com")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "{{not json}}" } }] }),
          { status: 200 },
        );
      }
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await expect(
      runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher }),
    ).resolves.not.toThrow();
  });

  it("paginates KV list when list_complete=false", async () => {
    const item = makeScored("g1");
    let callCount = 0;
    const kv = {
      list: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            keys: [{ name: "icp:scored:20260522:hn:g1" }],
            list_complete: false,
            cursor: "cursor-page-2",
          };
        }
        return { keys: [], list_complete: true, cursor: undefined };
      }),
      get: vi.fn(async (k: string) => {
        if (k === "icp:scored:20260522:hn:g1") return JSON.stringify(item);
        return null;
      }),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as KVNamespace;

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("groq.com")) return makeClusterResponse(CLUSTER_PAYLOAD);
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher });

    expect(callCount).toBe(2); // two list pages
    expect(result.personaItems["p1"]).toBe(1);
  });

  it("sends LogSnag notification when credentials are provided", async () => {
    const item = makeScored("h1");
    const kv = stubKv({ "icp:scored:20260522:hn:h1": JSON.stringify(item) });

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("groq.com")) return makeClusterResponse(CLUSTER_PAYLOAD);
      if (urlStr.includes("logsnag.com")) return new Response("{}", { status: 200 });
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await runIcpCluster({
      kv,
      ghToken: "tok",
      groqApiKey: "gq",
      logsnagToken: "ls-token",
      logsnagProject: "nlqdb",
      fetch: fetcher,
    });

    const logsnagCall = (fetcher as ReturnType<typeof vi.fn>).mock.calls.find((args) => {
      const u = args[0];
      const urlStr = typeof u === "string" ? u : (u as URL | Request).toString();
      return urlStr.includes("logsnag.com");
    });
    expect(logsnagCall).toBeDefined();
  });
});
