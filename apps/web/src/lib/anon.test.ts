import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// SK-ANON-001 / SK-ANON-011 — the anon token is the bearer every
// `/v1/ask` call reads. SK-ANON-011 requires that privacy-mode browsers
// "fall back to in-memory state without throwing"; its companion
// prompt-persistence slots already do (safeStorage in prompt-storage.ts),
// but the token slot used to touch `window.localStorage` bare, so a
// stranger with cookies/DOM-storage blocked hit a hard throw on the
// create path — surfaced as a misleading "Couldn't reach the API." These
// pin the graceful-degradation contract.

import { getOrMintAnonToken } from "./anon";

let store: Map<string, string>;
let uuidSeq: number;

// `access: "throw"` makes any getItem/setItem raise (the "block all
// cookies" / DOM-storage-disabled shape); "quota" throws on write only.
function installWindow(access: "ok" | "throw" | "quota" = "ok") {
  const storage = {
    getItem: (k: string) => {
      if (access === "throw") throw new DOMException("blocked", "SecurityError");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (access === "throw" || access === "quota")
        throw new DOMException("blocked", "SecurityError");
      store.set(k, v);
    },
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    crypto: { randomUUID: () => `0000000000000000000000000000000${uuidSeq++}` },
  };
}

beforeEach(() => {
  store = new Map();
  uuidSeq = 0;
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("getOrMintAnonToken", () => {
  // Happy-path cases run first: `memoryToken` is module state, so the
  // storage-blocked case (which sets it) must come last.
  test("mints and persists an anon_ token when storage works", () => {
    installWindow("ok");
    const token = getOrMintAnonToken();
    expect(token).toMatch(/^anon_/);
    expect(store.get("nlqdb_anon")).toBe(token);
  });

  test("reuses an existing valid token without re-minting", () => {
    installWindow("ok");
    store.set("nlqdb_anon", "anon_existingexistingexist");
    expect(getOrMintAnonToken()).toBe("anon_existingexistingexist");
  });

  test("throws only for the SSR / no-window path", () => {
    // No installWindow → window is undefined.
    expect(() => getOrMintAnonToken()).toThrow(/must run in the browser/);
  });

  test("write over quota: mints an in-memory token, never throws", () => {
    // getItem works, setItem throws (the classic quota shape). readStored
    // succeeds (null) but persist fails → in-memory fallback.
    installWindow("quota");
    const token = getOrMintAnonToken();
    expect(token).toMatch(/^anon_/);
    expect(store.get("nlqdb_anon")).toBeUndefined(); // nothing was persisted
  });

  test("storage blocked: returns a stable anon_ token instead of throwing (the regression)", () => {
    installWindow("throw");
    // The old code called window.localStorage.getItem bare and threw here.
    const first = getOrMintAnonToken();
    expect(first).toMatch(/^anon_/);
    // A second call in the same session must resolve to the *same* handle
    // (the in-memory fallback), or the create + follow-up ask would use
    // two different anon identities.
    expect(getOrMintAnonToken()).toBe(first);
  });
});
