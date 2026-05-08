// `writeQueryLog` (W4 sink path) — Tinybird `query_log` Data Source
// append boundary. Per `GLOBAL-021` this module is the canonical owner
// of writes; the events-worker imports `writeQueryLog` rather than
// POSTing to Tinybird itself. Tests inject the HTTP client to keep the
// wire format and the projection assertions in one place.

import type { AskCompletedEvent } from "@nlqdb/events";
import { describe, expect, it, vi } from "vitest";
import {
  createQueryLogWriter,
  type QueryLogEntry,
  type QueryLogHttpClient,
  QueryLogWriteError,
  writeQueryLog,
} from "../src/clickhouse-tinybird/query-log.ts";

function makeEvent(overrides: Partial<AskCompletedEvent> = {}): AskCompletedEvent {
  return {
    name: "ask.completed",
    dbId: "db_1",
    schemaHash: "schema_v1",
    queryHash: "qh_1",
    planShape: "ps_1",
    engine: "postgres",
    orchestratorMs: 100,
    rowsReturned: 5,
    ts: Date.UTC(2026, 4, 8, 12, 30, 45, 123),
    ...overrides,
  };
}

function makeEntry(eventId: string, overrides: Partial<AskCompletedEvent> = {}): QueryLogEntry {
  return { eventId, event: makeEvent(overrides) };
}

describe("writeQueryLog", () => {
  it("encodes entries as NDJSON with the canonical column shape", async () => {
    const captured: { ndjson: string; rowCount: number } = { ndjson: "", rowCount: 0 };
    const http: QueryLogHttpClient = async (req) => {
      captured.ndjson = req.ndjson;
      captured.rowCount = req.rowCount;
      return { status: 202 };
    };
    const entries = [
      makeEntry("evt.a", { queryHash: "qh_a" }),
      makeEntry("evt.b", { queryHash: "qh_b" }),
    ];

    const result = await writeQueryLog(http, entries);

    expect(result).toEqual({ rowsWritten: 2, status: 202 });
    expect(captured.rowCount).toBe(2);
    const lines = captured.ndjson.split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0] ?? "");
    expect(first).toMatchObject({
      // Producer envelope id passes through to `event_id` so consumers
      // can dedupe at read time (Tinybird does not dedupe natively;
      // Cloudflare Queues redelivers on retry).
      event_id: "evt.a",
      db_id: "db_1",
      schema_hash: "schema_v1",
      query_hash: "qh_a",
      plan_shape: "ps_1",
      engine: "postgres",
      // The wire column is `orchestrator_ms`, not `ms` — distinct from
      // the §1 SLO request-in→response-out timing.
      orchestrator_ms: 100,
      rows_returned: 5,
    });
    expect(first).not.toHaveProperty("ms");
    // ClickHouse DateTime64(3) — "YYYY-MM-DD HH:MM:SS.sss" UTC.
    expect(first.ts).toBe("2026-05-08 12:30:45.123");
  });

  it("returns immediately for an empty batch (no HTTP call)", async () => {
    const http = vi.fn();
    const result = await writeQueryLog(http as unknown as QueryLogHttpClient, []);
    expect(result).toEqual({ rowsWritten: 0, status: 0 });
    expect(http).not.toHaveBeenCalled();
  });

  it("throws QueryLogWriteError on non-2xx with status + body attached", async () => {
    const http: QueryLogHttpClient = async () => ({ status: 503, body: "tinybird overloaded" });
    let caught: unknown;
    try {
      await writeQueryLog(http, [makeEntry("evt.x")]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QueryLogWriteError);
    if (caught instanceof QueryLogWriteError) {
      expect(caught.status).toBe(503);
      expect(caught.body).toBe("tinybird overloaded");
    }
  });

  it("propagates AbortSignal to the http client", async () => {
    const captured: { signal?: AbortSignal } = {};
    const http: QueryLogHttpClient = async (_req, signal) => {
      captured.signal = signal;
      return { status: 202 };
    };
    const ac = new AbortController();
    await writeQueryLog(http, [makeEntry("evt.x")], ac.signal);
    expect(captured.signal).toBe(ac.signal);
  });
});

describe("createQueryLogWriter", () => {
  it("requires either token or httpClient", () => {
    expect(() => createQueryLogWriter({})).toThrow(/token.+httpClient/);
  });

  it("uses the injected httpClient (token unused)", async () => {
    const http: QueryLogHttpClient = vi.fn(async () => ({ status: 202 }));
    const write = createQueryLogWriter({ httpClient: http });
    await write([makeEntry("evt.x")]);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("POSTs NDJSON to /v0/events?name=query_log&wait=true with bearer auth", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 202 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const write = createQueryLogWriter({ token: "tok_tb" });
      await write([makeEntry("evt.x")]);
      const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
        .calls;
      const [url, init] = calls[0] ?? [];
      expect(url).toBe("https://api.tinybird.co/v0/events?name=query_log&wait=true");
      const headers = init?.headers as Record<string, string>;
      expect(headers["authorization"]).toBe("Bearer tok_tb");
      expect(headers["content-type"]).toBe("application/x-ndjson");
      expect(typeof init?.body).toBe("string");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("honours custom apiBase + datasource", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 202 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const write = createQueryLogWriter({
        token: "tok_tb",
        apiBase: "https://api.us-east.tinybird.co",
        datasource: "query_log_staging",
      });
      await write([makeEntry("evt.x")]);
      const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
        .calls;
      const [url] = calls[0] ?? [];
      expect(url).toBe(
        "https://api.us-east.tinybird.co/v0/events?name=query_log_staging&wait=true",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
