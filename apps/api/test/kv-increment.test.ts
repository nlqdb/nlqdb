// Better Auth's rate-limit counter over KV (`kvIncrement`). Pins the prod
// 500 on `/api/auth/get-session`: an absolute `expiration` of exactly
// floor(now)+60 reached KV under its 60 s floor and threw. The counter must
// write a relative `expirationTtl` ≥ 60 and keep the fixed window in metadata.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kvIncrement } from "../src/auth.ts";

type Put = { key: string; value: string; opts: Record<string, unknown> };

function fakeKv(seed?: { value: string; exp: number }) {
  const puts: Put[] = [];
  let entry = seed ? { value: seed.value, metadata: { exp: seed.exp } } : null;
  const kv = {
    getWithMetadata: async () => entry ?? { value: null, metadata: null },
    put: async (key: string, value: string, opts: Record<string, unknown>) => {
      puts.push({ key, value, opts });
      entry = { value, metadata: opts["metadata"] as { exp: number } };
    },
  };
  return { kv: kv as unknown as KVNamespace, puts };
}

const NOW_S = 1_794_000_000;

describe("kvIncrement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Late in the second — the case where an absolute floor(now)+60 lands short.
    vi.setSystemTime(NOW_S * 1000 + 999);
  });
  afterEach(() => vi.useRealTimers());

  it("never writes an absolute expiration; short windows clamp the TTL to KV's 60 s floor", async () => {
    const { kv, puts } = fakeKv();
    expect(await kvIncrement(kv, "rl", 10)).toBe(1);
    expect(puts[0]?.opts).toEqual({ expirationTtl: 60, metadata: { exp: NOW_S + 10 } });
  });

  it("keeps the window's end on later increments instead of sliding it", async () => {
    const { kv, puts } = fakeKv();
    await kvIncrement(kv, "rl", 600);
    vi.setSystemTime((NOW_S + 400) * 1000);
    expect(await kvIncrement(kv, "rl", 600)).toBe(2);
    expect(puts[1]?.opts).toEqual({ expirationTtl: 200, metadata: { exp: NOW_S + 600 } });
  });

  it("starts a new window once the old one has passed", async () => {
    const { kv, puts } = fakeKv({ value: "7", exp: NOW_S - 1 });
    expect(await kvIncrement(kv, "rl", 60)).toBe(1);
    expect(puts[0]?.opts).toEqual({ expirationTtl: 60, metadata: { exp: NOW_S + 60 } });
  });
});
