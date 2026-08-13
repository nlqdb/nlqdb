// Unit tests for the best-effort `notify()` dispatcher. Covers the three
// contract properties every caller relies on: MOCK_IDP sinks to KV instead of
// Resend, a missing API key falls back to the dev stub (no throw), and any
// send failure is swallowed — `notify()` must never reject.

import { welcomeEmail } from "@nlqdb/email";
import { describe, expect, it, vi } from "vitest";
import { type NotifyEnv, notify } from "../src/email-notify.ts";

type PutOptions = { expirationTtl?: number };

function fakeKv(putImpl?: (k: string, v: string) => Promise<void>) {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: PutOptions) => {
      if (putImpl) return putImpl(k, v);
      store.set(k, v);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  };
  return { kv: kv as unknown as KVNamespace, store, raw: kv };
}

const MSG = welcomeEmail("https://app.nlqdb.com/app");

describe("notify", () => {
  it("MOCK_IDP=1 sinks to KV instead of hitting Resend", async () => {
    const { kv, raw, store } = fakeKv();
    const env: NotifyEnv = { MOCK_IDP: "1", KV: kv, RESEND_API_KEY: "re_should_not_be_used" };
    await notify(env, { to: "alice@example.com", kind: "welcome", message: MSG });
    expect(raw.put).toHaveBeenCalledTimes(1);
    const [key, value] = raw.put.mock.calls[0] ?? [];
    expect(key).toMatch(/^mock-email:\d+-alice@example\.com$/);
    const entry = JSON.parse((value as string) ?? "{}");
    expect(entry.subject).toBe("Welcome to nlqdb");
    expect(entry.body).toContain("A database you talk to");
    expect(store.size).toBe(1);
  });

  it("falls back to the console dev-stub when no API key is set (never throws)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { kv, raw } = fakeKv();
    const env: NotifyEnv = { KV: kv }; // no RESEND_API_KEY, no MOCK_IDP
    await expect(
      notify(env, { to: "bob@example.com", kind: "welcome", message: MSG }),
    ).resolves.toBeUndefined();
    // Stub logged; KV was not touched (this is the real send path, mocked away).
    expect(info).toHaveBeenCalled();
    expect(raw.put).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("swallows a send failure — best-effort, resolves without throwing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { kv } = fakeKv(async () => {
      throw new Error("kv exploded");
    });
    const env: NotifyEnv = { MOCK_IDP: "1", KV: kv };
    await expect(
      notify(env, { to: "c@example.com", kind: "server_error", message: MSG }),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
