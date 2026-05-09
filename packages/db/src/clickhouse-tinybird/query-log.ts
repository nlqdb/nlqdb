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
// Idempotency: each row carries the producer-side `EventEnvelope.id`
// as `event_id`. Tinybird's `/v0/events` endpoint does NOT dedupe
// natively, and Cloudflare Queues redelivers on `msg.retry()` and on
// partial-batch ack failures, so duplicate rows are expected at the
// wire level. Consumers (the W5 daily reshape) MUST dedupe on
// `event_id` if exactly-once is required.
//
// `SK-MULTIENG-001` names the read path's transport contract; the write
// path is symmetric — same HTTP-client seam (`TinybirdHttpClient`-equivalent),
// same OTel-friendly fetch wrapper, same no-pool / no-shared-state
// posture.
//
// OTel: `writeQueryLog` emits a `db.query` span (`db.system=other_sql`,
// `db.operation.name=EVENTS_WRITE`) so latency lands on the shared
// `nlqdb.db.duration_ms{operation}` histogram alongside the read path
// (GLOBAL-014 parity with the `createTinybirdAdapter` adapter).
//
// Failure model: this function THROWS on non-2xx so the caller (the
// sink) decides how to react. The sink owns the retry budget and the
// circuit-breaker; the writer just reports the wire outcome plus the
// HTTP status so the caller can label OTel attributes consistently.

import type { AskCompletedEvent } from "@nlqdb/events";
import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export type { AskCompletedEvent } from "@nlqdb/events";

// Each row is the producer envelope's id paired with its
// `AskCompletedEvent` payload. The writer keeps these together so the
// wire row can carry `event_id` (the envelope's stable id) for
// downstream dedup — see the file-header note on Cloudflare Queues
// redelivery and Tinybird's lack of native dedup.
export type QueryLogEntry = {
  eventId: string;
  event: AskCompletedEvent;
};

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
// function takes a batch of typed entries and POSTs them as one NDJSON
// payload. Stateless — the closure carries config, not connections.
export function createQueryLogWriter(
  opts: QueryLogWriterOptions,
): (entries: QueryLogEntry[], signal?: AbortSignal) => Promise<WriteQueryLogResult> {
  const httpClient = opts.httpClient ?? buildFetchClient(opts);
  return (entries, signal) => writeQueryLog(httpClient, entries, signal);
}

/**
 * Append a batch of `ask.completed` rows to the Tinybird `query_log`
 * Data Source.
 *
 * Each entry pairs the `EventEnvelope.id` with its `AskCompletedEvent`
 * payload. The id is written to the `event_id` column on every row so
 * downstream consumers can deduplicate.
 *
 * **Idempotency:** Tinybird does not dedupe `/v0/events` writes
 * natively, and Cloudflare Queues redelivers on `msg.retry()` and on
 * partial-batch ack failures. Consumers (e.g. the W5 daily reshape)
 * MUST dedupe on `event_id` if exactly-once semantics are required.
 *
 * Throws `QueryLogWriteError` on non-2xx so the caller can attach the
 * status to its OTel span and decide whether to retry. Empty batches
 * are a no-op (no HTTP call).
 *
 * Direct entry point — the sink calls this with an injected HTTP client
 * (under test) or a writer constructed via `createQueryLogWriter` (in
 * production). The two-layer split mirrors the read-path adapter:
 * `createTinybirdAdapter` builds the client; `execute` is the typed
 * call. Here `createQueryLogWriter` builds the client; `writeQueryLog`
 * is the typed call.
 */
export async function writeQueryLog(
  http: QueryLogHttpClient,
  entries: QueryLogEntry[],
  signal?: AbortSignal,
): Promise<WriteQueryLogResult> {
  if (entries.length === 0) {
    return { rowsWritten: 0, status: 0 };
  }
  // GLOBAL-014 parity with the read path: emit `db.query` so write
  // latency lands on the same `nlqdb.db.duration_ms{operation}`
  // histogram. `db.system=other_sql` matches `SK-MULTIENG-004` —
  // ClickHouse has no canonical OTel value, and `EVENTS_WRITE` is the
  // canonical operation name for the Data Source append boundary.
  const tracer = trace.getTracer("@nlqdb/db");
  return tracer.startActiveSpan(
    "db.query",
    {
      attributes: {
        "db.system": "other_sql",
        "db.operation.name": "EVENTS_WRITE",
        "nlqdb.events.batch_size": entries.length,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        const ndjson = entries
          .map(toWireRow)
          .map((row) => JSON.stringify(row))
          .join("\n");
        const response = await http({ ndjson, rowCount: entries.length }, signal);
        if (response.status < 200 || response.status >= 300) {
          const err = new QueryLogWriteError(
            `tinybird query_log write failed: HTTP ${response.status}`,
            response.status,
            response.body,
          );
          span.setAttribute("http.response.status_code", response.status);
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          throw err;
        }
        span.setAttribute("http.response.status_code", response.status);
        span.setAttribute("nlqdb.events.rows_written", entries.length);
        return { rowsWritten: entries.length, status: response.status };
      } finally {
        const elapsed = performance.now() - startedAt;
        dbDurationMs().record(elapsed, { operation: "EVENTS_WRITE" });
        span.end();
      }
    },
  );
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

// Typed wire row — the JSON shape the NDJSON line carries. The Data
// Source schema in `infrastructure/tinybird/datasources/query_log.datasource`
// is the canonical column list; this type is the in-memory mirror.
// Widening either requires a same-PR edit to both — Tinybird ingest
// silently quarantines mismatched rows.
export type QueryLogRow = {
  event_id: string;
  db_id: string;
  schema_hash: string;
  query_hash: string;
  plan_shape: string;
  engine: "postgres" | "clickhouse";
  // Orchestrator-internal latency (orchestrate-entry → emit), NOT the
  // §1 SLO request-in → response-out timing. The W5 analyser must not
  // conflate the two — hence the explicit `orchestrator_` prefix.
  orchestrator_ms: number;
  rows_returned: number;
  // ClickHouse `DateTime64(3)` ISO format ("YYYY-MM-DD HH:MM:SS.sss"),
  // millisecond-precision UTC.
  ts: string;
};

// Project the typed envelope+event pair into the Tinybird row shape.
//
// `ts` is converted from Unix-ms to ClickHouse `DateTime64(3)` ISO
// format ("YYYY-MM-DD HH:MM:SS.sss") — Tinybird parses this via
// `parseDateTimeBestEffort` on ingest. Using the ISO stamp keeps the
// wire format human-readable without a custom codec; the millisecond
// precision is preserved.
function toWireRow(entry: QueryLogEntry): QueryLogRow {
  const { eventId, event } = entry;
  return {
    event_id: eventId,
    db_id: event.dbId,
    schema_hash: event.schemaHash,
    query_hash: event.queryHash,
    plan_shape: event.planShape,
    engine: event.engine,
    orchestrator_ms: event.orchestratorMs,
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
