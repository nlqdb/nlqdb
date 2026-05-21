// Unit tests for the ICP scoring pipeline (SK-ICP-002).
// Verifies: pain-word prefilter, LLM call + parse, Gemini fallback,
// relevance floor, graceful handling of malformed LLM responses.

import { describe, expect, it, vi } from "vitest";
import type { IcpItem } from "../src/icp-scrape.ts";
import { runIcpScore } from "../src/icp-score.ts";

function makeItem(overrides: Partial<IcpItem> = {}): IcpItem {
  return {
    id: "abc123",
    source: "hn",
    title: "I hate writing SQL for every new project",
    url: "https://news.ycombinator.com/item?id=abc123",
    text: "Spent hours on migrations again",
    score: 10,
    ts: 1_700_000_000,
    ...overrides,
  };
}

function stubKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    delete: vi.fn(),
  } as unknown as KVNamespace;
}

function groqResponse(results: object[]): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ results }) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function geminiResponse(results: object[]): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: JSON.stringify({ results }) }] } },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("runIcpScore", () => {
  it("returns zero counts for empty items", async () => {
    const result = await runIcpScore([], {
      kv: stubKv(),
      groqApiKey: "key",
    });
    expect(result).toEqual({ scored: 0, skipped: 0, stored: 0 });
  });

  it("skips items that don't match the pain regex", async () => {
    const neutral = makeItem({ title: "New project announcement", text: "Launching soon" });
    const result = await runIcpScore([neutral], { kv: stubKv(), groqApiKey: "key" });
    expect(result.scored).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.stored).toBe(0);
  });

  it("scores items via Groq and stores those above the relevance floor", async () => {
    const kv = stubKv();
    const scores = [{ id: "abc123", p1: 8, p2: 2, p3: 1, p6: 0, quote: "hate writing SQL" }];
    const fetcher = vi.fn().mockResolvedValue(groqResponse(scores));

    const result = await runIcpScore([makeItem()], {
      kv,
      groqApiKey: "test-key",
      fetch: fetcher,
    });

    expect(result.scored).toBe(1);
    expect(result.stored).toBe(1);
    expect(kv.put).toHaveBeenCalledOnce();
    const call = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(call[0]).toMatch(/^icp:scored:/);
    expect(JSON.parse(call[1])).toMatchObject({ p1: 8, quote: "hate writing SQL" });
  });

  it("falls back to Gemini when Groq fails", async () => {
    const kv = stubKv();
    const scores = [{ id: "abc123", p1: 7, p2: 0, p3: 0, p6: 0, quote: "painful migrations" }];
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("groq network error"))
      .mockResolvedValueOnce(geminiResponse(scores));

    const result = await runIcpScore([makeItem()], {
      kv,
      groqApiKey: "groq-key",
      geminiApiKey: "gemini-key",
      fetch: fetcher,
    });

    expect(result.stored).toBe(1);
  });

  it("does not store items where all persona scores are below the relevance floor", async () => {
    const kv = stubKv();
    const scores = [{ id: "abc123", p1: 2, p2: 1, p3: 0, p6: 3, quote: "" }];
    const fetcher = vi.fn().mockResolvedValue(groqResponse(scores));

    const result = await runIcpScore([makeItem()], {
      kv,
      groqApiKey: "test-key",
      fetch: fetcher,
    });

    expect(result.stored).toBe(0);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("handles malformed LLM response without throwing", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("not json at all {{", { status: 200 }),
    );

    await expect(
      runIcpScore([makeItem()], { kv: stubKv(), groqApiKey: "key", fetch: fetcher }),
    ).resolves.not.toThrow();
  });

  it("returns skipped=all when no LLM key is provided and items pass prefilter", async () => {
    const result = await runIcpScore([makeItem()], { kv: stubKv() });
    expect(result.scored).toBe(0);
    expect(result.stored).toBe(0);
  });
});
