// Consumer unit test. Calls the default export's `queue()` handler
// directly with synthetic Message + MessageBatch stubs — no Miniflare
// boot needed. Asserts ack/retry behavior and the LogSnag fetch call.

import type { EventEnvelope } from "@nlqdb/events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../src/index.ts";
import { _resetCircuitBreakerForTest } from "../src/sinks/query-log.ts";

type MsgStub = {
  id: string;
  body: EventEnvelope;
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  // Unused stubs for shape-completeness.
  timestamp: Date;
  attempts: number;
  ackAll?: () => void;
};

function makeMsg(envelope: EventEnvelope): MsgStub {
  return {
    id: envelope.id,
    body: envelope,
    timestamp: new Date(envelope.ts),
    attempts: 0,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function makeBatch(envelopes: EventEnvelope[]) {
  const msgs = envelopes.map(makeMsg);
  return {
    batch: { messages: msgs, queue: "nlqdb-events" } as unknown as MessageBatch<EventEnvelope>,
    msgs,
  };
}

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const envelope: EventEnvelope = {
  id: "user.first_query.u_1",
  ts: Date.now(),
  event: { name: "user.first_query", userId: "u_1", dbId: "db_1" },
};

describe("events-worker queue consumer", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    _resetCircuitBreakerForTest();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    _resetCircuitBreakerForTest();
  });

  it("dispatches each message to LogSnag and acks", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = { LOGSNAG_TOKEN: "tok_abc", LOGSNAG_PROJECT: "nlqdb" } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const msg = msgs[0];
    if (!msg) throw new Error("expected one message in batch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("retries when LogSnag returns 5xx", async () => {
    const fetchMock = vi.fn(async () => new Response("upstream", { status: 502 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = { LOGSNAG_TOKEN: "tok_abc", LOGSNAG_PROJECT: "nlqdb" } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const msg = msgs[0];
    if (!msg) throw new Error("expected one message in batch");
    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledTimes(1);
  });

  it("acks-and-drops when LogSnag is unconfigured (avoids retry forever on config drift)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = {} as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const msg = msgs[0];
    if (!msg) throw new Error("expected one message in batch");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("routes ask.completed to Tinybird (one POST per batch) and acks every message", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ successful_rows: 2, quarantined_rows: 0 }), {
          status: 202,
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const askEnvelope = (queryHash: string): EventEnvelope => ({
      id: `evt.${queryHash}`,
      ts: Date.now(),
      event: {
        name: "ask.completed",
        dbId: "db_1",
        schemaHash: "schema_v1",
        queryHash,
        planShape: "ps_1",
        engine: "postgres",
        ms: 100,
        rowsReturned: 5,
        ts: Date.now(),
      },
    });
    const { batch, msgs } = makeBatch([askEnvelope("qh_a"), askEnvelope("qh_b")]);
    const env = {
      TINYBIRD_TOKEN: "tok_tb",
      TINYBIRD_WORKSPACE: "ws_test",
    } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    // One Tinybird POST for the whole batch (no LogSnag — these aren't
    // user/billing events).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const [url, init] = calls[0] ?? [];
    expect(url).toContain("/v0/events?name=query_log&wait=true");
    expect((init?.headers as Record<string, string>)?.["authorization"]).toBe("Bearer tok_tb");
    // NDJSON body — two lines, one per event.
    const body = init?.body as string;
    expect(body.split("\n")).toHaveLength(2);
    for (const m of msgs) {
      expect(m.ack).toHaveBeenCalledTimes(1);
      expect(m.retry).not.toHaveBeenCalled();
    }
  });

  it("retries every ask.completed message when Tinybird returns 5xx", async () => {
    const fetchMock = vi.fn(async () => new Response("upstream", { status: 502 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const askEnvelope: EventEnvelope = {
      id: "evt.x",
      ts: Date.now(),
      event: {
        name: "ask.completed",
        dbId: "db_1",
        schemaHash: "schema_v1",
        queryHash: "qh_x",
        planShape: "ps_x",
        engine: "postgres",
        ms: 200,
        rowsReturned: 1,
        ts: Date.now(),
      },
    };
    const { batch, msgs } = makeBatch([askEnvelope]);
    const env = {
      TINYBIRD_TOKEN: "tok_tb",
      TINYBIRD_WORKSPACE: "ws_test",
    } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const msg = msgs[0];
    if (!msg) throw new Error("expected one message in batch");
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("acks-and-drops ask.completed when Tinybird is unconfigured", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const askEnvelope: EventEnvelope = {
      id: "evt.x",
      ts: Date.now(),
      event: {
        name: "ask.completed",
        dbId: "db_1",
        schemaHash: "schema_v1",
        queryHash: "qh_x",
        planShape: "ps_x",
        engine: "postgres",
        ms: 200,
        rowsReturned: 1,
        ts: Date.now(),
      },
    };
    const { batch, msgs } = makeBatch([askEnvelope]);
    const env = {} as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const msg = msgs[0];
    if (!msg) throw new Error("expected one message in batch");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });
});
