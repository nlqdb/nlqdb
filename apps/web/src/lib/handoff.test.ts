import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// SK-ANON-015 — the cross-origin handoff is the only thing standing
// between "never lose a prompt" (SK-ANON-011) and the marketing→app
// origin split (SK-AUTH-016). These tests pin the round-trip: what one
// origin serializes into the fragment, the other imports verbatim —
// and the fragment is stripped so the payload never lingers in the
// address bar. The import is also a security boundary: the fragment is
// attacker-writable, so payloads are shape-validated and only honored
// behind a trusted referrer.

import {
  ANON_PREV_KEY,
  attachHandoff,
  buildHandoffPayload,
  importHandoffFromLocation,
  parseHandoff,
  serializeHandoff,
} from "./handoff";

// Valid per the client mint format: `anon_` + ≥16 chars of [A-Za-z0-9-].
const ANON_A = "anon_aaaaaaaaaaaaaaaa";
const ANON_NEW = "anon_nnnnnnnnnnnnnnnn";
const ANON_OLD = "anon_oooooooooooooooo";

let store: Map<string, string>;
let replacedUrl: string | null;

function installWindow(href: string, referrer = "https://nlqdb.com/") {
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
  (globalThis as unknown as { document: unknown }).document = { referrer };
}

beforeEach(() => {
  store = new Map();
  replacedUrl = null;
  installWindow("https://nlqdb.com/app/new/");
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { document?: unknown }).document;
});

describe("serialize / parse", () => {
  test("round-trips a full payload", () => {
    const payload = {
      v: 1 as const,
      anon: ANON_A,
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
    expect(parseHandoff(`#nlq=${encodeURIComponent('"just-a-string"')}`)).toBeNull();
  });

  test("drops malformed fields but keeps valid ones", () => {
    const mixed = `#nlq=${encodeURIComponent(
      JSON.stringify({
        v: 1,
        anon: "anon_$injection$aaaa",
        pending: { goal: "add a pool", submittedAt: 42, origin: "https://evil.example/x" },
        draft: { nested: "object" },
      }),
    )}`;
    expect(parseHandoff(mixed)).toEqual({
      v: 1,
      pending: { goal: "add a pool", submittedAt: "", origin: "/" },
    });
  });

  test("rejects payloads with nothing valid left", () => {
    const bad = `#nlq=${encodeURIComponent(
      JSON.stringify({ v: 1, anon: "anon_x", pending: { goal: { evil: true } }, draft: "" }),
    )}`;
    expect(parseHandoff(bad)).toBeNull();
    const huge = `#nlq=${encodeURIComponent(JSON.stringify({ v: 1, draft: "x".repeat(5000) }))}`;
    expect(parseHandoff(huge)).toBeNull();
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
    store.set("nlqdb_anon", ANON_A);
    store.set(
      "nlqdb_pending",
      JSON.stringify({ goal: "add a pool", submittedAt: "t", origin: "/" }),
    );
    store.set("nlqdb_draft", "add a pool");
    const payload = buildHandoffPayload();
    expect(payload?.anon).toBe(ANON_A);
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
  function arriveWith(
    payload: Parameters<typeof serializeHandoff>[0],
    referrer = "https://nlqdb.com/",
  ) {
    installWindow(
      `https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp${serializeHandoff(payload)}`,
      referrer,
    );
  }

  test("persists pending + draft + anon and strips the fragment", () => {
    arriveWith({
      v: 1,
      anon: ANON_A,
      pending: { goal: "add a pool", submittedAt: "t", origin: "/app/new/" },
      draft: "add a pool",
    });
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_A);
    expect(JSON.parse(store.get("nlqdb_pending") ?? "{}").goal).toBe("add a pool");
    expect(store.get("nlqdb_draft")).toBe("add a pool");
    expect(replacedUrl).toBe("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp");
  });

  test("parks a differing local anon token under the prev key", () => {
    arriveWith({ v: 1, anon: ANON_NEW });
    store.set("nlqdb_anon", ANON_OLD);
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_NEW);
    expect(store.get(ANON_PREV_KEY)).toBe(ANON_OLD);
  });

  test("same token does not park a prev entry", () => {
    arriveWith({ v: 1, anon: ANON_A });
    store.set("nlqdb_anon", ANON_A);
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_A);
    expect(store.has(ANON_PREV_KEY)).toBe(false);
  });

  test("accepts a same-origin referrer", () => {
    arriveWith({ v: 1, anon: ANON_A }, "https://app.nlqdb.com/app/new/");
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_A);
  });

  test("rejects a foreign referrer but still strips the fragment", () => {
    arriveWith({ v: 1, anon: ANON_NEW, draft: "planted" }, "https://evil.example/");
    store.set("nlqdb_anon", ANON_OLD);
    importHandoffFromLocation();
    expect(store.get("nlqdb_anon")).toBe(ANON_OLD);
    expect(store.has("nlqdb_draft")).toBe(false);
    expect(store.has(ANON_PREV_KEY)).toBe(false);
    expect(replacedUrl).toBe("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp");
  });

  test("rejects a lookalike-domain referrer", () => {
    arriveWith({ v: 1, anon: ANON_NEW }, "https://evil-nlqdb.com/");
    importHandoffFromLocation();
    expect(store.has("nlqdb_anon")).toBe(false);
  });

  test("rejects a missing referrer (no provenance) but strips the fragment", () => {
    arriveWith({ v: 1, anon: ANON_A }, "");
    importHandoffFromLocation();
    expect(store.has("nlqdb_anon")).toBe(false);
    expect(replacedUrl).toBe("https://app.nlqdb.com/auth/sign-in?return_to=%2Fapp");
  });

  test("no fragment → no writes, no history rewrite", () => {
    importHandoffFromLocation();
    expect(store.size).toBe(0);
    expect(replacedUrl).toBeNull();
  });
});
