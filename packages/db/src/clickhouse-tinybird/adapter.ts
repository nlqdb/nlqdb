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
// in one read; we yield from memory the same way `postgres.ts`'s
// `makeEngineResult` does. Streaming via `format=ndjson` is a future
// optimisation — the contract is `AsyncIterable<Row>` so we can swap
// in a streaming projection without touching consumers
// (`SK-MULTIENG-001`).

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type {
  ClickHouseEngineMeta,
  DatabaseAdapter,
  EngineMeta,
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
        // server-side (`SK-MULTIENG-004`).
        queryText: hasPipe ? undefined : (plan.sql as string),
      });

      return tracer.startActiveSpan("db.query", { attributes: attrs }, async (span) => {
        const startedAt = performance.now();
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

          return makeEngineResult(response.data, meta);
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          const elapsed = performance.now() - startedAt;
          dbDurationMs().record(elapsed, { operation });
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

function makeEngineResult(rows: Row[], meta: EngineMeta): EngineResult {
  return {
    meta,
    [Symbol.asyncIterator]: async function* () {
      for (const row of rows) yield row;
    },
  };
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
      init = {
        method: "POST",
        headers,
        // `format=JSON` makes the response shape deterministic
        // (otherwise Tinybird picks based on `Accept`); appending here
        // keeps the parser-side allowlist responsible for the SQL
        // text and the adapter responsible only for the wire format.
        body: JSON.stringify({ q: `${request.text} FORMAT JSON` }),
        signal,
      };
    }

    const res = await fetch(url, init);
    if (!res.ok) {
      // Tinybird error envelope: `{ error: "...", documentation: "..." }`.
      // The body is small; reading it as text is the simplest way to
      // get a useful message into the rejection without forcing a
      // shape on every error case (auth failure / 4xx validation /
      // 5xx).
      const body = await safeReadText(res);
      throw new Error(
        `tinybird ${request.kind} request failed: HTTP ${res.status}${
          body ? ` — ${body.slice(0, 500)}` : ""
        }`,
      );
    }
    return (await res.json()) as TinybirdResponse;
  };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
