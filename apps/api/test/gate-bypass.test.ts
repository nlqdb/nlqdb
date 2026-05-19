// KV-backed bypass primitives. Uses a fake in-memory KV so the
// invariants (constant timing, parallelisable, hash-not-plaintext)
// can be asserted without a live binding.

import { describe, expect, it, vi } from "vitest";
import { isInviteValid, isUserAllowlisted } from "../src/gate/bypass.ts";
import { sha256Hex } from "../src/principal.ts";

function fakeKv(initial: Record<string, string> = {}): {
  kv: KVNamespace;
  getCalls: string[];
} {
  const store = new Map(Object.entries(initial));
  const getCalls: string[] = [];
  const kv = {
    get: async (key: string) => {
      getCalls.push(key);
      return store.get(key) ?? null;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cursor: "" }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
  return { kv, getCalls };
}

describe("isUserAllowlisted", () => {
  it("returns true when the principal id is present under gate:user:<id>", async () => {
    const { kv } = fakeKv({ "gate:user:u_design_partner": "1" });
    expect(await isUserAllowlisted(kv, "u_design_partner")).toBe(true);
  });

  it("returns false for an absent id", async () => {
    const { kv } = fakeKv();
    expect(await isUserAllowlisted(kv, "u_stranger")).toBe(false);
  });

  it("short-circuits on null id without a KV read (anon, no account)", async () => {
    const { kv, getCalls } = fakeKv();
    expect(await isUserAllowlisted(kv, null)).toBe(false);
    expect(getCalls).toEqual([]);
  });
});

describe("isInviteValid — codes stored hashed, lookup timing constant", () => {
  it("returns true when the hashed code is present", async () => {
    const code = "NLQDB-EARLY-2026";
    const hash = await sha256Hex(code, 32);
    const { kv } = fakeKv({ [`gate:invite:${hash}`]: "1" });
    expect(await isInviteValid(kv, code)).toBe(true);
  });

  it("returns false for an unknown code", async () => {
    const { kv } = fakeKv();
    expect(await isInviteValid(kv, "GUESS-2026")).toBe(false);
  });

  it("trims surrounding whitespace before hashing", async () => {
    const code = "NLQDB-EARLY-2026";
    const hash = await sha256Hex(code, 32);
    const { kv } = fakeKv({ [`gate:invite:${hash}`]: "1" });
    expect(await isInviteValid(kv, `  ${code}\n`)).toBe(true);
  });

  it("issues a decoy KV read when the header is absent (constant timing)", async () => {
    const { kv, getCalls } = fakeKv();
    expect(await isInviteValid(kv, null)).toBe(false);
    expect(getCalls.length).toBe(1);
    expect(getCalls[0]).toMatch(/^gate:invite:/);
  });

  it("issues a decoy KV read when the header is empty", async () => {
    const { kv, getCalls } = fakeKv();
    expect(await isInviteValid(kv, "")).toBe(false);
    expect(getCalls.length).toBe(1);
  });

  it("never stores or looks up the plaintext code", async () => {
    const code = "secret-code-do-not-leak";
    const { kv, getCalls } = fakeKv({ [`gate:invite:plain-${code}`]: "1" });
    expect(await isInviteValid(kv, code)).toBe(false);
    expect(getCalls.every((k) => !k.includes(code))).toBe(true);
  });
});

describe("bypass — allowlist + invite run in parallel", () => {
  // The middleware kicks both off via Promise.all; this asserts the
  // primitives are independently awaitable (no shared state).
  it("two concurrent calls on the same KV don't deadlock or share state", async () => {
    const { kv } = fakeKv({ "gate:user:u_1": "1" });
    const results = await Promise.all([
      isUserAllowlisted(kv, "u_1"),
      isInviteValid(kv, "unknown"),
    ]);
    expect(results).toEqual([true, false]);
  });

  it("KV errors propagate (fail-safe at the caller)", async () => {
    const kv = {
      get: vi.fn().mockRejectedValue(new Error("KV down")),
    } as unknown as KVNamespace;
    await expect(isUserAllowlisted(kv, "u_x")).rejects.toThrow("KV down");
  });
});
