// Unit tests for the SK-AUTH-018 mock-mode email sink. Covers the
// three things the mock-IdP handler depends on: every send produces
// one KV entry under the prefix, listInbox returns them newest-first,
// and findLatestForEmail correctly picks the most recent send for a
// given recipient.

import { describe, expect, it, vi } from "vitest";
import { findLatestForEmail, listInbox, sinkEmail } from "../src/auth/mock-email-sink.ts";

type PutOptions = { expirationTtl?: number };

function fakeKv() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: PutOptions) => {
      store.set(k, v);
    }),
    list: vi.fn(async (opts?: { prefix?: string }) => {
      const prefix = opts?.prefix ?? "";
      return {
        keys: Array.from(store.keys())
          .filter((k) => k.startsWith(prefix))
          .map((name) => ({ name })),
        list_complete: true,
      };
    }),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  };
  return { kv: kv as unknown as KVNamespace, store, raw: kv };
}

describe("sinkEmail / listInbox / findLatestForEmail", () => {
  it("sinkEmail writes one entry under the mock-email: prefix with TTL", async () => {
    const { kv, raw } = fakeKv();
    await sinkEmail(kv, "alice@example.com", "Magic link", "https://x/verify");
    expect(raw.put).toHaveBeenCalledTimes(1);
    const [key, value, opts] = raw.put.mock.calls[0] ?? [];
    expect(key).toMatch(/^mock-email:\d+-alice@example\.com$/);
    expect(JSON.parse(value as string)).toMatchObject({
      to: "alice@example.com",
      subject: "Magic link",
      body: "https://x/verify",
      ts: expect.any(Number),
    });
    expect(opts).toMatchObject({ expirationTtl: 3600 });
  });

  it("listInbox returns entries newest-first across multiple sends", async () => {
    const { kv } = fakeKv();
    await sinkEmail(kv, "a@e.com", "s1", "u1");
    await new Promise((r) => setTimeout(r, 2));
    await sinkEmail(kv, "b@e.com", "s2", "u2");
    await new Promise((r) => setTimeout(r, 2));
    await sinkEmail(kv, "a@e.com", "s3", "u3");

    const inbox = await listInbox(kv);
    expect(inbox).toHaveLength(3);
    expect(inbox[0]?.body).toBe("u3");
    expect(inbox[2]?.body).toBe("u1");
  });

  it("findLatestForEmail returns the most recent send for that recipient", async () => {
    const { kv } = fakeKv();
    await sinkEmail(kv, "a@e.com", "s1", "u1");
    await new Promise((r) => setTimeout(r, 2));
    await sinkEmail(kv, "b@e.com", "s2", "u2");
    await new Promise((r) => setTimeout(r, 2));
    await sinkEmail(kv, "a@e.com", "s3", "u3-latest");

    const latestA = await findLatestForEmail(kv, "a@e.com");
    expect(latestA?.body).toBe("u3-latest");
    const latestB = await findLatestForEmail(kv, "b@e.com");
    expect(latestB?.body).toBe("u2");
    const missing = await findLatestForEmail(kv, "nobody@e.com");
    expect(missing).toBeNull();
  });

  it("listInbox skips entries whose value is missing or non-JSON", async () => {
    const { kv, store } = fakeKv();
    await sinkEmail(kv, "a@e.com", "s", "u");
    store.set("mock-email:9-corrupt@e.com", "not-json");

    const inbox = await listInbox(kv);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.to).toBe("a@e.com");
  });
});
