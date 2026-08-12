import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// SK-GTM-007 — first-touch attribution. Pins: first write wins (an
// internal navigation never overwrites the acquiring channel), internal
// referrers are not channels, corrupt slots read as null, and the API
// `source` projection drops `ts`.

import {
  captureFirstTouch,
  firstTouchSource,
  importFirstTouch,
  loadFirstTouch,
  sanitizeFirstTouch,
} from "./attribution";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("captureFirstTouch", () => {
  test("stores UTM params, external referrer host, and landing path", () => {
    captureFirstTouch(
      "https://nlqdb.com/solve/agent-memory-mcp-server/?utm_source=devto&utm_medium=post",
      "https://dev.to/somebody/article",
      1000,
    );
    expect(loadFirstTouch()).toEqual({
      ts: 1000,
      utm_source: "devto",
      utm_medium: "post",
      ref: "dev.to",
      landing: "/solve/agent-memory-mcp-server/",
    });
  });

  test("first write wins — later touches never overwrite the channel", () => {
    captureFirstTouch("https://nlqdb.com/blog/x/?utm_source=hn", "", 1000);
    captureFirstTouch("https://nlqdb.com/?utm_source=reddit", "https://reddit.com/r/x", 2000);
    expect(loadFirstTouch()?.utm_source).toBe("hn");
  });

  test("internal referrers (nlqdb.com, app.nlqdb.com, localhost) are not channels", () => {
    for (const ref of [
      "https://nlqdb.com/blog/",
      "https://app.nlqdb.com/app/",
      "http://localhost:4321/",
    ]) {
      store.clear();
      captureFirstTouch("https://nlqdb.com/", ref, 1000);
      expect(loadFirstTouch()?.ref).toBeUndefined();
    }
  });

  test("a direct visit still records the landing page", () => {
    captureFirstTouch("https://nlqdb.com/agents/", "", 1000);
    expect(loadFirstTouch()).toEqual({ ts: 1000, landing: "/agents/" });
  });
});

describe("loadFirstTouch / firstTouchSource", () => {
  test("corrupt slot reads as null and source projection drops ts", () => {
    store.set("nlqdb_src", "{not json");
    expect(loadFirstTouch()).toBeNull();
    expect(firstTouchSource()).toBeNull();

    store.clear();
    captureFirstTouch("https://nlqdb.com/?utm_source=smithery", "", 1000);
    expect(firstTouchSource()).toEqual({ utm_source: "smithery", landing: "/" });
  });

  test("a ts-only touch projects to null, not an empty object", () => {
    store.set("nlqdb_src", JSON.stringify({ ts: 5 }));
    expect(firstTouchSource()).toBeNull();
  });
});

describe("sanitizeFirstTouch (cross-origin carry, SK-ANON-015)", () => {
  test("keeps known string fields + numeric ts, clamps length, drops junk", () => {
    const touch = sanitizeFirstTouch({
      ts: 1000,
      utm_source: "reddit",
      ref: "reddit.com",
      landing: "/agents/",
      evil: "<script>",
      utm_medium: "x".repeat(500),
    });
    expect(touch).toEqual({
      ts: 1000,
      utm_source: "reddit",
      ref: "reddit.com",
      landing: "/agents/",
      utm_medium: "x".repeat(160),
    });
  });

  test("drops a touch missing a numeric ts (would read back as corrupt)", () => {
    expect(sanitizeFirstTouch({ utm_source: "hn" })).toBeNull();
    expect(sanitizeFirstTouch({ ts: "nope", utm_source: "hn" })).toBeNull();
    expect(sanitizeFirstTouch(null)).toBeNull();
    expect(sanitizeFirstTouch("string")).toBeNull();
  });
});

describe("importFirstTouch (incoming wins)", () => {
  test("overwrites an existing app-origin capture with the carried touch", () => {
    // App origin captured the post-OAuth referrer as its first touch…
    captureFirstTouch("https://app.nlqdb.com/app", "https://accounts.google.com/", 2000);
    expect(loadFirstTouch()?.ref).toBe("accounts.google.com");
    // …but the marketing-origin touch carried in the handoff wins.
    importFirstTouch({ ts: 1000, utm_source: "devto", landing: "/solve/x/" });
    expect(loadFirstTouch()).toEqual({ ts: 1000, utm_source: "devto", landing: "/solve/x/" });
    expect(firstTouchSource()).toEqual({ utm_source: "devto", landing: "/solve/x/" });
  });
});
