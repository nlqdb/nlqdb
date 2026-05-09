// ClickHouse-via-Tinybird adapter (`SK-MULTIENG-002`, W2).
//
// Two call shapes, one HTTP boundary:
//   • `pipe` — `GET /v0/pipes/<name>.json?<params>`. Query-string
//     parameters bind to Tinybird's templated Pipe. The Pipe SQL lives
//     server-side, so we never carry `db.query.text`.
//   • `sql` — `POST /v0/sql` with the SQL in the body. The
//     `GLOBAL-015` escape hatch; raw SQL goes through the validator
//     before this adapter sees it.
//
// `SK-DB-003`-equivalent posture: no pool, no client state across
// requests. The adapter is a thin wrapper over a typed `fetch`-shaped
// HTTP client that's constructed lazily on first use. Tests inject the
// HTTP client through the `httpClient` option (mirrors `SK-DB-006`'s
// `query` injection seam on the PG adapter).
//
// Buffered AsyncIterable: the Tinybird JSON response is materialised
// in one read; we yield from memory via the shared
// `bufferedEngineResult` helper. Streaming via `format=ndjson` is a
// future optimisation — the contract is `AsyncIterable<Row>` so we can
// swap in a streaming projection without touching consumers
// (`SK-MULTIENG-001`).

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { bufferedEngineResult } from "../engine-result.ts";
import type {
  ClickHouseEngineMeta,
  DatabaseAdapter,
  EnginePlan,
  EngineResult,
  Row,
} from "../types.ts";
import { buildSpanAttributes, detectSqlOperation, OP_PIPE_CALL } from "./otel-attrs.ts";
import { type AllowlistConfig, createValidator } from "./validator.ts";

// Internal HTTP-client shape — production wires this to `fetch`; tests
// inject a stub. Mirrors `SK-DB-006`'s pattern on the PG adapter so
// the seam is consistent across engines.
export type TinybirdHttpClient = (
  request: TinybirdRequest,
  signal?: AbortSignal,
) => Promise<TinybirdResponse>;

export type TinybirdRequest =
  | { kind: "pipe"; name: string; params: Record<string, unknown> }
  | { kind: "sql"; text: string };

// Subset of the Tinybird Pipe / Query API JSON response we consume.
// `meta` is the column schema, `data` is the row array, `statistics` is
// server-measured timing, `query_id` is the server-assigned correlator.
export type TinybirdResponse = {
  data: Row[];
  meta?: { name: string; type: string }[];
  rows?: number;
  rows_before_limit_at_least?: number;
  statistics?: {
    elapsed?: number;
    rows_read?: number;
    bytes_read?: number;
  };
  query_id?: string;
};

export type TinybirdAdapterOptions = {
  // PAT or workspace token with PIPE:READ scope for every Pipe in
  // `allowlist.pipes`. Required when the production HTTP client is
  // used; ignored when `httpClient` is provided.
  token?: string;
  // Workspace identifier — surfaces on the OTel span as `db.namespace`
  // (`SK-MULTIENG-004`) and is the cardinality cap for cross-workspace
  // attribute drift.
  workspace: string;
  // Per-construction allowlist. Pipes/tables outside the lists are
  // rejected by the validator (`SK-MULTIENG-004`).
  allowlist: AllowlistConfig;
  // Override the Tinybird API base URL. Defaults to the EU gateway
  // (`https://api.tinybird.co`); US / on-prem deployments override.
  apiBase?: string;
  // Test override — bypasses the HTTP layer entirely. When provided,
  // `token` and `apiBase` are ignored.
  httpClient?: TinybirdHttpClient;
};

export function createTinybirdAdapter(opts: TinybirdAdapterOptions): DatabaseAdapter {
  const httpClient = opts.httpClient ?? buildFetchClient(opts);
  const validator = createValidator(opts.allowlist);
  const tracer = trace.getTracer("@nlqdb/db");

  return {
    engine: "clickhouse",
    async execute(plan: EnginePlan, signal?: AbortSignal): Promise<EngineResult> {
      if (plan.engine !== "clickhouse") {
        throw new Error(`tinybird adapter received non-clickhouse plan: ${plan.engine}`);
      }
      // Exactly one of `pipe` / `sql` is allowed — both or neither
      // makes the call shape ambiguous. Caught here rather than at the
      // type level because the discriminated union still allows the
      // shape (`pipe?` and `sql?` are independent).
      const hasPipe = typeof plan.pipe === "string" && plan.pipe.length > 0;
      const hasSql = typeof plan.sql === "string" && plan.sql.length > 0;
      if (hasPipe === hasSql) {
        throw new Error("clickhouse plan must specify exactly one of `pipe` or `sql`");
      }

      const operation = hasPipe ? OP_PIPE_CALL : detectSqlOperation(plan.sql as string);
      const attrs = buildSpanAttributes({
        workspace: opts.workspace,
        operation,
        pipe: hasPipe ? (plan.pipe as string) : undefined,
        // `db.query.text` for raw-SQL plans only — pipe SQL lives
        // server-side (`SK-MULTIENG-004`). Capped at 4096 chars per
        // SK-OBS-009 to keep spans exportable.
        queryText: hasPipe ? undefined : (plan.sql as string).slice(0, 4096),
      });

      return tracer.startActiveSpan("db.query", { attributes: attrs }, async (span) => {
        const startedAt = performance.now();
        let aborted = false;
        try {
          // Validation runs inside the span so reject reasons surface
          // as errored `db.query` spans alongside genuine call
          // failures — same posture as `signal.throwIfAborted()` on
          // the PG adapter. The span is the single record of "the
          // adapter handled this plan, here's how it ended."
          const validation = hasPipe
            ? validator({ kind: "pipe", name: plan.pipe as string })
            : validator({ kind: "sql", text: plan.sql as string });
          if (!validation.ok) {
            throw new TinybirdValidationError(validation.reason, validation.matched);
          }
          signal?.throwIfAborted();
          const request: TinybirdRequest = hasPipe
            ? {
                kind: "pipe",
                name: plan.pipe as string,
                params: plan.params ?? {},
              }
            : { kind: "sql", text: plan.sql as string };
          const response = await httpClient(request, signal);

          if (response.query_id) {
            span.setAttribute("db.tinybird.query_id", response.query_id);
          }

          const meta: ClickHouseEngineMeta = {
            engine: "clickhouse",
            rowCount: response.rows ?? response.data.length,
          };
          if (hasPipe) meta.pipe = plan.pipe as string;
          if (response.meta) meta.fields = response.meta;
          if (response.statistics) meta.statistics = response.statistics;
          if (response.query_id) meta.queryId = response.query_id;

          return bufferedEngineResult(response.data, meta);
        } catch (err) {
          // Surface Retry-After on the span when Tinybird responded
          // 429 — the caller can back off without re-parsing the
          // error envelope.
          if (err instanceof TinybirdRateLimitError) {
            span.setAttribute("nlqdb.tinybird.retry_after_s", err.retryAfterSeconds);
          }
          aborted = isAbortError(err);
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          const elapsed = performance.now() - startedAt;
          // AbortError is a useful latency bucket but should not
          // pollute the unlabelled p99 — label the sample with
          // `outcome: "aborted"` so dashboards can filter it out of
          // the steady-state distribution.
          dbDurationMs().record(
            elapsed,
            aborted ? { operation, outcome: "aborted" } : { operation },
          );
          span.end();
        }
      });
    },
  };
}

// Validator failure surfaces as a typed error so the orchestrator can
// map it to a `GLOBAL-012`-shaped one-sentence error with the next
// action. Mirrors how the PG path threads `SqlRejectReason` from
// `validateSql` up to `/v1/ask`.
export class TinybirdValidationError extends Error {
  readonly reason: string;
  readonly matched?: string;
  constructor(reason: string, matched?: string) {
    super(
      matched
        ? `tinybird plan rejected: ${reason} (${matched})`
        : `tinybird plan rejected: ${reason}`,
    );
    this.name = "TinybirdValidationError";
    this.reason = reason;
    this.matched = matched;
  }
}

// Typed Tinybird HTTP errors. Each carries a `GLOBAL-012`-shaped
// one-sentence `hint` keyed by status class so the orchestrator can
// map the failure into a user-facing action without re-classifying the
// status code.
export class TinybirdAuthError extends Error {
  readonly statusCode: number;
  readonly hint: string;
  constructor(statusCode: number, body: string) {
    super(formatErrorMessage("auth", statusCode, body));
    this.name = "TinybirdAuthError";
    this.statusCode = statusCode;
    this.hint = "check TINYBIRD_TOKEN scope and Pipe ACL";
  }
}

export class TinybirdRateLimitError extends Error {
  readonly statusCode: number;
  readonly retryAfterSeconds: number;
  readonly hint: string;
  constructor(statusCode: number, retryAfterSeconds: number, body: string) {
    super(formatErrorMessage("rate-limit", statusCode, body));
    this.name = "TinybirdRateLimitError";
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
    this.hint = "rate limit hit; retry after Retry-After seconds";
  }
}

export class TinybirdServerError extends Error {
  readonly statusCode: number;
  readonly hint: string;
  constructor(statusCode: number, body: string) {
    super(formatErrorMessage("upstream", statusCode, body));
    this.name = "TinybirdServerError";
    this.statusCode = statusCode;
    this.hint = "Tinybird upstream error; will retry on next request";
  }
}

export class TinybirdRequestError extends Error {
  readonly statusCode: number;
  readonly hint: string;
  constructor(statusCode: number, body: string) {
    super(formatErrorMessage("request", statusCode, body));
    this.name = "TinybirdRequestError";
    this.statusCode = statusCode;
    this.hint = "Tinybird rejected the request; check the plan and parameters";
  }
}

// Wraps malformed Tinybird response bodies — when the HTTP request
// succeeded (2xx) but the JSON parse failed. Truncated body keeps the
// error one log line (`docs/guidelines.md §5`).
export class TinybirdResponseParseError extends Error {
  readonly bodySnippet: string;
  readonly hint: string;
  constructor(bodySnippet: string) {
    super(`tinybird response JSON parse failed — body[0..200]=${bodySnippet}`);
    this.name = "TinybirdResponseParseError";
    this.bodySnippet = bodySnippet;
    this.hint = "Tinybird returned a non-JSON body; retry on next request";
  }
}

function formatErrorMessage(kind: string, statusCode: number, body: string): string {
  const trimmed = body.slice(0, 500);
  return trimmed
    ? `tinybird ${kind} request failed: HTTP ${statusCode} — ${trimmed}`
    : `tinybird ${kind} request failed: HTTP ${statusCode}`;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError";
}

// Build the production `fetch`-backed HTTP client. Constructed once at
// adapter creation; each call is one `fetch` round-trip with no shared
// state (matches `SK-DB-003`'s no-pool posture for the PG adapter).
//
// Pipe parameters serialise to query-string per the Tinybird API
// contract; raw SQL goes in a JSON POST body to `/v0/sql`. Both paths
// thread the caller's `AbortSignal` straight into `fetch` so a client
// disconnect cancels the in-flight request.
function buildFetchClient(opts: TinybirdAdapterOptions): TinybirdHttpClient {
  if (!opts.token) {
    throw new Error("createTinybirdAdapter: `token` or `httpClient` override is required");
  }
  const token = opts.token;
  const base = (opts.apiBase ?? "https://api.tinybird.co").replace(/\/$/, "");

  return async (request, signal) => {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
    };

    let url: string;
    let init: RequestInit;
    if (request.kind === "pipe") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(request.params)) {
        if (v === undefined || v === null) continue;
        qs.set(k, String(v));
      }
      const suffix = qs.toString();
      url = `${base}/v0/pipes/${encodeURIComponent(request.name)}.json${
        suffix ? `?${suffix}` : ""
      }`;
      init = { method: "GET", headers, signal };
    } else {
      url = `${base}/v0/sql`;
      headers["content-type"] = "application/json";
      // Trim trailing whitespace + `;` before appending ` FORMAT JSON`.
      // Without this, a validated SQL ending in `;` would produce
      // `... FROM events; FORMAT JSON` which Tinybird rejects (and
      // would be the entry vector for any future format-injection
      // attempt riding on a trailing-semicolon allowlist gap).
      const cleaned = request.text.replace(/[\s;]+$/, "");
      init = {
        method: "POST",
        headers,
        // `format=JSON` makes the response shape deterministic
        // (otherwise Tinybird picks based on `Accept`); appending here
        // keeps the parser-side allowlist responsible for the SQL
        // text and the adapter responsible only for the wire format.
        body: JSON.stringify({ q: `${cleaned} FORMAT JSON` }),
        signal,
      };
    }

    const res = await fetch(url, init);
    if (!res.ok) {
      // Tinybird error envelope: `{ error: "...", documentation: "..." }`.
      // The body is small; reading it as text is the simplest way to
      // get a useful message into the rejection without forcing a
      // shape on every error case.
      const body = await safeReadText(res);
      throw classifyHttpError(res, body);
    }
    // Successful 2xx still has to parse — wrap the JSON read so a
    // malformed body surfaces as a typed error rather than a generic
    // SyntaxError that callers can't classify.
    let raw = "";
    try {
      raw = await res.text();
    } catch {
      throw new TinybirdResponseParseError("");
    }
    try {
      return JSON.parse(raw) as TinybirdResponse;
    } catch {
      throw new TinybirdResponseParseError(raw.slice(0, 200));
    }
  };
}

// Map a non-2xx Tinybird response to the typed error class with a
// status-keyed `hint` per `GLOBAL-012`. 401/403 = auth; 429 = rate
// limit (carries `Retry-After`); 5xx = upstream; other 4xx = request.
function classifyHttpError(res: Response, body: string): Error {
  const status = res.status;
  if (status === 401 || status === 403) {
    return new TinybirdAuthError(status, body);
  }
  if (status === 429) {
    const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
    return new TinybirdRateLimitError(status, retryAfter, body);
  }
  if (status >= 500 && status <= 599) {
    return new TinybirdServerError(status, body);
  }
  return new TinybirdRequestError(status, body);
}

// Parse the `Retry-After` header as integer seconds. Absent or
// unparseable values resolve to 0 — the caller can treat that as
// "retry immediately on next user action" rather than "back off
// forever". HTTP-date form is rare for Tinybird; we accept it but fall
// through to 0 if Date.parse balks.
function parseRetryAfter(value: string | null): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    const delta = Math.max(0, Math.round((dateMs - Date.now()) / 1000));
    return delta;
  }
  return 0;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
