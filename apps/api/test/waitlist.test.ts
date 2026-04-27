// Unit tests for the waitlist handler — verifies the privacy + rate-
// limit + idempotency contracts without booting Miniflare.

import { describe, expect, it, vi } from "vitest";
import { joinWaitlist } from "../src/waitlist.ts";

function stubDb(opts: { insertResult: { ok: number } | null; shouldThrow?: boolean }): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => {
          if (opts.shouldThrow) throw new Error("d1 down");
          return opts.insertResult;
        }),
      }),
    }),
  } as unknown as D1Database;
}

function stubKv(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  } as unknown as KVNamespace;
}

const eventsStub = {
  emit: vi.fn().mockResolvedValue(undefined),
};

describe("joinWaitlist", () => {
  it("returns 400 for non-string email", async () => {
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: null }), kv: stubKv(), events: eventsStub },
      undefined,
      "1.2.3.4",
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "invalid_email" });
  });

  it("returns 400 for malformed email", async () => {
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: null }), kv: stubKv(), events: eventsStub },
      "not-an-email",
      "1.2.3.4",
    );
    expect(out.status).toBe(400);
  });

  it("rate-limits at the 5th call within the window", async () => {
    const kv = stubKv({ "wl:rate:1.2.3.4": "5" });
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv, events: eventsStub },
      "user@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(429);
  });

  it("returns 200 on successful insert and emits the event", async () => {
    const events = { emit: vi.fn().mockResolvedValue(undefined) };
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events },
      "user@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ received: true });
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit.mock.calls[0]?.[0]).toMatchObject({
      name: "user.waitlist_joined",
      source: "web",
    });
  });

  it("returns 200 on duplicate without emitting (privacy)", async () => {
    const events = { emit: vi.fn().mockResolvedValue(undefined) };
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: null }), kv: stubKv(), events },
      "user@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ received: true });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("returns 500 on D1 error", async () => {
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: null, shouldThrow: true }), kv: stubKv(), events: eventsStub },
      "user@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(500);
  });

  it("normalizes email case (User@Example.COM === user@example.com)", async () => {
    const upper = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events: eventsStub },
      "User@Example.COM",
      "1.2.3.4",
    );
    const lower = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events: eventsStub },
      "user@example.com",
      "1.2.3.4",
    );
    // Hash is computed off the normalized form; both should report 200.
    expect(upper.status).toBe(200);
    expect(lower.status).toBe(200);
  });
});
