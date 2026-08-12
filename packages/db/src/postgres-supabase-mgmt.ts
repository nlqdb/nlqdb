// BYO Supabase over the Management-API transport — runs SQL against a user's
// Supabase project through `POST /v1/projects/{ref}/database/query` (HTTPS),
// NOT a raw Postgres socket. This is the transport that actually makes Supabase
// reachable from Cloudflare Workers: postgres.js over the Workers `connect()`
// socket hangs ~18 s against the Supavisor pooler then fails (the field failure
// of `SK-DBCONN-002` observed in production), because the workerd socket + TLS
// upgrade path is fragile for that pooler. The Management-API endpoint instead
// executes the SQL *server-side inside Supabase* and authorises with the user's
// OAuth **access token** — no DB password, no socket, no TLS-upgrade fragility.
//
// It exposes the same `PostgresQueryFn` seam the Neon / socket adapters do, so
// the connect-time introspector (`introspectPostgres`, `SK-DB-014`) and
// `renderByoPostgresSchema` reuse **unchanged** — one introspection logic, only
// the transport differs (`GLOBAL-017`). Every call sets `read_only: true` so
// the SQL runs in an engine-enforced READ ONLY transaction even though the
// Management API runs as the project's admin: nlqdb never writes to a connected
// Supabase database, and no read-only role has to be provisioned in it.
//
// Auth rides the `Authorization: Bearer` header, never the URL, so the token
// can't leak into a span, an access log, or a redirect `Referer`. Non-2xx fails
// loud (`GLOBAL-012`) with a one-sentence, status-keyed message that echoes
// neither the SQL nor the token. Owned by `packages/db` (`GLOBAL-021`); `fetch`
// only, zero new deps (`GLOBAL-013`).
//
// Sources (P2, 2026-08): Supabase Management API "Run a query"
// (POST /v1/projects/{ref}/database/query — body {query, parameters, read_only};
// Bearer OAuth token; 201 success / 401 / 403 / 429 / 500).

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { PostgresQueryFn } from "./postgres.ts";
import type { Row } from "./types.ts";

const DEFAULT_API_BASE = "https://api.supabase.com";
const DEFAULT_TIMEOUT_MS = 30_000;

export type SupabaseMgmtOptions = {
  // Injected for tests; production uses the global Workers `fetch`.
  fetchImpl?: typeof fetch;
  // Per-call abort deadline. A hung Management-API call must not stall the
  // connect handshake or the /v1/ask request behind it.
  timeoutMs?: number;
  // Override the API origin (tests / self-hosted Supabase). Defaults to
  // `https://api.supabase.com`.
  apiBase?: string;
};

// A non-2xx Management-API response. The message is one sentence, carries the
// status, and echoes neither the SQL nor the token (`GLOBAL-012`) so it is safe
// to log and surface.
export class SupabaseMgmtError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "SupabaseMgmtError";
    this.statusCode = statusCode;
  }
}

// Build a `PostgresQueryFn` bound to one Supabase project + access token. The
// returned function is what `introspectPostgres` (and the /v1/ask BYO-Supabase
// branch) call: `(sql, params, signal?) => { rows, rowCount }`. Every call runs
// read-only.
export function openSupabaseMgmtPostgres(
  projectRef: string,
  accessToken: string,
  opts: SupabaseMgmtOptions = {},
): { query: PostgresQueryFn } {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiBase = (opts.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, "");
  const url = `${apiBase}/v1/projects/${projectRef}/database/query`;
  const tracer = trace.getTracer("@nlqdb/db");

  const query: PostgresQueryFn = async (sql, params, signal) => {
    const operation = detectOperation(sql);
    return tracer.startActiveSpan(
      "db.query",
      {
        attributes: {
          "db.system": "postgresql",
          "db.operation.name": operation,
          // The user's own project ref — safe on a connect-debug span (never a
          // metric label); the SQL, params, and token never go on the span.
          "db.namespace": projectRef,
          "nlqdb.transport": "supabase-mgmt",
        },
      },
      async (span) => {
        const startedAt = performance.now();
        let aborted = false;
        try {
          // Combine the caller's signal with a timeout deadline — abort on
          // either. A client disconnect or a slow Management API both cancel
          // the in-flight fetch.
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const onAbort = () => controller.abort();
          if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener("abort", onAbort, { once: true });
          }

          try {
            const res = await fetchImpl(url, {
              method: "POST",
              headers: {
                authorization: `Bearer ${accessToken}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({
                query: sql,
                parameters: params ?? [],
                // Engine-enforced READ ONLY transaction — the load-bearing
                // guard that keeps an admin-scoped token from ever writing to
                // the user's database, regardless of what SQL the planner emits.
                read_only: true,
              }),
              signal: controller.signal,
            });

            if (!res.ok) {
              throw classifyHttpError(res.status);
            }

            // The endpoint returns the result rows as a JSON array. A malformed
            // body is fail-loud, not a silently-empty result.
            const body = (await res.json()) as unknown;
            const rows = extractRows(body);
            return { rows, rowCount: rows.length };
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

  return { query };
}

// The Management API returns a bare JSON array of row objects. Accept a
// `{ result: [...] }` wrapper defensively (the endpoint is Beta), but reject any
// other shape loudly so an unexpected body never masquerades as an empty schema.
function extractRows(body: unknown): Row[] {
  if (Array.isArray(body)) return body as Row[];
  if (body && typeof body === "object" && Array.isArray((body as { result?: unknown }).result)) {
    return (body as { result: Row[] }).result;
  }
  throw new SupabaseMgmtError(
    "Supabase returned an unexpected response running the query; retry, or reconnect the database.",
    200,
  );
}

// Map a non-2xx Management-API response to a typed, one-sentence error keyed by
// status — no SQL, no token in the message (`GLOBAL-012`).
function classifyHttpError(status: number): SupabaseMgmtError {
  if (status === 401 || status === 403) {
    return new SupabaseMgmtError(
      `Supabase rejected the access token (HTTP ${status}); reconnect the database to re-authorize.`,
      status,
    );
  }
  if (status === 429) {
    return new SupabaseMgmtError(
      "Supabase rate-limited the request (HTTP 429); retry in a moment.",
      status,
    );
  }
  return new SupabaseMgmtError(
    `Supabase could not run the query (HTTP ${status}); check the project is reachable and retry.`,
    status,
  );
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

// Leading-keyword classification for the OTel `db.operation.name` attribute.
// Read-only in practice (every call sets `read_only: true`), so this is almost
// always `select`; kept general for introspection's `with`/`select` mix.
function detectOperation(sql: string): string {
  return /^\s*(\w+)/.exec(sql)?.[1]?.toLowerCase() ?? "query";
}
