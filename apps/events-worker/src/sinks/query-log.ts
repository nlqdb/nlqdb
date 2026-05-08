// Tinybird query_log sink (W4).
//
// Drains `ask.completed` events off `EVENTS_QUEUE` into the Tinybird
// `query_log` Data Source — the input W5's daily reshape consumes.
//
// `GLOBAL-021` ownership: this sink does NOT hold a Tinybird token or
// fetch client of its own. The Tinybird HTTP boundary lives in
// `packages/db/clickhouse-tinybird/query-log.ts`; we call into
// `writeQueryLog` and project the queue payload to the typed batch.
// Owner-to-owner library dependency is explicitly allowed by GLOBAL-021.
//
// Failure model:
//   - Tinybird non-2xx → throw → consumer `msg.retry()`s the messages
//     in the batch. Cloudflare Queues' `max_retries` (3) caps damage.
//   - 5 consecutive failures across batches → circuit-break. The next
//     batch logs + ack-and-drops the messages without calling Tinybird.
//     The breaker resets on the first successful write. Module-scope
//     state — best-effort across isolate recycles, which is fine
//     because failures persist via queue retries.
//
// Telemetry: one `nlqdb.events.sink.query_log` span per batch with
// histogram of batch size and the Tinybird HTTP status as a span
// attribute. Mirrors `nlqdb.events.dispatch` shape so dashboards
// aggregate cleanly across sinks.

import {
  createQueryLogWriter,
  type QueryLogEntry,
  QueryLogWriteError,
  type WriteQueryLogResult,
} from "@nlqdb/db";
import { eventsSinkQueryLogBatchSize, eventsSinkQueryLogFailuresTotal } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export type QueryLogConfig = {
  token: string;
  apiBase?: string;
  // Test seam — bypasses the @nlqdb/db writer entirely. When set,
  // `token` / `apiBase` are ignored and the sink calls this directly
  // with the projected entry batch.
  writer?: (entries: QueryLogEntry[], signal?: AbortSignal) => Promise<WriteQueryLogResult>;
};

// Circuit-breaker threshold: 5 consecutive failed batches trips the
// breaker. Picked because Cloudflare Queues' `max_retries=3` on the
// consumer means three same-batch retries are already in motion; once
// a fifth distinct batch fails, the upstream is consistently down and
// further attempts just burn the daily request budget on Tinybird's
// 1k/day free tier.
const CIRCUIT_BREAKER_THRESHOLD = 5;

let consecutiveFailures = 0;
let breakerOpen = false;

// Test-only: reset the module-scoped breaker state between cases.
export function _resetCircuitBreakerForTest(): void {
  consecutiveFailures = 0;
  breakerOpen = false;
}

// `true` when the breaker is open; the sink will short-circuit to
// ack-and-drop. Exposed for tests + tracing assertions.
export function _isCircuitBreakerOpen(): boolean {
  return breakerOpen;
}

// Drain one batch of `ask.completed` events. Caller passes the events
// already filtered from the mixed-name batch; this function owns the
// projection to Tinybird's wire format and the breaker bookkeeping.
//
// Returns `{ ok: true }` on success; throws on failure so the consumer
// retries each message in the batch. Returns `{ ok: false,
// circuitOpen: true }` when the breaker is open — the consumer treats
// that as ack-and-drop (queue retries won't help an upstream that's
// consistently down; the OTel counter and span-error are the operator
// signal).
export type PublishOutcome = { ok: true } | { ok: false; circuitOpen: true };

export async function publishToQueryLog(
  config: QueryLogConfig,
  entries: QueryLogEntry[],
): Promise<PublishOutcome> {
  if (entries.length === 0) return { ok: true };

  const tracer = trace.getTracer("@nlqdb/events-worker");
  return tracer.startActiveSpan(
    "nlqdb.events.sink.query_log",
    async (span): Promise<PublishOutcome> => {
      span.setAttribute("nlqdb.events.batch_size", entries.length);
      eventsSinkQueryLogBatchSize().record(entries.length);

      if (breakerOpen) {
        span.setAttribute("nlqdb.events.circuit_open", true);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `circuit-breaker open after ${consecutiveFailures} consecutive failures`,
        });
        span.end();
        return { ok: false, circuitOpen: true };
      }

      const writer =
        config.writer ??
        createQueryLogWriter({
          token: config.token,
          apiBase: config.apiBase,
        });

      try {
        const result = await writer(entries);
        span.setAttribute("http.response.status_code", result.status);
        span.setAttribute("nlqdb.events.rows_written", result.rowsWritten);
        consecutiveFailures = 0;
        span.end();
        return { ok: true };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const status = error instanceof QueryLogWriteError ? error.status : 0;
        const statusClass = httpStatusClass(status);
        span.setAttribute("http.response.status_code", status);
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        eventsSinkQueryLogFailuresTotal().add(1, { status_class: statusClass });

        consecutiveFailures += 1;
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          breakerOpen = true;
          span.setAttribute("nlqdb.events.circuit_open", true);
          // Log so an operator without OTel attached sees the trip in
          // `wrangler tail`. The span carries the same signal for
          // OTel-attached environments.
          console.error(
            `query_log circuit-breaker tripped after ${consecutiveFailures} consecutive failures`,
          );
        }
        span.end();
        throw error;
      }
    },
  );
}

// Clamp the HTTP status into the catalog labels permitted by
// `docs/performance.md §3.3`. The failures counter only fires on
// failures, so the only reachable buckets are `4xx`, `5xx`, and
// `transport` (fetch-throws / no HTTP status). Anything outside
// those — fetch with status 0, defensively negative, or sub-200 —
// is bucketed as `transport` to keep the cardinality budget honest;
// `unknown` / `2xx` / `3xx` are deliberately not emitted.
function httpStatusClass(status: number): "4xx" | "5xx" | "transport" {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  return "transport";
}
