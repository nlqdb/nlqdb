// Unit tests for the internal R&D error alert (SK-OBS-012). The throttle is
// the load-bearing part — it protects the shared Resend quota (and therefore
// sign-in email) — so the tests pin: a first alert sends, a repeat signature
// within the cooldown is deduped, the daily cap hard-stops, and any failure
// is swallowed. MOCK_IDP routes the send to the KV sink so a hit is a `put`.

import { describe, expect, it, vi } from "vitest";
import { type AlertEnv, alertRnd } from "../src/internal-alert.ts";

function fakeKv() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  };
  return { kv: kv as unknown as KVNamespace, store, raw: kv };
}

// Count how many sends reached the MOCK_IDP sink. Counts `put` CALLS under
// the `mock-email:` prefix (not store keys): same-millisecond sends to the
// same recipient collide on the key, so key-counting would undercount.
function sinkCount(raw: { put: { mock: { calls: unknown[][] } } }): number {
  return raw.put.mock.calls.filter(
    (call) => typeof call[0] === "string" && (call[0] as string).startsWith("mock-email:"),
  ).length;
}

const DAY = "2026-08-13";

function input(signature: string) {
  return {
    kind: "server" as const,
    summary: `500 — ${signature}`,
    signature,
    utcDay: DAY,
    fields: [["path", "/v1/ask"]] as Array<[string, string]>,
  };
}

describe("alertRnd", () => {
  it("sends the first alert for a signature, then dedups a repeat within cooldown", async () => {
    const { kv, raw } = fakeKv();
    const env: AlertEnv = { MOCK_IDP: "1", KV: kv };
    await alertRnd(env, input("A"));
    expect(sinkCount(raw)).toBe(1);
    // Same signature again → deduped, no second send.
    await alertRnd(env, input("A"));
    expect(sinkCount(raw)).toBe(1);
    // A different signature still sends.
    await alertRnd(env, input("B"));
    expect(sinkCount(raw)).toBe(2);
  });

  it("hard-stops at the daily cap across distinct signatures", async () => {
    const { kv, raw } = fakeKv();
    const env: AlertEnv = { MOCK_IDP: "1", KV: kv };
    // 20 distinct signatures = the cap; the 21st is dropped.
    for (let i = 0; i < 25; i++) {
      await alertRnd(env, input(`sig-${i}`));
    }
    expect(sinkCount(raw)).toBe(20);
  });

  it("counts the cap per UTC day (a new day resets)", async () => {
    const { kv, raw } = fakeKv();
    const env: AlertEnv = { MOCK_IDP: "1", KV: kv };
    for (let i = 0; i < 25; i++) await alertRnd(env, { ...input(`d1-${i}`), utcDay: "2026-08-13" });
    expect(sinkCount(raw)).toBe(20);
    // Next day: cap key differs, alerts flow again.
    await alertRnd(env, { ...input("d2-0"), utcDay: "2026-08-14" });
    expect(sinkCount(raw)).toBe(21);
  });

  it("swallows a KV failure — never throws into the caller", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { kv, raw } = fakeKv();
    raw.get.mockRejectedValueOnce(new Error("kv down"));
    const env: AlertEnv = { MOCK_IDP: "1", KV: kv };
    await expect(alertRnd(env, input("X"))).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
