// Unit tests for the first-server-error recovery email (SK-ASK-027). Covers
// the dedup contract: the email is sent the first time (D1 insert returns a
// row), skipped on every repeat (insert returns null), and a D1 failure is
// swallowed — the ask response must never be affected.

import { describe, expect, it, vi } from "vitest";
import type { NotifyEnv } from "../src/email-notify.ts";
import { notifyFirstServerError } from "../src/first-error-email.ts";

function fakeKv() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
    delete: vi.fn(async () => {}),
  };
  return { kv: kv as unknown as KVNamespace, raw: kv };
}

// Minimal D1 fake for `prepare(...).bind(...).first()`.
function fakeDb(firstImpl: () => Promise<{ ok: number } | null>) {
  const first = vi.fn(firstImpl);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind, first };
}

const APP_URL = "https://app.nlqdb.com/app";

describe("notifyFirstServerError", () => {
  it("sends the recovery email the first time (insert returns a row)", async () => {
    const { kv, raw } = fakeKv();
    const { db } = fakeDb(async () => ({ ok: 1 }));
    const env: NotifyEnv = { MOCK_IDP: "1", KV: kv };
    await notifyFirstServerError({ db, env, appUrl: APP_URL }, "u_1", "user@example.com");
    expect(raw.put).toHaveBeenCalledTimes(1);
    const entry = JSON.parse((raw.put.mock.calls[0]?.[1] as string) ?? "{}");
    expect(entry.to).toBe("user@example.com");
    expect(entry.subject.toLowerCase()).toContain("on us");
  });

  it("does NOT send on a repeat error (insert returns null)", async () => {
    const { kv, raw } = fakeKv();
    const { db } = fakeDb(async () => null);
    const env: NotifyEnv = { MOCK_IDP: "1", KV: kv };
    await notifyFirstServerError({ db, env, appUrl: APP_URL }, "u_1", "user@example.com");
    expect(raw.put).not.toHaveBeenCalled();
  });

  it("swallows a D1 failure — never throws into the ask response", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { kv, raw } = fakeKv();
    const { db } = fakeDb(async () => {
      throw new Error("d1 down");
    });
    const env: NotifyEnv = { MOCK_IDP: "1", KV: kv };
    await expect(
      notifyFirstServerError({ db, env, appUrl: APP_URL }, "u_1", "user@example.com"),
    ).resolves.toBeUndefined();
    expect(raw.put).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
