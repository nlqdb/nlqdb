import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// WS02-T2 — the probe is memoized to dedup the initial load burst
// (topnav + page guard + banner all call fetchSession on mount), but the
// cache must be droppable so sign-out can't leave a stale "signed-in"
// result resolving forever.

import { fetchSession, invalidateSession } from "./session";

const originalFetch = globalThis.fetch;
let calls = 0;

beforeEach(() => {
  calls = 0;
  invalidateSession();
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ user: { id: "u1", email: "a@b.c" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  invalidateSession();
});

describe("fetchSession cache", () => {
  test("dedups repeated probes into a single request", async () => {
    const a = await fetchSession("");
    const b = await fetchSession("");
    expect(calls).toBe(1);
    expect(a?.id).toBe("u1");
    expect(b?.id).toBe("u1");
  });

  test("invalidateSession() forces the next probe to re-hit the cookie", async () => {
    await fetchSession("");
    expect(calls).toBe(1);
    invalidateSession();
    await fetchSession("");
    expect(calls).toBe(2);
  });
});
