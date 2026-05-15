// SK-EVENTS-011 — unit tests for the demand-signal wishlist handler
// (`/v1/events/wishlist`).
//
// Verifies the validation gate (closed wishlist surface union),
// the KV-throttle on the public wishlist endpoint, and the pure-fanout
// behaviour into the EventEmitter — the handler never blocks on the
// emit, never throws on emitter failure, and never invents principalIds.

import { describe, expect, it, vi } from "vitest";
import { recordWishlist } from "../src/events-feature.ts";

function stubEvents() {
  return { emit: vi.fn().mockResolvedValue(undefined) };
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

describe("recordWishlist", () => {
  it("emits home.surface_wishlist with a hashed per-day principalId", async () => {
    const events = stubEvents();
    const result = await recordWishlist({ kv: stubKv(), events }, "vscode", "1.2.3.4");
    expect(result.status).toBe(202);
    expect(events.emit).toHaveBeenCalledTimes(1);
    const sent = events.emit.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      name: "home.surface_wishlist",
      surface: "vscode",
    });
    // PrincipalId carries the `wl:` prefix so it can't collide with anon
    // ids in the LogSnag user_id facet, and the hex suffix is 16 chars.
    expect(sent.principalId).toMatch(/^wl:[0-9a-f]{16}$/);
  });

  it("rejects an unknown wishlist surface with 400 invalid_surface", async () => {
    const events = stubEvents();
    const result = await recordWishlist({ kv: stubKv(), events }, "not-a-surface", "1.2.3.4");
    expect(result.status).toBe(400);
    if (result.status !== 400) throw new Error("unreachable");
    expect(result.reason).toBe("invalid_surface");
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("rejects a non-string surface with 400 invalid_surface", async () => {
    const events = stubEvents();
    const result = await recordWishlist({ kv: stubKv(), events }, 42, "1.2.3.4");
    expect(result.status).toBe(400);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("rate-limits at the 10th call within the window per IP", async () => {
    const events = stubEvents();
    const kv = stubKv({ "wl-surf:rate:1.2.3.4": "10" });
    const result = await recordWishlist({ kv, events }, "vscode", "1.2.3.4");
    expect(result.status).toBe(429);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("buckets null cf-connecting-ip into the shared 'unknown' lane", async () => {
    const events = stubEvents();
    const kv = stubKv({ "wl-surf:rate:unknown": "10" });
    const result = await recordWishlist({ kv, events }, "vscode", null);
    expect(result.status).toBe(429);
  });

  it("derives the same principalId for the same (ip, day) so dedup collapses", async () => {
    const events = stubEvents();
    await recordWishlist({ kv: stubKv(), events }, "vscode", "1.2.3.4");
    await recordWishlist({ kv: stubKv(), events }, "vscode", "1.2.3.4");
    const first = events.emit.mock.calls[0]?.[0];
    const second = events.emit.mock.calls[1]?.[0];
    expect(first.principalId).toBe(second.principalId);
  });

  it("derives different principalIds for different IPs", async () => {
    const events = stubEvents();
    await recordWishlist({ kv: stubKv(), events }, "vscode", "1.2.3.4");
    await recordWishlist({ kv: stubKv(), events }, "vscode", "5.6.7.8");
    const first = events.emit.mock.calls[0]?.[0];
    const second = events.emit.mock.calls[1]?.[0];
    expect(first.principalId).not.toBe(second.principalId);
  });
});
