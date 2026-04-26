// Consumer unit test. Calls the default export's `queue()` handler
// directly with synthetic Message + MessageBatch stubs — no Miniflare
// boot needed. Asserts ack/retry behavior and the LogSnag fetch call.

import type { EventEnvelope } from "@nlqdb/events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../src/index.ts";

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
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("dispatches each message to LogSnag and acks", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = { LOGSNAG_TOKEN: "tok_abc", LOGSNAG_PROJECT: "nlqdb" } as Cloudflare.Env;

    await handler.queue!(batch, env, ctx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(msgs[0]!.ack).toHaveBeenCalledTimes(1);
    expect(msgs[0]!.retry).not.toHaveBeenCalled();
  });

  it("retries when LogSnag returns 5xx", async () => {
    const fetchMock = vi.fn(async () => new Response("upstream", { status: 502 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = { LOGSNAG_TOKEN: "tok_abc", LOGSNAG_PROJECT: "nlqdb" } as Cloudflare.Env;

    await handler.queue!(batch, env, ctx);

    expect(msgs[0]!.ack).not.toHaveBeenCalled();
    expect(msgs[0]!.retry).toHaveBeenCalledTimes(1);
  });

  it("acks-and-drops when LogSnag is unconfigured (avoids retry forever on config drift)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = {} as Cloudflare.Env;

    await handler.queue!(batch, env, ctx);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(msgs[0]!.ack).toHaveBeenCalledTimes(1);
    expect(msgs[0]!.retry).not.toHaveBeenCalled();
  });
});
