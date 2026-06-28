// BYO ClickHouse live-query adapter — the `ClickhouseQueryFn` factory the BYO
// connect path (`SK-MULTIENG-005`, `architecture.md §3.6.7`) binds to a
// validated, egress-guarded host. It is the production half of the seam
// `introspect-clickhouse.ts` declares (`ClickhouseQueryFn`): the introspector
// passes `{database:String}`-bound params name→string, and this adapter turns
// each into a `param_<name>` HTTP arg so ClickHouse binds them server-side —
// the SQL never interpolates a value. It owns no pool and no cross-request
// state (the `SK-DB-003` no-pool posture the Tinybird adapter and the PG
// adapter share): one `fetch` per call. Pure of framework deps, zero new deps,
// `fetch` only (`GLOBAL-013`); owned by `packages/db` (`GLOBAL-021`).
//
// Auth rides headers (`X-ClickHouse-User` / `X-ClickHouse-Key`), never the URL,
// so the credential can't leak into a span, a redirect `Referer`, or an access
// log. Non-2xx fails loud (`GLOBAL-012`) with a one-sentence, status-keyed error
// that echoes neither the SQL nor the credentials.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  DB_NAMESPACE,
  DB_OPERATION_NAME,
  DB_SYSTEM,
  DB_SYSTEM_VALUE,
  detectSqlOperation,
} from "./clickhouse-tinybird/otel-attrs.ts";
import type { DnsResolver } from "./egress-guard.ts";
import { guardEgressHostResolved } from "./egress-guard.ts";
import type { ClickhouseQueryFn } from "./introspect-clickhouse.ts";
import type { Row } from "./types.ts";

// The connection coordinates the BYO connect path resolves once and seals
// (`GLOBAL-031`); a superset of `ParsedClickhouseUrl` with the password the
// redacted parse drops. `port === null` means the scheme default applies.
export type ClickhouseConnSpec = {
  host: string;
  port: number | null;
  secure: boolean;
  database: string;
  user: string | null;
  password: string | null;
};

export type ClickhouseByoOptions = {
  // Injected for tests; production uses the global Workers `fetch`.
  fetchImpl?: typeof fetch;
  // Per-call abort deadline. A hung BYO host must not stall the connect
  // handshake or the /v1/ask request behind it.
  timeoutMs?: number;
  // When provided, every call re-runs the egress guard against this resolver
  // before the fetch (DNS-rebind mitigation, `GLOBAL-035`). Omit only when an
  // earlier layer has already pinned the host to a validated IP.
  resolve?: DnsResolver;
};

const DEFAULT_TIMEOUT_MS = 30_000;

const NEXT_ACTION = "check the ClickHouse endpoint, credentials, and that it is reachable.";

// A non-2xx (or rebind-rejected) BYO ClickHouse call. The message is one
// sentence, carries the status class, and echoes neither the SQL nor the
// credentials (`GLOBAL-012`) so it is safe to log and surface.
export class ClickhouseByoError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ClickhouseByoError";
    this.statusCode = statusCode;
  }
}

// Build a `ClickhouseQueryFn` bound to one BYO ClickHouse host. The returned
// function is what `introspectClickhouse` (and the /v1/ask ClickHouse branch)
// call: `(sql, params, signal?) => { rows }`.
export function buildClickhouseByoQuery(
  spec: ClickhouseConnSpec,
  opts: ClickhouseByoOptions = {},
): ClickhouseQueryFn {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resolve = opts.resolve;
  const tracer = trace.getTracer("@nlqdb/db");

  return async (sql, params, signal) => {
    const operation = detectSqlOperation(sql);
    return tracer.startActiveSpan(
      "db.query",
      {
        attributes: {
          [DB_SYSTEM]: DB_SYSTEM_VALUE,
          [DB_OPERATION_NAME]: operation,
          // The user's own database name — safe on a connect-debug span (never
          // a metric label); SQL params + credentials never go on the span.
          [DB_NAMESPACE]: spec.database,
        },
      },
      async (span) => {
        const startedAt = performance.now();
        let aborted = false;
        try {
          // Re-guard the host on every call before fetching. The pure egress
          // check ran at connect time, but DNS can rebind between then and now,
          // so a private/reserved resolve is rejected here — the async TOCTOU
          // half of `GLOBAL-035` that `egress-guard.ts` documents. Full closure
          // needs the connector to pin to the validated IPs; this narrows the
          // window the connect-time check can't bound.
          if (resolve) {
            const verdict = await guardEgressHostResolved(spec.host, resolve);
            if (!verdict.ok) {
              throw new ClickhouseByoError(verdict.message, 0);
            }
          }

          // Combine the caller's signal with a timeout deadline — abort on
          // either. A client disconnect or a slow BYO host both cancel the
          // in-flight fetch.
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const onAbort = () => controller.abort();
          if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener("abort", onAbort, { once: true });
          }

          try {
            const res = await fetchImpl(buildUrl(spec, params), {
              method: "POST",
              headers: buildHeaders(spec),
              body: buildBody(sql),
              signal: controller.signal,
            });

            if (!res.ok) {
              throw classifyHttpError(res.status);
            }

            // 2xx still has to parse — a malformed body is fail-loud, not a
            // silent empty result.
            const body = (await res.json()) as { data?: Row[] };
            return { rows: body.data ?? [] };
          } finally {
            clearTimeout(timer);
            if (signal) signal.removeEventListener("abort", onAbort);
          }
        } catch (err) {
          aborted = isAbortError(err);
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          dbDurationMs().record(
            performance.now() - startedAt,
            aborted ? { operation, outcome: "aborted" } : { operation },
          );
          span.end();
        }
      },
    );
  };
}

// `${scheme}://${host}[:port]/?database=<db>&param_<name>=<value>...`. The
// database and every bound param ride the query string; credentials never do.
function buildUrl(spec: ClickhouseConnSpec, params: Record<string, string>): string {
  const scheme = spec.secure ? "https" : "http";
  const authority = spec.port ? `${spec.host}:${spec.port}` : spec.host;
  const qs = new URLSearchParams();
  qs.set("database", spec.database);
  // ClickHouse binds a `{name:Type}` placeholder from a `param_<name>` HTTP
  // arg — the server-side binding the introspector relies on, so a value is
  // never interpolated into the SQL.
  for (const [name, value] of Object.entries(params)) {
    qs.set(`param_${name}`, value);
  }
  return `${scheme}://${authority}/?${qs.toString()}`;
}

function buildHeaders(spec: ClickhouseConnSpec): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "text/plain" };
  // Credentials in headers, never the URL — so they can't leak into a span,
  // an access log, or a redirect's Referer.
  if (spec.user !== null) headers["X-ClickHouse-User"] = spec.user;
  if (spec.password !== null) headers["X-ClickHouse-Key"] = spec.password;
  return headers;
}

// Trim trailing whitespace + `;` before appending ` FORMAT JSON` (borrowed from
// the Tinybird adapter): a validated SQL ending in `;` would otherwise produce
// `... FROM events; FORMAT JSON`, which ClickHouse rejects — and is the entry
// vector for any format-injection riding on a trailing-semicolon gap.
function buildBody(sql: string): string {
  const cleaned = sql.replace(/[\s;]+$/, "");
  return `${cleaned} FORMAT JSON`;
}

// Map a non-2xx ClickHouse HTTP response to a typed, one-sentence error keyed
// by status class — no SQL, no credentials in the message (`GLOBAL-012`).
function classifyHttpError(status: number): ClickhouseByoError {
  if (status === 401 || status === 403) {
    return new ClickhouseByoError(
      `ClickHouse rejected the credentials (HTTP ${status}); ${NEXT_ACTION}`,
      status,
    );
  }
  if (status >= 500 && status <= 599) {
    return new ClickhouseByoError(
      `ClickHouse upstream error (HTTP ${status}); ${NEXT_ACTION}`,
      status,
    );
  }
  return new ClickhouseByoError(
    `ClickHouse rejected the request (HTTP ${status}); ${NEXT_ACTION}`,
    status,
  );
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { name?: unknown }).name === "AbortError";
}
