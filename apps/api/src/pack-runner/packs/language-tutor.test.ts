// Unit tests for the language-tutor pack adapter — instance #2 of the
// shared runner (EK-04 / SK-EKP-004). Covers the four things this pack owns
// and can get wrong: naming its interview-session source, acquiring the
// transcript over an injected `fetch`, deciding which exchanges are eligible
// (with an honest reason), and mapping each exchange onto the exact
// `agent_memory_v1` vocabulary the language-tutor golden queries read —
// every episode kept, every fact carrying `source_episode` provenance.

import { describe, expect, it, vi } from "vitest";
import { guardSecretValues } from "../runner.ts";
import type { PackContext, SourceDescriptor, SourceItem } from "../types.ts";
import {
  exchangeRecords,
  type InterviewExchange,
  type InterviewTranscript,
  languageTutorPack,
  parseSessionRef,
} from "./language-tutor.ts";

const SOURCE: SourceDescriptor = {
  kind: "interview-session",
  ref: "interview session s-abc123",
  pin: "s-abc123",
  meta: { sessionId: "s-abc123" },
};

const NOOP_SPAN = {
  setAttribute() {},
  setStatus() {},
  recordException() {},
  end() {},
};

function ctx(fetch: typeof globalThis.fetch): PackContext {
  return {
    tracer: {
      startActiveSpan: (_n: string, f: (s: typeof NOOP_SPAN) => unknown) => f(NOOP_SPAN),
    } as never,
    fetch,
    limits: { maxItems: 20_000, maxItemBytes: 512 * 1024, maxTotalBytes: 24 * 1024 * 1024 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function item(exchange: InterviewExchange): SourceItem {
  const text = JSON.stringify(exchange);
  return { id: exchange.id, bytes: text.length, text };
}

// A two-exchange lesson debrief — one grammar mistake anchored on a rule, one
// pricing heuristic, and a bare exchange the interview extracted nothing from.
const EX_1: InterviewExchange = {
  id: "ex-1",
  role: "lesson",
  episode: "Alex kept using the indicative where the subjunctive was required.",
  extractions: [
    { object: "entity", kind: "grammar_rule", name: "subjunctive" },
    {
      object: "fact",
      kind: "mistake",
      content: "indicative used where subjunctive was required",
      tags: ["subjunctive"],
    },
  ],
};

const TRANSCRIPT: InterviewTranscript = {
  sessionId: "s-abc123",
  exchanges: [
    EX_1,
    {
      id: "ex-2",
      episode: "We talked about how I set prices for exam-prep intensives.",
      extractions: [
        {
          object: "fact",
          kind: "pricing_heuristic",
          content: "charge a premium for exam-prep intensive lessons",
          tags: ["pricing"],
        },
      ],
    },
    { id: "ex-3", episode: "Small talk to warm up; nothing worth recording." },
  ],
};

describe("source naming", () => {
  it.each([
    ["interview:s-abc123", "s-abc123"],
    ["s-abc123", "s-abc123"],
    ["  interview:Sess_01  ", "Sess_01"],
    ["INTERVIEW:abc", "abc"],
  ])("accepts %s", (input, id) => {
    expect(parseSessionRef(input)).toBe(id);
  });

  it.each(["", "-leads-with-dash", "has space", "with/slash", `x${"a".repeat(200)}`])(
    "rejects %s",
    (input) => {
      expect(parseSessionRef(input)).toBeNull();
    },
  );

  it("produces a credential-free, unpinned descriptor", () => {
    expect(languageTutorPack.parseSource("interview:s-abc123")).toEqual({
      ok: true,
      source: {
        kind: "interview-session",
        ref: "interview session s-abc123",
        pin: null,
        meta: { sessionId: "s-abc123" },
      },
    });
  });

  it("rejects a bad reference with actionable copy, not a throw", () => {
    const parsed = languageTutorPack.parseSource("not a session");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/interview session reference/i);
  });
});

describe("acquire", () => {
  it("pins to the session id and enumerates one item per exchange", async () => {
    const fetch = vi.fn(async () => jsonResponse(TRANSCRIPT));
    const got = await languageTutorPack.acquire(SOURCE, ctx(fetch as never));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.source.pin).toBe("s-abc123");
    expect(got.items.map((i) => i.id)).toEqual(["ex-1", "ex-2", "ex-3"]);
    expect(fetch).toHaveBeenCalledWith(
      "https://experts.nlqdb.com/v1/interview-sessions/s-abc123/transcript",
      expect.anything(),
    );
  });

  it.each([
    [401, "source_private"],
    [403, "source_private"],
    [429, "rate_limited"],
    [404, "source_not_found"],
    [500, "source_error"],
  ])("maps HTTP %d to reason %s", async (status, reason) => {
    const fetch = vi.fn(async () => new Response("", { status }));
    const got = await languageTutorPack.acquire(SOURCE, ctx(fetch as never));
    expect(got).toEqual({ ok: false, reason });
  });

  it("rejects a malformed transcript body loudly", async () => {
    const fetch = vi.fn(async () => jsonResponse({ nope: true }));
    const got = await languageTutorPack.acquire(SOURCE, ctx(fetch as never));
    expect(got).toEqual({ ok: false, reason: "source_malformed" });
  });

  it("omits an over-large exchange rather than truncating it", async () => {
    const fetch = vi.fn(async () => jsonResponse(TRANSCRIPT));
    const tiny = {
      ...ctx(fetch as never),
      limits: { maxItems: 20_000, maxItemBytes: 10, maxTotalBytes: 1 },
    };
    const got = await languageTutorPack.acquire(SOURCE, tiny);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.items.every((i) => i.text === null && i.omitted === "too_large")).toBe(true);
  });
});

describe("eligibility", () => {
  it("keeps every real exchange — even one with no extractions", () => {
    const { eligible, skipped } = languageTutorPack.classify(TRANSCRIPT.exchanges.map(item));
    expect(eligible.map((i) => i.id)).toEqual(["ex-1", "ex-2", "ex-3"]);
    expect(skipped).toEqual([]);
  });

  it("skips a malformed exchange with an honest reason, never silently", () => {
    const items: SourceItem[] = [
      { id: "bad-json", bytes: 3, text: "{ [" },
      { id: "no-episode", bytes: 20, text: JSON.stringify({ id: "x", episode: "  " }) },
      { id: "capped", bytes: 999, text: null, omitted: "too_large" },
    ];
    expect(languageTutorPack.classify(items).skipped).toEqual([
      { id: "bad-json", reason: "no_extractable_structure" },
      { id: "no-episode", reason: "no_extractable_structure" },
      { id: "capped", reason: "too_large" },
    ]);
  });
});

describe("extraction → agent_memory_v1 rows", () => {
  it("emits one episode per exchange, kept even when nothing extracts", () => {
    const records = languageTutorPack.extract(TRANSCRIPT.exchanges.map(item), SOURCE);
    const episodes = records.filter((r) => r.object === "episode");
    expect(episodes).toHaveLength(3);
    expect(episodes.every((e) => e.category === "lesson_episode")).toBe(true);
    // ex-3 extracted nothing but its episode is still memory (SK-EKP-007 stake 2).
    expect(
      episodes.some((e) => e.object === "episode" && e.payload.content.startsWith("Small talk")),
    ).toBe(true);
  });

  it("maps to the eval-corpus vocabulary and carries source_episode provenance", () => {
    const records = exchangeRecords(EX_1, "s-abc123");
    const entity = records.find((r) => r.object === "entity");
    const fact = records.find((r) => r.object === "fact");
    expect(entity).toMatchObject({
      category: "grammar_rule",
      object: "entity",
      payload: { kind: "grammar_rule", canonical_name: "subjunctive" },
    });
    expect(fact).toMatchObject({
      category: "mistake",
      object: "fact",
      payload: {
        kind: "mistake",
        tags: ["subjunctive"],
        source: { session: "s-abc123", source_episode: "ex-1" },
      },
    });
  });

  it("drops a malformed extraction without throwing, keeping the episode", () => {
    // `extractions` shapes the `experts` service could get wrong across the
    // HTTP seam: a non-array, an unknown `object`, and a fact missing `content`.
    const malformed = {
      id: "ex-bad",
      episode: "An exchange whose extraction payload is broken.",
      extractions: { object: "fact", content: "not an array" },
    } as unknown as InterviewExchange;
    const notAnArray = exchangeRecords(malformed, "s-abc123");
    expect(notAnArray).toHaveLength(1);
    expect(notAnArray[0]?.object).toBe("episode");

    const badElements: InterviewExchange = {
      id: "ex-bad2",
      episode: "Good episode, bad rows.",
      extractions: [
        { object: "note", kind: "x", name: "y" } as never,
        { object: "fact", kind: "mistake" } as never,
      ],
    };
    const records = exchangeRecords(badElements, "s-abc123");
    expect(records).toHaveLength(1);
    expect(records[0]?.object).toBe("episode");
  });

  it("every planned fact records where it came from (no orphan rows)", () => {
    const facts = languageTutorPack
      .extract(TRANSCRIPT.exchanges.map(item), SOURCE)
      .filter((r) => r.object === "fact");
    expect(facts.length).toBeGreaterThan(0);
    for (const f of facts) {
      expect(
        (f.payload as { source?: { source_episode?: string } }).source?.source_episode,
      ).toBeTruthy();
    }
  });
});

describe("N+1 / hard-rule conformance", () => {
  it("declares the shared preset and produces only nlqdb_remember-shaped rows", () => {
    expect(languageTutorPack.preset).toBe("agent_memory_v1");
    const objects = new Set(
      languageTutorPack.extract(TRANSCRIPT.exchanges.map(item), SOURCE).map((r) => r.object),
    );
    for (const o of objects) expect(["entity", "fact", "episode"]).toContain(o);
  });

  it("a secret-shaped interview answer is dropped by the runner guard, no pack opt-out", () => {
    const leaky: InterviewExchange = {
      id: "leak",
      episode: "I mentioned my provider key by mistake.",
      extractions: [
        {
          object: "fact",
          kind: "pricing_heuristic",
          content: "OPENAI_API_KEY=sk-abcdef0123456789abcdef",
          tags: ["pricing"],
        },
      ],
    };
    const { kept, rejected } = guardSecretValues(exchangeRecords(leaky, "s-abc123"));
    expect(rejected).toBe(1);
    // The episode survives; only the credential-shaped fact is dropped.
    expect(kept.every((r) => r.object !== "fact")).toBe(true);
  });
});
