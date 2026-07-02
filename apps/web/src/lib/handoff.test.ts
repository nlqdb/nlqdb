import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// SK-ANON-015 — the cross-origin handoff is the only thing standing
// between "never lose a prompt" (SK-ANON-011) and the marketing→app
// origin split (SK-AUTH-016). These tests pin the round-trip: what one
// origin serializes into the fragment, the other imports verbatim —
// and the fragment is stripped so the payload never lingers in the
// address bar.

import {
  ANON_PREV_KEY,
  attachHandoff,
  buildHandoffPayload,
  importHandoffFromLocation,
  parseHandoff,
  serializeHandoff,
} from "./handoff";

let store: Map<string, string>;
let replacedUrl: string | null;

function installWindow(href: string) {
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
  const url = new URL(href);
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    location: { href: url.toString(), hash: url.hash },
    history: {
      replaceState: (_s: unknown, _t: string, next: string) => {
        replacedUrl = next;
      },
    },
  };
}

beforeEach(() => {
  store = new Map();
  replacedUrl = null;
  installWindow("https://nlqdb.com/app/new/");
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("serialize / parse", () => {
  test("round-trips a full payload", () => {
    const payload = {
      v: 1 as const,
      anon: "anon_abc",
      pending: { goal: "add a pool", submittedAt: "2026-07-02T00:00:00Z", origin: "/app/new/" },
      draft: "add a pool",
    };
    expect(parseHandoff(serializeHandoff(payload))).toEqual(payload);
  });

  test("rejects non-handoff hashes and garbage", () => {
    expect(parseHandoff("")).toBeNull();
    expect(parseHandoff("#other=1")).toBeNull();
    expect(parseHandoff("#nlq=not-json")).toBeNull();
    expect(parseHandoff(`#nlq=${encodeURIComponent('{"v":2}')}`)).toBeNull();
  });
});

describe("buildHandoffPayload / attachHandoff", () => {
  test("returns null / no-op when there is nothing to carry", () => {
    expect(buildHandoffPayload()).toBeNull();
    expect(attachHandoff("https://app.nlqdb.com/auth/sign-in")).toBe(
      "https://app.nlqdb.com/auth/sign-in",
    );
  });

  test("snapshots anon + pending + draft from localStorage", () => {
    store.set("nlqdb_anon", "anon_abc");
    store.set(
      "nlqdb_pending",
      JSON.stringify({ goal: "add a pool", submittedAt: "t", origin: "/" }),
    );
    store.set("nlqdb_draft", "add a pool");
    const payload = buildHandoffPayload();
    expect(payload?.anon).toBe("anon_abc");
    expect(payload?.pending?.goal).toBe("add a pool");
    expect(payload?.draft).toBe("add a pool");
  });

  test("skips malformed tokens and corrupt pending slots", () => {
    store.set("nlqdb_anon", "not-a-token");
    store.set("nlqdb_pending", "{corrupt");
    expect(buildHandoffPayload()).toBeNull();
  });

  test("attachHandoff replaces any existing fragment", () => {
    store.set("nlqdb_draft", "orders tracker");
    const out = attachHandoff("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp#old");
    expect(out.startsWith("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp#nlq=")).toBe(true);
    expect(out).not.toContain("#old");
  });
});

describe("importHandoffFromLocation", () => {
  function arriveWith(payload: Parameters<typeof serializeHandoff>[0]) {
    installWindow(
      `https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp${serializeHandoff(payload)}`,
    );
  }

  test("persists pending + draft + anon and strips the fragment", () => {
    arriveWith({
      v: 1,
      anon: "anon_abc",
      pending: { goal: "add a pool", submittedAt: "t", origin: "/app/new/" },
      draft: "add a pool",
    });
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe("anon_abc");
    expect(JSON.parse(store.get("nlqdb_pending") ?? "{}").goal).toBe("add a pool");
    expect(store.get("nlqdb_draft")).toBe("add a pool");
    expect(replacedUrl).toBe("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp");
  });

  test("parks a differing local anon token under the prev key", () => {
    arriveWith({ v: 1, anon: "anon_new" });
    store.set("nlqdb_anon", "anon_old");
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe("anon_new");
    expect(store.get(ANON_PREV_KEY)).toBe("anon_old");
  });

  test("same token does not park a prev entry", () => {
    arriveWith({ v: 1, anon: "anon_same" });
    store.set("nlqdb_anon", "anon_same");
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe("anon_same");
    expect(store.has(ANON_PREV_KEY)).toBe(false);
  });

  test("no fragment → no writes, no history rewrite", () => {
    importHandoffFromLocation();
    expect(store.size).toBe(0);
    expect(replacedUrl).toBeNull();
  });
});
