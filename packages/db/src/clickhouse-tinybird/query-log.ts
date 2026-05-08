// Tinybird query-log writer (W4 sink path).
//
// This is the single owner of writes into the `query_log` Data Source —
// `apps/events-worker/src/sinks/query-log.ts` calls `writeQueryLog`
// rather than POSTing to Tinybird itself. Per `GLOBAL-021` every
// external system has one canonical owner; the Tinybird HTTP boundary
// lives here in `packages/db/clickhouse-tinybird/` and never leaks past
// it (no Tinybird token, no `fetch` shape, no API base in any other
// package).
//
// The write boundary is the `/v0/events?name=<datasource>&wait=true`
// endpoint. Body is one JSON event per line (NDJSON) per Tinybird's
// public contract; the `wait=true` flag returns only after the row is
// committed (worth the round-trip-time on the events-worker since the
// worker invocation already sits behind the queue, and "committed
// before ack" gives the cleanest retry story).
//
// `SK-MULTIENG-001` names the read path's transport contract; the write
// path is symmetric — same HTTP-client seam (`TinybirdHttpClient`-equivalent),
// same OTel-friendly fetch wrapper, same no-pool / no-shared-state
// posture.
//
// Failure model: this function THROWS on non-2xx so the caller (the
// sink) decides how to react. The sink owns the retry budget and the
// circuit-breaker; the writer just reports the wire outcome plus the
// HTTP status so the caller can label OTel attributes consistently.

import type { AskCompletedEvent } from "@nlqdb/events";

export type { AskCompletedEvent } from "@nlqdb/events";

// HTTP-client seam mirrors the read-path adapter's `TinybirdHttpClient`
// — production wires this to `fetch`, tests inject a stub. The shape
// is narrower than the read-path client because the only call we make
// is the events POST.
export type QueryLogHttpClient = (
  request: QueryLogRequest,
  signal?: AbortSignal,
) => Promise<QueryLogResponse>;

export type QueryLogRequest = {
  // NDJSON-encoded event lines. The owner module materialises the
  // JSON-serialise step so the caller passes typed events and the
  // Tinybird wire format stays inside this file.
  ndjson: string;
  rowCount: number;
};

export type QueryLogResponse = {
  status: number;
  // Tinybird `/v0/events?wait=true` response body. Includes
  // `successful_rows` / `quarantined_rows` per their public contract.
  // We carry it through unparsed so the caller can attach the raw
  // outcome to a span without us guessing at field names that may shift.
  body?: string;
};

export type WriteQueryLogResult = {
  rowsWritten: number;
  status: number;
};

export type QueryLogWriterOptions = {
  // Workspace token with `DATASOURCE:APPEND` scope on `query_log`.
  // Required when the production HTTP client is used; ignored when
  // `httpClient` is provided.
  token?: string;
  // Override the Tinybird API base. Defaults to the EU gateway
  // (`https://api.tinybird.co`) — matches `createTinybirdAdapter`'s
  // default so a workspace's read + write paths share a host.
  apiBase?: string;
  // Test override — bypasses the HTTP layer. When provided, `token`
  // and `apiBase` are ignored.
  httpClient?: QueryLogHttpClient;
  // Data Source name. Defaults to `query_log` (the canonical name in
  // `infrastructure/tinybird/datasources/query_log.datasource`); the
  // override is escape-hatch for staging workspaces.
  datasource?: string;
};

// Construct a writer bound to a Tinybird workspace. The returned
// function takes a batch of typed events and POSTs them as one NDJSON
// payload. Stateless — the closure carries config, not connections.
export function createQueryLogWriter(
  opts: QueryLogWriterOptions,
): (events: AskCompletedEvent[], signal?: AbortSignal) => Promise<WriteQueryLogResult> {
  const httpClient = opts.httpClient ?? buildFetchClient(opts);
  return (events, signal) => writeQueryLog(httpClient, events, signal);
}

// Direct entry point — the sink calls this with an injected HTTP client
// (under test) or a writer constructed via `createQueryLogWriter` (in
// production). The two-layer split mirrors the read-path adapter:
// `createTinybirdAdapter` builds the client; `execute` is the typed
// call. Here `createQueryLogWriter` builds the client; `writeQueryLog`
// is the typed call.
export async function writeQueryLog(
  http: QueryLogHttpClient,
  events: AskCompletedEvent[],
  signal?: AbortSignal,
): Promise<WriteQueryLogResult> {
  if (events.length === 0) {
    return { rowsWritten: 0, status: 0 };
  }
  const ndjson = events
    .map(toWireRow)
    .map((row) => JSON.stringify(row))
    .join("\n");
  const response = await http({ ndjson, rowCount: events.length }, signal);
  if (response.status < 200 || response.status >= 300) {
    throw new QueryLogWriteError(
      `tinybird query_log write failed: HTTP ${response.status}`,
      response.status,
      response.body,
    );
  }
  return { rowsWritten: events.length, status: response.status };
}

// Typed error so the sink can attach the HTTP status to an OTel span
// without re-parsing the message. Mirrors `TinybirdValidationError` on
// the read path.
export class QueryLogWriteError extends Error {
  readonly status: number;
  readonly body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "QueryLogWriteError";
    this.status = status;
    this.body = body;
  }
}

// Project the typed event into the Tinybird row shape. The Data Source
// schema in `infrastructure/tinybird/datasources/query_log.datasource`
// is the canonical column list — adding a column is a coordinated edit
// here + there.
//
// `ts` is converted from Unix-ms to ClickHouse `DateTime64(3)` ISO
// format ("YYYY-MM-DD HH:MM:SS.sss") — Tinybird parses this via
// `parseDateTimeBestEffort` on ingest. Using the ISO stamp keeps the
// wire format human-readable without a custom codec; the millisecond
// precision is preserved.
function toWireRow(event: AskCompletedEvent): Record<string, unknown> {
  return {
    db_id: event.dbId,
    schema_hash: event.schemaHash,
    query_hash: event.queryHash,
    plan_shape: event.planShape,
    engine: event.engine,
    ms: event.ms,
    rows_returned: event.rowsReturned,
    ts: toClickHouseDateTime(event.ts),
  };
}

function toClickHouseDateTime(unixMs: number): string {
  const d = new Date(unixMs);
  const pad2 = (n: number): string => n.toString().padStart(2, "0");
  const pad3 = (n: number): string => n.toString().padStart(3, "0");
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(
    d.getUTCHours(),
  )}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.${pad3(d.getUTCMilliseconds())}`;
}

// Build the production `fetch`-backed HTTP client. Matches
// `createTinybirdAdapter`'s no-pool / no-shared-state posture.
//
// `wait=true` makes the request synchronous on Tinybird's side — the
// row is committed before the response returns. The latency cost is
// acceptable here because we sit behind the events-worker queue, not
// on the user's `/v1/ask` request path.
function buildFetchClient(opts: QueryLogWriterOptions): QueryLogHttpClient {
  if (!opts.token) {
    throw new Error("createQueryLogWriter: `token` or `httpClient` override is required");
  }
  const token = opts.token;
  const base = (opts.apiBase ?? "https://api.tinybird.co").replace(/\/$/, "");
  const datasource = opts.datasource ?? "query_log";
  const url = `${base}/v0/events?name=${encodeURIComponent(datasource)}&wait=true`;

  return async (request, signal) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/x-ndjson",
      },
      body: request.ndjson,
      signal,
    });
    const body = await safeReadText(res);
    return { status: res.status, body };
  };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
