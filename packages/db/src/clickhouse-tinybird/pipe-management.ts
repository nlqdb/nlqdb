// Tinybird Pipes-management owner — `createPipe`, `getPipe`, `dropPipe`.
//
// W5 (workload analyser) is the only caller in v1; it imports the typed
// functions below rather than POSTing to Tinybird directly per
// `GLOBAL-021`. The HTTP shape mirrors `query-log.ts`: same HTTP-client
// seam, same OTel posture (one `db.query` span per call with
// `db.system=other_sql` and `db.operation.name ∈
// {PIPE_CREATE, PIPE_DROP, PIPE_GET}`), same typed-error set keyed by
// status class, same no-pool / no-shared-state behaviour.
//
// Endpoints (per Tinybird Pipes API, verified 2026-05-08):
//   POST   /v0/pipes              { name, nodes:[{name, sql}] }
//   GET    /v0/pipes/<name>       — 200 with PipeRecord, 404 on miss
//   DELETE /v0/pipes/<name>       — 204 on success, 404 if absent
//
// `getPipe` returns `null` on 404 (caller treats as "not present");
// `dropPipe` swallows 404 (idempotent — already absent). Other non-2xx
// statuses throw via the typed error classes so the caller can map to a
// `GLOBAL-012`-shaped one-line action.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export type PipeNode = {
  name: string;
  sql: string;
};

export type PipeRecord = {
  name: string;
  nodes: PipeNode[];
};

export const OP_PIPE_CREATE = "PIPE_CREATE";
export const OP_PIPE_DROP = "PIPE_DROP";
export const OP_PIPE_GET = "PIPE_GET";

export type PipeHttpRequest =
  | { kind: "create"; pipe: PipeRecord }
  | { kind: "get"; name: string }
  | { kind: "drop"; name: string };

export type PipeHttpResponse = {
  status: number;
  // Parsed JSON body — populated by the production fetch client on 2xx
  // when the server returned `application/json`. Tests stubbing the
  // client populate it directly with a `PipeRecord`-shaped object.
  body?: unknown;
  // Truncated text body (≤500 chars) for non-2xx error envelopes.
  // Mirrors `adapter.ts`'s `formatErrorMessage` truncation.
  bodySnippet?: string;
  // Parsed `Retry-After` seconds — set when `status === 429`, absent
  // otherwise. Caller surfaces it on the OTel span attribute
  // `nlqdb.tinybird.retry_after_s`.
  retryAfterSeconds?: number;
};

export type PipeHttpClient = (
  req: PipeHttpRequest,
  signal?: AbortSignal,
) => Promise<PipeHttpResponse>;

export type PipeManagementOptions = {
  // Workspace token with `PIPE:CREATE` (for createPipe) and `DROP:NAME`
  // (for dropPipe) scopes. Required when the production HTTP client is
  // used; ignored when `httpClient` is provided.
  token?: string;
  // Override the Tinybird API base. Defaults to the EU gateway
  // (`https://api.tinybird.co`) — matches `createTinybirdAdapter`'s
  // default so a workspace's read + write paths share a host.
  apiBase?: string;
  // Test override — bypasses the HTTP layer entirely.
  httpClient?: PipeHttpClient;
};

export type PipeManagementClient = {
  createPipe(pipe: PipeRecord, signal?: AbortSignal): Promise<PipeRecord>;
  getPipe(name: string, signal?: AbortSignal): Promise<PipeRecord | null>;
  dropPipe(name: string, signal?: AbortSignal): Promise<void>;
};

export function createPipeManagementClient(opts: PipeManagementOptions): PipeManagementClient {
  const httpClient = opts.httpClient ?? buildFetchClient(opts);
  return {
    createPipe: (pipe, signal) => createPipe(httpClient, pipe, signal),
    getPipe: (name, signal) => getPipe(httpClient, name, signal),
    dropPipe: (name, signal) => dropPipe(httpClient, name, signal),
  };
}

export async function createPipe(
  http: PipeHttpClient,
  pipe: PipeRecord,
  signal?: AbortSignal,
): Promise<PipeRecord> {
  return runWithSpan(OP_PIPE_CREATE, pipe.name, async () => {
    const resp = await http({ kind: "create", pipe }, signal);
    if (!isOk(resp.status)) throw classifyHttpError(resp);
    return parsePipeRecord(resp.body) ?? pipe;
  });
}

export async function getPipe(
  http: PipeHttpClient,
  name: string,
  signal?: AbortSignal,
): Promise<PipeRecord | null> {
  return runWithSpan(OP_PIPE_GET, name, async () => {
    const resp = await http({ kind: "get", name }, signal);
    if (resp.status === 404) return null;
    if (!isOk(resp.status)) throw classifyHttpError(resp);
    return parsePipeRecord(resp.body);
  });
}

export async function dropPipe(
  http: PipeHttpClient,
  name: string,
  signal?: AbortSignal,
): Promise<void> {
  return runWithSpan(OP_PIPE_DROP, name, async () => {
    const resp = await http({ kind: "drop", name }, signal);
    // 404 on drop is idempotent success — the Pipe was already absent.
    if (resp.status === 404) return;
    if (!isOk(resp.status)) throw classifyHttpError(resp);
  });
}

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

function parsePipeRecord(body: unknown): PipeRecord | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const name = obj["name"];
  const nodes = obj["nodes"];
  if (typeof name !== "string" || !Array.isArray(nodes)) return null;
  const out: PipeNode[] = [];
  for (const n of nodes) {
    if (n && typeof n === "object") {
      const nObj = n as Record<string, unknown>;
      const nName = nObj["name"];
      const nSql = nObj["sql"];
      if (typeof nName === "string" && typeof nSql === "string") {
        out.push({ name: nName, sql: nSql });
      }
    }
  }
  return { name, nodes: out };
}

async function runWithSpan<T>(
  operation: string,
  pipeName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("@nlqdb/db");
  return tracer.startActiveSpan(
    "db.query",
    {
      attributes: {
        "db.system": "other_sql",
        "db.operation.name": operation,
        "db.tinybird.pipe": pipeName,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        return await fn();
      } catch (err) {
        if (err instanceof PipeRateLimitError) {
          span.setAttribute("nlqdb.tinybird.retry_after_s", err.retryAfterSeconds);
        }
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        const elapsed = performance.now() - startedAt;
        dbDurationMs().record(elapsed, { operation });
        span.end();
      }
    },
  );
}

// Status-keyed typed errors. Mirrors `adapter.ts`'s Tinybird* error set
// — same shape so a caller can map either set the same way. `hint`
// carries a one-sentence `GLOBAL-012`-style next action.

function classifyHttpError(resp: PipeHttpResponse): Error {
  const status = resp.status;
  const body = resp.bodySnippet ?? "";
  if (status === 401 || status === 403) return new PipeAuthError(status, body);
  if (status === 429) return new PipeRateLimitError(status, resp.retryAfterSeconds ?? 0, body);
  if (status >= 500 && status <= 599) return new PipeServerError(status, body);
  return new PipeRequestError(status, body);
}

function formatMessage(kind: string, status: number, body: string): string {
  const trimmed = body.slice(0, 500);
  return trimmed
    ? `tinybird ${kind} request failed: HTTP ${status} — ${trimmed}`
    : `tinybird ${kind} request failed: HTTP ${status}`;
}

export class PipeAuthError extends Error {
  readonly statusCode: number;
  readonly hint: string;
  constructor(statusCode: number, body: string) {
    super(formatMessage("auth", statusCode, body));
    this.name = "PipeAuthError";
    this.statusCode = statusCode;
    this.hint = "check TINYBIRD_TOKEN scope (PIPE:CREATE / DROP:NAME) and workspace ACL";
  }
}

export class PipeRateLimitError extends Error {
  readonly statusCode: number;
  readonly retryAfterSeconds: number;
  readonly hint: string;
  constructor(statusCode: number, retryAfterSeconds: number, body: string) {
    super(formatMessage("rate-limit", statusCode, body));
    this.name = "PipeRateLimitError";
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
    this.hint = "rate limit hit; retry after Retry-After seconds";
  }
}

export class PipeServerError extends Error {
  readonly statusCode: number;
  readonly hint: string;
  constructor(statusCode: number, body: string) {
    super(formatMessage("upstream", statusCode, body));
    this.name = "PipeServerError";
    this.statusCode = statusCode;
    this.hint = "Tinybird upstream error; will retry on next cron run";
  }
}

export class PipeRequestError extends Error {
  readonly statusCode: number;
  readonly hint: string;
  constructor(statusCode: number, body: string) {
    super(formatMessage("request", statusCode, body));
    this.name = "PipeRequestError";
    this.statusCode = statusCode;
    this.hint = "Tinybird rejected the request; check the Pipe name and node SQL";
  }
}

// Build the production `fetch`-backed HTTP client. No-pool / no-shared-state
// (matches `createTinybirdAdapter` and `createQueryLogWriter`).
function buildFetchClient(opts: PipeManagementOptions): PipeHttpClient {
  if (!opts.token) {
    throw new Error("createPipeManagementClient: `token` or `httpClient` override is required");
  }
  const token = opts.token;
  const base = (opts.apiBase ?? "https://api.tinybird.co").replace(/\/$/, "");

  return async (req, signal) => {
    let url: string;
    let init: RequestInit;
    if (req.kind === "create") {
      url = `${base}/v0/pipes`;
      init = {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: req.pipe.name, nodes: req.pipe.nodes }),
        signal,
      };
    } else if (req.kind === "get") {
      url = `${base}/v0/pipes/${encodeURIComponent(req.name)}`;
      init = {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
        signal,
      };
    } else {
      url = `${base}/v0/pipes/${encodeURIComponent(req.name)}`;
      init = {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
        signal,
      };
    }

    const res = await fetch(url, init);
    return readResponse(res);
  };
}

async function readResponse(res: Response): Promise<PipeHttpResponse> {
  const status = res.status;
  const retryAfterSeconds = status === 429 ? parseRetryAfter(res.headers.get("retry-after")) : 0;
  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");

  let text = "";
  try {
    text = await res.text();
  } catch {
    return { status, retryAfterSeconds };
  }
  if (!text) return { status, retryAfterSeconds };

  if (isOk(status) && isJson) {
    try {
      return { status, body: JSON.parse(text), retryAfterSeconds };
    } catch {
      // Malformed JSON on a 2xx — surface as a snippet so the caller
      // can attach it to the span; the typed error path stays for non-2xx.
      return { status, bodySnippet: text.slice(0, 500), retryAfterSeconds };
    }
  }
  return { status, bodySnippet: text.slice(0, 500), retryAfterSeconds };
}

function parseRetryAfter(value: string | null): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, Math.round((dateMs - Date.now()) / 1000));
  }
  return 0;
}
