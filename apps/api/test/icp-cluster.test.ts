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
  // SK-ICP-014: an empty scored set now writes a starvation-marked evidence
  // file (with the last scrape's per-source counts) instead of silently
  // returning nothing, and marks the result `starved: true`.
  it("writes a starvation evidence file with per-source scrape counts when the scored set is empty", async () => {
    const stats = {
      ts: Date.UTC(2026, 6, 13), // 2026-07-13
      newItems: 0,
      skipped: 12,
      sources: { hn: 0, github: 0, mastodon: 0 },
      skippedSources: ["reddit"],
    };
    const kv = stubKv({ "icp:last_scrape_stats": JSON.stringify(stats) });

    let putBody: string | undefined;
    const fetcher = vi.fn(
      async (url: string | URL | Request, opts?: { method?: string; body?: string }) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("github.com")) {
          if (opts?.method === "PUT") {
            const b = JSON.parse(opts.body ?? "{}") as { content?: string };
            putBody = b.content ? atob(b.content) : undefined;
            return makeGhPutResponse();
          }
          return makeGhNotFound();
        }
        return new Response("{}", { status: 200 });
      },
    ) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", fetch: fetcher });

    expect(result.starved).toBe(true);
    expect(result.written).toBe(true);
    expect(result.clustered).toBe(0);
    expect(result.primaryStatus).toBe("no_signal");

    expect(putBody).toContain("PIPELINE STARVED");
    expect(putBody).toContain("Starvation notice");
    // atob yields a Latin-1 string, so assert on the ASCII fragments only
    // (the em-dash before the date does not round-trip through atob).
    expect(putBody).toContain("Most recent scrape");
    expect(putBody).toContain("2026-07-13");
    expect(putBody).toContain("| hn | 0 |");
    expect(putBody).toContain("Sources self-skipped for missing env keys: reddit.");
  });

  it("writes a starvation file noting absent scrape stats when none recorded", async () => {
    const kv = stubKv(); // no icp:last_scrape_stats key

    let putBody: string | undefined;
    const fetcher = vi.fn(
      async (url: string | URL | Request, opts?: { method?: string; body?: string }) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("github.com")) {
          if (opts?.method === "PUT") {
            const b = JSON.parse(opts.body ?? "{}") as { content?: string };
            putBody = b.content ? atob(b.content) : undefined;
            return makeGhPutResponse();
          }
          return makeGhNotFound();
        }
        return new Response("{}", { status: 200 });
      },
    ) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", fetch: fetcher });

    expect(result.starved).toBe(true);
    expect(result.written).toBe(true);
    expect(putBody).toContain("No scrape statistics recorded yet");
  });

  it("marks starved when list returns keys but all values are missing (TTL expired)", async () => {
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

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", fetch: fetcher });
    expect(result.starved).toBe(true);
    expect(result.written).toBe(true);
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

  it("sends User-Agent header on every GitHub call (REST API rejects no-UA with 403)", async () => {
    const item = makeScored("ua1");
    const kv = stubKv({ "icp:scored:20260522:hn:ua1": JSON.stringify(item) });

    const fetcher = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes("groq.com")) return makeClusterResponse(CLUSTER_PAYLOAD);
      if (urlStr.includes("github.com")) {
        if (opts?.method === "PUT") return makeGhPutResponse();
        return makeGhNotFound();
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher });

    const ghCalls = (fetcher as ReturnType<typeof vi.fn>).mock.calls.filter((args) => {
      const u = args[0];
      const s = typeof u === "string" ? u : (u as URL | Request).toString();
      return s.includes("github.com");
    });
    expect(ghCalls.length).toBeGreaterThanOrEqual(2); // GET + PUT
    for (const call of ghCalls) {
      const opts = call[1] as { headers?: Record<string, string> } | undefined;
      expect(opts?.headers?.["User-Agent"]).toBeDefined();
    }
  });

  it("§2.4 verdict: confirms primary when one persona ≥3× runner-up and ≥30 quotes", async () => {
    // 35 P1 items + 5 P2 items → P1 weight 35*8 = 280, P2 weight 5*7 = 35; ratio 8× → confirmed.
    const scored: Record<string, string> = {};
    for (let i = 0; i < 35; i++) {
      scored[`icp:scored:20260522:hn:p1-${i}`] = JSON.stringify(makeScored(`p1-${i}`, "p1"));
    }
    for (let i = 0; i < 5; i++) {
      scored[`icp:scored:20260522:hn:p2-${i}`] = JSON.stringify(makeScored(`p2-${i}`, "p2"));
    }
    const kv = stubKv(scored);

    let written: string | undefined;
    const fetcher = vi.fn(
      async (url: string | URL | Request, opts?: { method?: string; body?: string }) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("groq.com")) return makeClusterResponse(CLUSTER_PAYLOAD);
        if (urlStr.includes("github.com")) {
          if (opts?.method === "PUT") {
            const body = JSON.parse(opts.body ?? "{}") as { content?: string };
            written = body.content ? atob(body.content) : undefined;
            return makeGhPutResponse();
          }
          return makeGhNotFound();
        }
        return new Response("{}", { status: 200 });
      },
    ) as unknown as typeof fetch;

    const result = await runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher });

    expect(result.primaryStatus).toBe("primary_confirmed");
    expect(result.primaryIcp).toContain("P1");
    expect(written).toBeDefined();
    expect(written).toContain("Primary ICP confirmed");
    expect(written).toContain("§2.4 Decision rule");
  });

  it("§2.4 verdict: directional when leader has <30 quotes", async () => {
    const item = makeScored("d1");
    const kv = stubKv({ "icp:scored:20260522:hn:d1": JSON.stringify(item) });

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
    expect(result.primaryStatus).toBe("directional");
    expect(result.primaryIcp).toContain("P1");
  });

  it("clamps LLM-hallucinated cluster.count to the input item count", async () => {
    // Single input item but LLM claims count=999 in the cluster.
    const item = makeScored("c1");
    const kv = stubKv({ "icp:scored:20260522:hn:c1": JSON.stringify(item) });

    let writtenMd: string | undefined;
    const inflatedCluster = [{ ...CLUSTER_PAYLOAD[0], count: 999 }];
    const fetcher = vi.fn(
      async (url: string | URL | Request, opts?: { method?: string; body?: string }) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (urlStr.includes("groq.com")) return makeClusterResponse(inflatedCluster);
        if (urlStr.includes("github.com")) {
          if (opts?.method === "PUT") {
            const b = JSON.parse(opts.body ?? "{}") as { content?: string };
            writtenMd = b.content ? atob(b.content) : undefined;
            return makeGhPutResponse();
          }
          return makeGhNotFound();
        }
        return new Response("{}", { status: 200 });
      },
    ) as unknown as typeof fetch;

    await runIcpCluster({ kv, ghToken: "tok", groqApiKey: "gq", fetch: fetcher });
    expect(writtenMd).toBeDefined();
    expect(writtenMd).not.toContain("| 999 |"); // hallucinated count must not appear
    expect(writtenMd).toContain("| 1 |"); // clamped to the actual item count
  });
});
