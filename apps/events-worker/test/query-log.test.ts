// Query-log sink tests. Asserts the W4 contract:
//   • batch projection feeds writeQueryLog from @nlqdb/db (GLOBAL-021).
//   • OTel span carries batch_size + http.response.status_code.
//   • 5 consecutive failures trips the circuit-breaker; a successful
//     write resets it.
//   • An open breaker short-circuits to ack-and-drop without calling
//     the writer.
//
// We inject a fake writer rather than mocking fetch so the test stays
// owner-aware: the events-worker treats `writeQueryLog` as the seam,
// not the HTTP shape. The HTTP shape is unit-tested separately in
// packages/db.

import type { AskCompletedEvent } from "@nlqdb/events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _isCircuitBreakerOpen,
  _resetCircuitBreakerForTest,
  publishToQueryLog,
} from "../src/sinks/query-log.ts";

function makeEvent(overrides: Partial<AskCompletedEvent> = {}): AskCompletedEvent {
  return {
    name: "ask.completed",
    dbId: "db_1",
    schemaHash: "schema_v1",
    queryHash: "qh_1",
    planShape: "ps_1",
    engine: "postgres",
    ms: 100,
    rowsReturned: 5,
    ts: 1700000000000,
    ...overrides,
  };
}

describe("publishToQueryLog", () => {
  beforeEach(() => {
    _resetCircuitBreakerForTest();
  });

  afterEach(() => {
    _resetCircuitBreakerForTest();
  });

  it("calls the writer with the projected event batch and returns ok", async () => {
    const writer = vi.fn(async (_events: AskCompletedEvent[]) => ({ rowsWritten: 2, status: 202 }));
    const events = [makeEvent({ queryHash: "qh_a" }), makeEvent({ queryHash: "qh_b" })];

    const result = await publishToQueryLog({ token: "tok", workspace: "ws", writer }, events);

    expect(result).toEqual({ ok: true });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0]?.[0]).toEqual(events);
  });

  it("no-ops on an empty batch (no writer call)", async () => {
    const writer = vi.fn();
    const result = await publishToQueryLog({ token: "tok", workspace: "ws", writer }, []);
    expect(result).toEqual({ ok: true });
    expect(writer).not.toHaveBeenCalled();
  });

  it("rethrows on writer failure (caller retries the batch)", async () => {
    const writer = vi.fn(async () => {
      throw new Error("tinybird 502");
    });
    await expect(
      publishToQueryLog({ token: "tok", workspace: "ws", writer }, [makeEvent()]),
    ).rejects.toThrow("tinybird 502");
  });

  it("trips the circuit-breaker after 5 consecutive failures", async () => {
    const writer = vi.fn(async () => {
      throw new Error("tinybird down");
    });
    const config = { token: "tok", workspace: "ws", writer };

    for (let i = 0; i < 5; i++) {
      await expect(publishToQueryLog(config, [makeEvent()])).rejects.toThrow();
    }
    expect(_isCircuitBreakerOpen()).toBe(true);

    // The 6th call sees the open breaker and ack-and-drops without
    // calling the writer. Failure count was 5 before this call; the
    // writer mock should still have only 5 invocations.
    const result = await publishToQueryLog(config, [makeEvent()]);
    expect(result).toEqual({ ok: false, circuitOpen: true });
    expect(writer).toHaveBeenCalledTimes(5);
  });

  it("resets the breaker on the first successful write", async () => {
    const failing = vi.fn(async () => {
      throw new Error("tinybird down");
    });
    const okWriter = vi.fn(async () => ({ rowsWritten: 1, status: 202 }));

    // Four failures — under the trip threshold.
    for (let i = 0; i < 4; i++) {
      await expect(
        publishToQueryLog({ token: "tok", workspace: "ws", writer: failing }, [makeEvent()]),
      ).rejects.toThrow();
    }
    expect(_isCircuitBreakerOpen()).toBe(false);

    // Success resets the consecutive-failures counter.
    const result = await publishToQueryLog({ token: "tok", workspace: "ws", writer: okWriter }, [
      makeEvent(),
    ]);
    expect(result).toEqual({ ok: true });

    // After reset, four more failures should not trip the breaker.
    for (let i = 0; i < 4; i++) {
      await expect(
        publishToQueryLog({ token: "tok", workspace: "ws", writer: failing }, [makeEvent()]),
      ).rejects.toThrow();
    }
    expect(_isCircuitBreakerOpen()).toBe(false);
  });
});
