// EK-06 box 4 — revocation-latency bound tests (SK-EKP-008). Asserts the
// 30 s ceiling holds on both clocks, that the env knob only tightens, and
// that the status cache measures revocation latency at ≤ the resolved TTL
// with fail-closed activation semantics.

import { describe, expect, it } from "vitest";
import {
  GRANT_REVOCATION_BOUND_MS,
  GRANT_STATEMENT_TIMEOUT,
  makeGrantStatusCache,
  resolveGrantStatusTtlMs,
} from "./grant-status.ts";
import type { GrantRecord } from "./grants.ts";

const GRANT: GrantRecord = {
  id: "g1",
  ownerTenantId: "owner",
  ownerDbId: "db1",
  granteeTenantId: "buyer",
  scope: ["lessons"],
  priceModel: null,
  createdAt: 0,
  revokedAt: null,
};

describe("resolveGrantStatusTtlMs — the env knob only tightens", () => {
  it("absent env → the 30 s ceiling (documented default)", () => {
    expect(resolveGrantStatusTtlMs(undefined)).toBe(GRANT_REVOCATION_BOUND_MS);
  });

  it("a value above the ceiling clamps down — never widens", () => {
    expect(resolveGrantStatusTtlMs("60000")).toBe(GRANT_REVOCATION_BOUND_MS);
    expect(resolveGrantStatusTtlMs("999999999")).toBe(GRANT_REVOCATION_BOUND_MS);
  });

  it("a value below the ceiling tightens the bound", () => {
    expect(resolveGrantStatusTtlMs("5000")).toBe(5000);
    expect(resolveGrantStatusTtlMs("0")).toBe(0);
  });

  it("non-numeric or negative input fails safe to the ceiling", () => {
    expect(resolveGrantStatusTtlMs("nonsense")).toBe(GRANT_REVOCATION_BOUND_MS);
    expect(resolveGrantStatusTtlMs("-1")).toBe(GRANT_REVOCATION_BOUND_MS);
    expect(resolveGrantStatusTtlMs("")).toBe(GRANT_REVOCATION_BOUND_MS);
  });
});

describe("GRANT_STATEMENT_TIMEOUT — the in-flight clock", () => {
  it("is the ceiling as a valid Postgres interval, never 0 (which disables it)", () => {
    expect(GRANT_STATEMENT_TIMEOUT).toBe("30s");
    // 0 would DISABLE the timeout in Postgres — the one value the in-flight
    // bound must never take.
    expect(GRANT_STATEMENT_TIMEOUT).not.toBe("0");
    expect(GRANT_STATEMENT_TIMEOUT).not.toBe("0s");
  });
});

describe("makeGrantStatusCache — revocation latency measured at ≤ TTL", () => {
  it("serves a live grant from cache within the TTL (one lookup)", async () => {
    let t = 1000;
    let calls = 0;
    const cache = makeGrantStatusCache({ now: () => t, ttlMs: 30_000 });
    const lookup = async () => {
      calls++;
      return GRANT;
    };
    expect(await cache.status("buyer:db1", lookup)).toEqual(GRANT);
    t = 1000 + 29_999; // still inside the bound
    expect(await cache.status("buyer:db1", lookup)).toEqual(GRANT);
    expect(calls).toBe(1); // second read served from cache — no re-lookup
  });

  it("a revoked grant fails closed once the cached status ages past the TTL", async () => {
    let t = 0;
    let live = true;
    const cache = makeGrantStatusCache({ now: () => t, ttlMs: 30_000 });
    const lookup = async () => (live ? GRANT : null);

    expect(await cache.status("buyer:db1", lookup)).toEqual(GRANT); // cached live
    live = false; // owner revokes at t=0

    t = 29_999; // still within the bound → stale-active is the accepted latency
    expect(await cache.status("buyer:db1", lookup)).toEqual(GRANT);

    t = 30_000; // bound elapsed → re-check sees the revoke → reject
    expect(await cache.status("buyer:db1", lookup)).toBeNull();
  });

  it("ttlMs=0 (env fully tightened) re-checks every request — immediate revocation", async () => {
    let t = 0;
    let live = true;
    const cache = makeGrantStatusCache({ now: () => t, ttlMs: 0 });
    const lookup = async () => (live ? GRANT : null);
    expect(await cache.status("buyer:db1", lookup)).toEqual(GRANT);
    live = false;
    t = 1; // any advance
    expect(await cache.status("buyer:db1", lookup)).toBeNull();
  });

  it("a fresh grant activates immediately — a null status is never cached", async () => {
    let t = 0;
    let live = false;
    const cache = makeGrantStatusCache({ now: () => t, ttlMs: 30_000 });
    const lookup = async () => (live ? GRANT : null);
    expect(await cache.status("buyer:db1", lookup)).toBeNull();
    live = true; // grant minted
    t = 5; // well within any TTL — but null was never cached, so it re-checks
    expect(await cache.status("buyer:db1", lookup)).toEqual(GRANT);
  });

  it("an errored status is never cached (fail-closed) — the error propagates", async () => {
    const cache = makeGrantStatusCache({ now: () => 0, ttlMs: 30_000 });
    await expect(
      cache.status("buyer:db1", async () => {
        throw new Error("d1 unavailable");
      }),
    ).rejects.toThrow("d1 unavailable");
    // the failed check cached nothing: a subsequent live lookup is served fresh
    expect(await cache.status("buyer:db1", async () => GRANT)).toEqual(GRANT);
  });
});
