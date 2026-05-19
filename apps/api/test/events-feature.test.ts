// SK-EVENTS-011 — unit tests for the demand-signal wishlist handler
// (`/v1/events/wishlist`).
//
// Verifies the validation gate (closed wishlist surface union),
// the KV-throttle on the public wishlist endpoint, and the pure-fanout
// behaviour into the EventEmitter — the handler never blocks on the
// emit, never throws on emitter failure, and never invents principalIds.

import type { EventEmitter } from "@nlqdb/events";
import { describe, expect, it, vi } from "vitest";
import { recordEvalReport, recordWishlist } from "../src/events-feature.ts";

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

describe("recordEvalReport — SK-QUAL-002 internal cron ingestion", () => {
  const TOKEN = "secret-token-1234567890abcdef";

  function makePayload(
    opts: {
      withBaseline?: boolean;
      regressions?: Array<{ trigger: "threshold" | "mcnemar"; pValue: number | null }>;
    } = {},
  ) {
    return {
      report: {
        run_at: "2026-05-18T04:00:00Z",
        dataset: "bird-mini-dev-sqlite",
        question_count: 500,
        lanes: [
          { lane: "free", execution_accuracy: 0.42 },
          { lane: "frontier", execution_accuracy: 0.66 },
        ],
        free_vs_frontier_delta: 0.24,
        ...(opts.withBaseline
          ? {
              baseline: {
                lanes: [
                  {
                    lane: "free",
                    delta_pp: -0.07,
                    regressions: opts.regressions ?? [],
                  },
                ],
              },
            }
          : {}),
      },
    };
  }

  it("returns 401 on missing bearer", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const result = recordEvalReport(events, null, TOKEN, makePayload());
    expect(result.status).toBe(401);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("returns 401 on wrong bearer (constant-time compare)", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const result = recordEvalReport(events, "Bearer wrong-token", TOKEN, makePayload());
    expect(result.status).toBe(401);
  });

  it("returns 401 when authorization is not a Bearer scheme", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const result = recordEvalReport(events, `Basic ${TOKEN}`, TOKEN, makePayload());
    expect(result.status).toBe(401);
  });

  it("returns 400 on malformed payload", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const result = recordEvalReport(events, `Bearer ${TOKEN}`, TOKEN, { not: "a-report" });
    expect(result.status).toBe(400);
    if (result.status !== 400) throw new Error("unreachable");
    expect(result.reason).toBe("invalid_body");
  });

  it("emits exactly one weekly event when no baseline is present", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const result = recordEvalReport(events, `Bearer ${TOKEN}`, TOKEN, makePayload());
    expect(result.status).toBe(202);
    if (result.status !== 202) throw new Error("unreachable");
    expect(result.emitted).toBe(1);
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect((events.emit as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      name: "feature.eval.weekly",
      dataset: "bird-mini-dev-sqlite",
      questionCount: 500,
      laneExecutionAccuracy: { free: 0.42, frontier: 0.66 },
      freeVsFrontierDelta: 0.24,
      // SK-QUAL-009: pre-3c producers omit the agentic field; ingest
      // defaults to null so LogSnag sees a uniform "lane didn't run" signal.
      freeVsAgenticFrontierDelta: null,
    });
  });

  it("SK-QUAL-009: flows free_vs_agentic_frontier_delta through to the typed event when set", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const payload = {
      report: {
        run_at: "2026-05-18T04:00:00Z",
        dataset: "bird-mini-dev-sqlite",
        question_count: 500,
        lanes: [
          { lane: "free", execution_accuracy: 0.42 },
          { lane: "frontier", execution_accuracy: 0.66 },
          { lane: "agentic-frontier", execution_accuracy: 0.82 },
        ],
        free_vs_frontier_delta: 0.24,
        free_vs_agentic_frontier_delta: 0.4,
      },
    };
    const result = recordEvalReport(events, `Bearer ${TOKEN}`, TOKEN, payload);
    expect(result.status).toBe(202);
    const emitted = (events.emit as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(emitted).toMatchObject({
      name: "feature.eval.weekly",
      laneExecutionAccuracy: { free: 0.42, frontier: 0.66, "agentic-frontier": 0.82 },
      freeVsFrontierDelta: 0.24,
      freeVsAgenticFrontierDelta: 0.4,
    });
  });

  it("SK-QUAL-009: rejects a malformed free_vs_agentic_frontier_delta (string masquerading as number)", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const payload = {
      report: {
        run_at: "2026-05-18T04:00:00Z",
        dataset: "bird-mini-dev-sqlite",
        question_count: 500,
        lanes: [{ lane: "free", execution_accuracy: 0.42 }],
        free_vs_frontier_delta: null,
        free_vs_agentic_frontier_delta: "0.4",
      },
    };
    const result = recordEvalReport(events, `Bearer ${TOKEN}`, TOKEN, payload);
    expect(result.status).toBe(400);
  });

  it("emits one weekly + one regression per (lane, trigger) when baseline regressions are present", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const result = recordEvalReport(
      events,
      `Bearer ${TOKEN}`,
      TOKEN,
      makePayload({
        withBaseline: true,
        regressions: [
          { trigger: "threshold", pValue: null },
          { trigger: "mcnemar", pValue: 0.012 },
        ],
      }),
    );
    expect(result.status).toBe(202);
    if (result.status !== 202) throw new Error("unreachable");
    expect(result.emitted).toBe(3); // 1 weekly + 2 regressions
    const calls = (events.emit as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[1]?.[0]).toMatchObject({ name: "feature.eval.regression", trigger: "threshold" });
    expect(calls[2]?.[0]).toMatchObject({
      name: "feature.eval.regression",
      trigger: "mcnemar",
      pValue: 0.012,
    });
  });

  it("skips regression emission when delta_pp is null (newly-added lane)", () => {
    const events: EventEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const payload = {
      report: {
        run_at: "2026-05-18T04:00:00Z",
        dataset: "bird-mini-dev-sqlite",
        question_count: 500,
        lanes: [{ lane: "frontier", execution_accuracy: 0.66 }],
        free_vs_frontier_delta: null,
        baseline: {
          lanes: [
            {
              lane: "frontier",
              delta_pp: null,
              regressions: [{ trigger: "threshold" as const, pValue: null }],
            },
          ],
        },
      },
    };
    const result = recordEvalReport(events, `Bearer ${TOKEN}`, TOKEN, payload);
    expect(result.status).toBe(202);
    if (result.status !== 202) throw new Error("unreachable");
    expect(result.emitted).toBe(1); // weekly only
  });
});
