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
        orchestratorMs: 100,
        rowsReturned: 5,
        ts: Date.now(),
      },
    });
    const { batch, msgs } = makeBatch([askEnvelope("qh_a"), askEnvelope("qh_b")]);
    const env = {
      TINYBIRD_TOKEN: "tok_tb",
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
        orchestratorMs: 200,
        rowsReturned: 1,
        ts: Date.now(),
      },
    };
    const { batch, msgs } = makeBatch([askEnvelope]);
    const env = {
      TINYBIRD_TOKEN: "tok_tb",
    } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const msg = msgs[0];
    if (!msg) throw new Error("expected one message in batch");
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });

  // SK-STRIPE-013 — billing.payment_failed fans out to BOTH the LogSnag
  // operator alert and the customer dunning email. The email is best-effort:
  // its failure must not retry the message (that would re-page the operator).
  const paymentFailed: EventEnvelope = {
    id: "billing.payment_failed.in_42",
    ts: Date.now(),
    event: {
      name: "billing.payment_failed",
      userId: "u_42",
      customerId: "cus_42",
      customerEmail: "payer@example.com",
      invoiceId: "in_42",
      amountDue: 2500,
      currency: "usd",
      attemptCount: 1,
      hostedInvoiceUrl: "https://pay.stripe.com/in_42",
    },
  };

  // Routes fetch by host so a single global mock serves both sinks.
  function routedFetch(resend: (req: RequestInit) => Response) {
    return vi.fn(async (url: string, init: RequestInit) =>
      url.includes("api.resend.com") ? resend(init) : new Response("{}", { status: 200 }),
    );
  }

  it("billing.payment_failed sends the LogSnag alert AND the dunning email (idempotency-keyed)", async () => {
    const fetchMock = routedFetch(() => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([paymentFailed]);
    const env = {
      LOGSNAG_TOKEN: "tok_abc",
      LOGSNAG_PROJECT: "nlqdb",
      RESEND_API_KEY: "re_test",
    } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const resendCall = calls.find(([u]) => u.includes("api.resend.com"));
    expect(calls.some(([u]) => u.includes("api.logsnag.com"))).toBe(true);
    expect(resendCall).toBeDefined();
    expect((resendCall![1].headers as Record<string, string>)["idempotency-key"]).toBe(
      "billing.payment_failed.in_42",
    );
    expect(msgs[0]?.ack).toHaveBeenCalledTimes(1);
    expect(msgs[0]?.retry).not.toHaveBeenCalled();
  });

  it("acks billing.payment_failed even when the dunning email send fails (best-effort)", async () => {
    const fetchMock = routedFetch(() => new Response("boom", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([paymentFailed]);
    const env = {
      LOGSNAG_TOKEN: "tok_abc",
      LOGSNAG_PROJECT: "nlqdb",
      RESEND_API_KEY: "re_test",
    } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    // LogSnag succeeded; the failed Resend send is swallowed → ack, no retry.
    expect(msgs[0]?.ack).toHaveBeenCalledTimes(1);
    expect(msgs[0]?.retry).not.toHaveBeenCalled();
  });

  it("skips the dunning email when RESEND_API_KEY is unset (LogSnag still fires)", async () => {
    const fetchMock = routedFetch(() => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([paymentFailed]);
    const env = { LOGSNAG_TOKEN: "tok_abc", LOGSNAG_PROJECT: "nlqdb" } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.some(([u]) => u.includes("api.resend.com"))).toBe(false);
    expect(calls.some(([u]) => u.includes("api.logsnag.com"))).toBe(true);
    expect(msgs[0]?.ack).toHaveBeenCalledTimes(1);
  });

  it("sends the dunning email even when LogSnag is unconfigured (decoupled sinks)", async () => {
    const fetchMock = routedFetch(() => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([paymentFailed]);
    // RESEND set, LogSnag NOT — the email must still go out.
    const env = { RESEND_API_KEY: "re_test" } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.some(([u]) => u.includes("api.resend.com"))).toBe(true);
    expect(calls.some(([u]) => u.includes("api.logsnag.com"))).toBe(false);
    expect(msgs[0]?.ack).toHaveBeenCalledTimes(1);
    expect(msgs[0]?.retry).not.toHaveBeenCalled();
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
        orchestratorMs: 200,
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

  // SK-EVENTS-013 — the PostHog sink fans every event out alongside LogSnag.
  it("fans an event out to PostHog AND LogSnag, and still acks (SK-EVENTS-013)", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("posthog.com")
        ? new Response("{}", { status: 200 })
        : new Response("{}", { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = {
      LOGSNAG_TOKEN: "tok_abc",
      LOGSNAG_PROJECT: "nlqdb",
      POSTHOG_API_KEY: "phc_test",
      POSTHOG_HOST: "https://eu.i.posthog.com",
    } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const posthogCall = calls.find(([u]) => u.includes("posthog.com"));
    expect(posthogCall?.[0]).toBe("https://eu.i.posthog.com/batch/");
    expect(calls.some(([u]) => u.includes("logsnag.com"))).toBe(true);
    expect(msgs[0]?.ack).toHaveBeenCalledTimes(1);
    expect(msgs[0]?.retry).not.toHaveBeenCalled();
  });

  it("does not call PostHog when its env is unset", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch } = makeBatch([envelope]);
    const env = { LOGSNAG_TOKEN: "tok_abc", LOGSNAG_PROJECT: "nlqdb" } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.some(([u]) => u.includes("posthog.com"))).toBe(false);
  });

  it("acks the message even when the PostHog fan-out fails (best-effort)", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("posthog.com")
        ? new Response("boom", { status: 500 })
        : new Response("{}", { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { batch, msgs } = makeBatch([envelope]);
    const env = {
      LOGSNAG_TOKEN: "tok_abc",
      LOGSNAG_PROJECT: "nlqdb",
      POSTHOG_API_KEY: "phc_test",
      POSTHOG_HOST: "https://eu.i.posthog.com",
    } as Cloudflare.Env;

    if (!handler.queue) throw new Error("expected default export to define a queue handler");
    await handler.queue(batch, env, ctx);

    // LogSnag succeeded; the failed PostHog fan-out is swallowed → ack, no retry.
    expect(msgs[0]?.ack).toHaveBeenCalledTimes(1);
    expect(msgs[0]?.retry).not.toHaveBeenCalled();
  });
});
