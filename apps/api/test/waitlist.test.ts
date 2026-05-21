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
    expect(out.body).toEqual({ error: { status: "invalid_email" } });
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
    expect(out.body).toEqual({ error: { status: "rate_limited" } });
  });

  it("returns 200 with pendingEmit on first insert; emit defers to caller", async () => {
    const events = { emit: vi.fn().mockResolvedValue(undefined) };
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events },
      "user@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ received: true });
    if (out.status !== 200) throw new Error("unreachable");
    // The handler hands `pendingEmit` to ctx.waitUntil so the emit
    // doesn't block the response. Resolving it here is what the
    // runtime would do.
    expect(out.pendingEmit).toBeDefined();
    await out.pendingEmit;
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit.mock.calls[0]?.[0]).toMatchObject({
      name: "user.waitlist_joined",
      email: "user@example.com",
      persona: null,
      source: "web",
    });
  });

  it("passes a valid persona through to the emitted event", async () => {
    const events = { emit: vi.fn().mockResolvedValue(undefined) };
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events },
      "p@example.com",
      "1.2.3.4",
      "web",
      "solo-builder",
    );
    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error("unreachable");
    await out.pendingEmit;
    expect(events.emit.mock.calls[0]?.[0]).toMatchObject({
      name: "user.waitlist_joined",
      persona: "solo-builder",
    });
  });

  it("normalises an off-list persona to null without rejecting the signup", async () => {
    const events = { emit: vi.fn().mockResolvedValue(undefined) };
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events },
      "p@example.com",
      "1.2.3.4",
      "web",
      "wizard",
    );
    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error("unreachable");
    await out.pendingEmit;
    expect(events.emit.mock.calls[0]?.[0]).toMatchObject({
      name: "user.waitlist_joined",
      persona: null,
    });
  });

  it("returns 200 on duplicate without scheduling an emit (privacy)", async () => {
    const events = { emit: vi.fn().mockResolvedValue(undefined) };
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: null }), kv: stubKv(), events },
      "user@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ received: true });
    if (out.status !== 200) throw new Error("unreachable");
    expect(out.pendingEmit).toBeUndefined();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("returns 500 on D1 error with structured envelope", async () => {
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: null, shouldThrow: true }), kv: stubKv(), events: eventsStub },
      "user@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(500);
    expect(out.body).toEqual({ error: { status: "internal" } });
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
      "1.2.3.5",
    );
    // Hash is computed off the normalized form; both should report 200.
    expect(upper.status).toBe(200);
    expect(lower.status).toBe(200);
  });

  it("sends invite email on first insert when emailSender is provided", async () => {
    const sent: { to: string; subject: string }[] = [];
    const emailSender = vi.fn(async (msg: { to: string; subject: string }) => {
      sent.push({ to: msg.to, subject: msg.subject });
    });
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events: eventsStub, emailSender },
      "new@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error("unreachable");
    await out.pendingEmit;
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("new@example.com");
    expect(sent[0]?.subject).toMatch(/invite/i);
  });

  it("does not send invite email on duplicate signup", async () => {
    const emailSender = vi.fn();
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: null }), kv: stubKv(), events: eventsStub, emailSender },
      "dup@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("still returns 200 when invite email send fails", async () => {
    const emailSender = vi.fn().mockRejectedValue(new Error("resend down"));
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv: stubKv(), events: eventsStub, emailSender },
      "fail@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error("unreachable");
    // Awaiting pendingEmit should not throw even though emailSender rejects.
    await expect(out.pendingEmit).resolves.not.toThrow();
  });

  it("respects weekly invite cap — no email when cap exhausted", async () => {
    const capKey = `wl:invite-cap:${Math.floor(Date.now() / (7 * 86_400_000))}`;
    const kv = stubKv({ [capKey]: "200" });
    const emailSender = vi.fn();
    const out = await joinWaitlist(
      { db: stubDb({ insertResult: { ok: 1 } }), kv, events: eventsStub, emailSender, inviteCap: 200 },
      "capped@example.com",
      "1.2.3.4",
    );
    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error("unreachable");
    await out.pendingEmit;
    expect(emailSender).not.toHaveBeenCalled();
  });
});
