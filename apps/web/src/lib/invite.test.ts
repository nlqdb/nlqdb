import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { captureInviteFromUrl, getStoredInviteCode } from "./invite";

// Synthesizes the minimum DOM `captureInviteFromUrl` reads: `window.location`,
// `window.localStorage`, `window.history.replaceState`. Mirrors `api.test.ts`.
type Replace = (data: unknown, unused: string, url?: string | URL | null) => void;

function setupWindow(href: string): { storage: Storage; replaced: string[] } {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;

  const initial = new URL(href);
  const replaced: string[] = [];
  let current = initial.toString();
  const replaceState: Replace = (_d, _u, next) => {
    if (next == null) return;
    current = next.toString();
    replaced.push(current);
  };
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    history: { replaceState },
    get location() {
      return new URL(current);
    },
  };
  return { storage, replaced };
}

afterEach(() => {
  (globalThis as unknown as { window?: unknown }).window = undefined;
});

describe("captureInviteFromUrl", () => {
  beforeEach(() => {
    setupWindow("https://nlqdb.com/");
  });

  test("no-op when ?invite= is absent", () => {
    captureInviteFromUrl();
    expect(getStoredInviteCode()).toBeNull();
  });

  test("captures and strips ?invite= on the homepage", () => {
    const { storage, replaced } = setupWindow("https://nlqdb.com/?invite=ABC123_-xyz");
    captureInviteFromUrl();
    expect(storage.getItem("nlqdb_invite")).toBe("ABC123_-xyz");
    expect(replaced[0]).toBe("https://nlqdb.com/");
  });

  test("captures on /solve/<slug> press-launch URLs (the §3.3 amendment path)", () => {
    const { storage } = setupWindow(
      "https://nlqdb.com/solve/cheap-internal-dashboard/?invite=press-launch-abcdef1234",
    );
    captureInviteFromUrl();
    expect(storage.getItem("nlqdb_invite")).toBe("press-launch-abcdef1234");
  });

  test("captures on /vs/<competitor> press-launch URLs", () => {
    const { storage, replaced } = setupWindow(
      "https://nlqdb.com/vs/supabase/?invite=show-hn-xyz789",
    );
    captureInviteFromUrl();
    expect(storage.getItem("nlqdb_invite")).toBe("show-hn-xyz789");
    expect(replaced[0]).toBe("https://nlqdb.com/vs/supabase/");
  });

  test("idempotent — second call on the cleaned URL is a no-op", () => {
    const { storage } = setupWindow("https://nlqdb.com/?invite=once");
    captureInviteFromUrl();
    storage.setItem("nlqdb_invite", "once");
    captureInviteFromUrl();
    expect(storage.getItem("nlqdb_invite")).toBe("once");
  });

  test("preserves other query params while stripping invite", () => {
    const { replaced } = setupWindow(
      "https://nlqdb.com/solve/skip-postgres-setup-side-project/?ref=hn&invite=test1234",
    );
    captureInviteFromUrl();
    expect(replaced[0]).toBe("https://nlqdb.com/solve/skip-postgres-setup-side-project/?ref=hn");
  });

  test("SSR-safe — returns without throwing when window is undefined", () => {
    (globalThis as unknown as { window?: unknown }).window = undefined;
    expect(() => captureInviteFromUrl()).not.toThrow();
  });

  test("Safari private-browsing — swallows localStorage.setItem QuotaExceededError so Base.astro can't trip boot-fallback", () => {
    setupWindow("https://nlqdb.com/?invite=ABCDEFGH");
    const w = (globalThis as unknown as { window: { localStorage: Storage } }).window;
    w.localStorage.setItem = () => {
      const e = new Error("QuotaExceededError");
      e.name = "QuotaExceededError";
      throw e;
    };
    expect(() => captureInviteFromUrl()).not.toThrow();
    expect(getStoredInviteCode()).toBeNull();
  });

  test("rejects oversized codes (> 128 chars) — no localStorage write", () => {
    const oversized = "A".repeat(129);
    const { storage } = setupWindow(`https://nlqdb.com/?invite=${oversized}`);
    captureInviteFromUrl();
    expect(storage.getItem("nlqdb_invite")).toBeNull();
  });
});
