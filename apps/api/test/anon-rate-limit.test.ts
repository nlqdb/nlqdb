import { describe, expect, it, vi } from "vitest";
import { makeAnonRateLimiter } from "../src/anon-rate-limit.ts";

function fakeKv(): {
  kv: KVNamespace;
  put: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, string>();
  const put = vi.fn(async (key: string, value: string, _opts?: unknown) => {
    store.set(key, value);
  });
  const kv = {
    get: async (key: string) => store.get(key) ?? null,
    put,
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cursor: "" }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
  return { kv, put };
}

describe("anon rate-limiter — checkQuery", () => {
  it("admits up to 30/min per IP", async () => {
    const limiter = makeAnonRateLimiter(fakeKv().kv);
    for (let i = 0; i < 30; i++) {
      const v = await limiter.checkQuery("1.2.3.4");
      expect(v.ok, `attempt ${i}`).toBe(true);
    }
    const blocked = await limiter.checkQuery("1.2.3.4");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfter).toBe(60);
  });

  it("scopes the query bucket per IP", async () => {
    const limiter = makeAnonRateLimiter(fakeKv().kv);
    for (let i = 0; i < 30; i++) await limiter.checkQuery("1.1.1.1");
    const otherIp = await limiter.checkQuery("9.9.9.9");
    expect(otherIp.ok).toBe(true);
  });

  it("returns limit + count + resetAt on every verdict (SK-RL-004 parity)", async () => {
    const limiter = makeAnonRateLimiter(fakeKv().kv);
    const ok = await limiter.checkQuery("1.2.3.4");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.limit).toBe(30);
      expect(ok.count).toBe(1);
      expect(ok.resetAt).toBeGreaterThan(0);
    }
    for (let i = 0; i < 29; i++) await limiter.checkQuery("1.2.3.4");
    const blocked = await limiter.checkQuery("1.2.3.4");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.limit).toBe(30);
      expect(blocked.count).toBeGreaterThanOrEqual(30);
      expect(blocked.resetAt).toBeGreaterThan(0);
    }
  });
});

describe("anon rate-limiter — peekDevice / recordDevice (SK-ANON-012)", () => {
  const PRINCIPAL_A = "anon:0123456789abcdef";
  const PRINCIPAL_B = "anon:fedcba9876543210";

  it("fresh principal peeks as ok=true with count=0, limit=1", async () => {
    const limiter = makeAnonRateLimiter(fakeKv().kv);
    const peek = await limiter.peekDevice(PRINCIPAL_A);
    expect(peek.ok).toBe(true);
    if (peek.ok) {
      expect(peek.limit).toBe(1);
      expect(peek.count).toBe(0);
      expect(peek.resetAt).toBeGreaterThan(0);
    }
  });

  it("flips to device_cap after one recordDevice", async () => {
    const limiter = makeAnonRateLimiter(fakeKv().kv);
    await limiter.recordDevice(PRINCIPAL_A);
    const peek = await limiter.peekDevice(PRINCIPAL_A);
    expect(peek.ok).toBe(false);
    if (!peek.ok) {
      expect(peek.reason).toBe("device_cap");
      expect(peek.limit).toBe(1);
      expect(peek.count).toBeGreaterThanOrEqual(1);
      expect(peek.retryAfter).toBe(90 * 24 * 60 * 60);
      expect(peek.resetAt).toBeGreaterThan(0);
    }
  });

  it("scopes create counters per device", async () => {
    const limiter = makeAnonRateLimiter(fakeKv().kv);
    await limiter.recordDevice(PRINCIPAL_A);
    const otherDevice = await limiter.peekDevice(PRINCIPAL_B);
    expect(otherDevice.ok).toBe(true);
  });

  it("writes the device key under the anon:create:device: prefix", async () => {
    const { kv, put } = fakeKv();
    const limiter = makeAnonRateLimiter(kv);
    await limiter.recordDevice(PRINCIPAL_A);
    expect(put).toHaveBeenCalledWith(
      `anon:create:device:${PRINCIPAL_A}`,
      "1",
      expect.objectContaining({ expirationTtl: 90 * 24 * 60 * 60 }),
    );
  });

  it("KV TTL on the device key is 90 days", async () => {
    const { kv, put } = fakeKv();
    const limiter = makeAnonRateLimiter(kv);
    await limiter.recordDevice(PRINCIPAL_A);
    const call = put.mock.calls.find((c) =>
      String(c[0]).startsWith("anon:create:device:"),
    );
    expect(call).toBeDefined();
    const opts = call?.[2] as { expirationTtl: number };
    expect(opts.expirationTtl).toBe(90 * 24 * 60 * 60);
  });
});
