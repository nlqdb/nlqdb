// @nlqdb/sdk — typed HTTP client for the nlqdb /v1 API.
//
// Two auth modes (mutually exclusive):
//   • apiKey: 'sk_…'             server-to-server (Node, Bun, Workers)
//   • withCredentials: true      browser, riding the session cookie
//
// Runtime-agnostic: only depends on global fetch.
//
// Error contract: every method throws `NlqdbApiError` on failure —
// non-2xx, network failure, abort, and non-JSON proxy response. The
// error carries a discriminant `code` (mirrors the API's
// `error.status`, plus SDK-only sentinels `unknown_error`,
// `non_json_response`, `network_error`, `aborted`) and the HTTP
// status (0 for transport-level failures). Consumers `try/catch` and
// discriminate on `err.code`.

export type AskRequest = {
  goal: string;
  // SK-ASK-009 / SK-HDC-011: `dbId` is optional. When omitted the API
  // resolves it deterministically (0 dbs → CREATE, 1 → auto-target)
  // or via a cheap-tier LLM disambiguator on 2+ DBs (≥ 0.7 confidence
  // → auto-target with `selected_db` echo on the response; below →
  // 409 ambiguous_db with `candidate_dbs` for the surface to render).
  dbId?: string;
  // SK-DB-010: when the request routes the create branch (no dbId,
  // 0 DBs, or kind=create), `engine` overrides the classifier's
  // pick. Ignored on the query / write branches. Power-user escape
  // hatch per `GLOBAL-015`; absent path is the goal-first default
  // per `GLOBAL-020`.
  engine?: Engine;
  // SK-ONBOARD-004: when the API returned `requires_confirm: true`
  // for a destructive plan, the surface re-sends the same request
  // with `confirm: true`. The orchestrator skips its confidence
  // gate on the second hop and runs the SQL.
  confirm?: boolean;
};

// SK-ASK-009: response echo when the API auto-targeted a DB on the
// caller's behalf (single-DB auto-target OR LLM disambiguator pick
// ≥ 0.7 confidence). Surfaces render attribution + a one-click switch.
export type SelectedDbEcho = {
  id: string;
  slug: string;
  confidence: number;
  reason: string;
};

export type AskOk = {
  status: "ok";
  cached: boolean;
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  summary?: string;
  // SK-ONBOARD-004: present on destructive-plan replies that
  // haven't been approved yet. The diff fields drive the diff-chip
  // preview the surface renders before second-Enter / Approve.
  requires_confirm?: boolean;
  diff?: AskDiff;
  // SK-ASK-009: present when the API auto-targeted a DB. Absent on
  // requests that pinned `dbId` directly.
  selected_db?: SelectedDbEcho;
};

// SK-HDC-001 / SK-ASK-009: when `kind=create` (or 0 DBs with kind=
// query|write), the API returns this envelope instead of `AskOk`.
// The chat surface narrows on `kind` to switch into "DB created"
// mode, append the new DB to the rail, and re-pin `dbId` for the
// next send.
export type AskCreateResult = {
  kind: "create";
  db: string;
  schemaName: string;
  // SK-DB-010 — engine the orchestrator resolved. Always present.
  engine: Engine;
  pkLive: string | null;
  // SchemaPlan from the typed-plan compiler (`SK-HDC-002`). Surfaces
  // that don't render the plan (current chat) ignore it; CreateForm
  // narrows it via its own `CreateResult` type.
  plan: unknown;
  // One entry per sample row — mirrors the API's `SampleRow` shape
  // (`packages/db/src/types.ts`). Surfaces that want a per-table
  // view group on `table` themselves.
  sampleRows: { table: string; values: Record<string, unknown> }[];
};

// Discriminator: `AskOk` carries `status: "ok"`, `AskCreateResult`
// carries `kind: "create"`. Callers narrow on whichever fits.
export type AskResponse = AskOk | AskCreateResult;

// Plain-English preview of a destructive plan. Values are derived
// server-side (validator + EXPLAIN) — surfaces never compute a
// "this will affect N rows" themselves; that would be a
// silent-lie risk under GLOBAL-011.
export type AskDiff = {
  verb: "UPDATE" | "DELETE" | "INSERT" | "DDL";
  table: string;
  affectedRows: number;
  summary: string;
};

// Per-step trace event, mirrors the API's OrchestrateEvent set
// extended with a `confirm_required` step for the destructive
// gate. Surfaces wire `onTrace` into the live trace UI; SK-SDK-007
// is the canonical contract for this shape.
export type TraceStep =
  | "cache_lookup"
  | "plan"
  | "validate"
  | "exec"
  | "summarize"
  | "confirm_required"
  | "selected_db";

export type TraceEvent =
  | { type: "plan_pending" }
  | { type: "plan"; sql: string; cached: boolean }
  | { type: "rows"; rows: Record<string, unknown>[]; rowCount: number }
  | { type: "summary"; summary: string }
  | { type: "confirm_required"; diff: AskDiff }
  | { type: "selected_db"; db: SelectedDbEcho }
  | { type: "error"; error: ApiErrorBody }
  | { type: "done"; status: "ok" };

// SK-DB-010 — engine the create path resolved (classifier-default or
// explicit override). Surfaces echo it back to the caller; the CLI
// renders it after `nlq new`, the chat surface stores it on the rail
// row, the MCP tool returns it per row from `nlqdb_list_databases`.
export type Engine = "postgres" | "clickhouse";

// One DB row in a `listDatabases` response. `pkLive` is the
// publishable per-DB key used to inline into <nlq-data> snippets
// (SK-WEB-007); when null the surface falls back to the anonymous
// device's pk_live (SK-ANON-006).
export type DatabaseSummary = {
  id: string;
  slug: string;
  name?: string;
  schemaName?: string;
  // SK-DB-010 — the engine column on the row. Surfaces narrow on
  // this when rendering badges or routing power-user `run` calls.
  engine: Engine;
  pkLive: string | null;
  lastQueriedAt: number | null;
  createdAt: number;
};

export type CreateDatabaseRequest = {
  name?: string;
  goal?: string;
  // SK-DB-010 — explicit engine override. When omitted the API runs
  // the SK-MULTIENG-002 classifier on `goal` text. Power-user escape
  // hatch per `GLOBAL-015`; absent path is the goal-first default
  // per `GLOBAL-020`. The API rejects unknown engines with
  // `invalid_engine` (400).
  engine?: Engine;
};

export type CreateDatabaseResult = {
  dbId: string;
  slug: string;
  // SK-DB-010 — the engine the API actually provisioned. Always
  // present so callers don't have to re-resolve from the slug.
  engine: Engine;
  pkLive: string;
  connectionString?: string;
};

// Mirror of the API's `AskError` discriminant (apps/api/src/ask/types.ts)
// plus SDK-only sentinels. Open-ended via `(string & {})` so a new API
// status doesn't force an SDK bump to compile — consumers still get
// autocomplete on the known values.
export type ApiErrorCode =
  | "db_not_found"
  | "schema_unavailable"
  | "db_misconfigured"
  | "db_unreachable"
  | "sql_rejected"
  | "llm_failed"
  | "rate_limited"
  | "unauthorized"
  | "invalid_json"
  | "goal_required"
  | "dbId_required"
  | "invalid_body"
  | "invalid_email"
  | "secret_unconfigured"
  // SK-ASK-009: 409 returned when the LLM disambiguator's confidence
  // is below the floor on a 2+ DB tenant. Body carries `candidate_dbs`.
  | "ambiguous_db"
  // SK-ASK-014: 409 returned when the caller pinned `dbId` but the
  // classifier returned `kind=create` (the goal looks like a creation
  // request, e.g. "new table"). Body carries `pinned_db: {id, slug}` —
  // surfaces render a chip with two actions: "Create new database"
  // (re-send without `dbId`) and "Cancel".
  | "clarify_required"
  // SK-DB-010: 400 returned when `engine` is set to a string that's
  // not in the allowed engine set on `/v1/ask` or `/v1/databases`.
  | "invalid_engine"
  // SDK-only sentinels — never sent by the API.
  | "unknown_error"
  | "non_json_response"
  | "network_error"
  | "aborted"
  | (string & {});

// SK-ASK-009: candidate-DB ranking carried on `ambiguous_db` 409
// envelopes. Surface uses these to render an explicit picker.
export type CandidateDb = { id: string; slug: string };

// SK-ASK-014: surfaced on `clarify_required` 409 envelopes — the DB
// the caller had pinned when the classifier decided `kind=create`.
// Null when the pinned id couldn't be resolved (stale URL param).
export type PinnedDb = { id: string; slug: string };

export type ApiErrorBody = {
  status: ApiErrorCode;
  message?: string;
  reason?: string;
  limit?: number;
  count?: number;
  candidate_dbs?: CandidateDb[];
  // SK-ASK-014 — only present on `clarify_required` envelopes.
  clarification?: "create_or_query_pinned";
  pinned_db?: PinnedDb | null;
};

// Mirrors apps/api/src/chat/types.ts. Keep these definitions in sync
// when the API's wire shape changes — `truncated` and `kind` are not
// optional, callers narrow off `result.kind`.
export type ChatAssistantSuccess = {
  kind: "ok";
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  cached: boolean;
  summary?: string;
};

export type ChatAssistantError = {
  kind: "error";
  status: ApiErrorCode;
  message?: string;
};

export type ChatAssistantResult = ChatAssistantSuccess | ChatAssistantError;

export type ChatMessage =
  | { id: string; role: "user"; userId: string; dbId: string; goal: string; createdAt: number }
  | {
      id: string;
      role: "assistant";
      userId: string;
      dbId: string;
      createdAt: number;
      result: ChatAssistantResult;
    };

// Minimal fetch shape — just the call signature, not the runtime-
// specific static methods (Bun's `typeof globalThis.fetch` requires a
// `preconnect` method that test stubs shouldn't have to provide).
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// Discriminated so the type system rejects callers that pass both
// auth modes — sending a server-side bearer over a browser cookie is
// a leak waiting to happen. Both-omitted is allowed (anonymous calls
// will 401 at the API).
type ClientOptionsBase = {
  baseUrl?: string;
  fetch?: FetchLike;
};

export type ClientOptions =
  | (ClientOptionsBase & { apiKey: string; withCredentials?: never })
  | (ClientOptionsBase & { withCredentials: true; apiKey?: never })
  | (ClientOptionsBase & { apiKey?: never; withCredentials?: never });

export type AskStreamOptions = {
  signal?: AbortSignal;
  // SK-SDK-007: every ask-pipeline step fires once when known.
  // Surfaces wire this into their live trace UI (SK-WEB-005,
  // GLOBAL-011). Returning a value is ignored; throwing is caught
  // so a buggy hook can't take the ask call down with it.
  onTrace?: (event: TraceEvent) => void;
};

export type NlqClient = {
  // Returns the union AskOk | AskCreateResult — callers narrow on the
  // shape (`status === "ok"` vs `kind === "create"`). When `dbId` is
  // present the API always returns `AskOk`; when omitted the API may
  // route to the create path (`AskCreateResult`) per SK-ASK-009 /
  // SK-HDC-011.
  ask(req: AskRequest, opts?: { signal?: AbortSignal }): Promise<AskResponse>;
  // Streaming variant of `ask`. Resolves once the `done` event
  // arrives with the assembled `AskOk`; rejects with
  // `NlqdbApiError` on transport / API errors. Per-step events
  // surface via `opts.onTrace`. Use this — not `ask` — for chat
  // surfaces that want incremental rendering (GLOBAL-011). Note: the
  // streaming surface does NOT cover the create branch; surfaces that
  // need `AskCreateResult` should call `ask()` instead.
  askStream(req: AskRequest, opts: AskStreamOptions): Promise<AskOk>;
  listChat(opts?: { signal?: AbortSignal }): Promise<{ messages: ChatMessage[] }>;
  postChat(
    req: AskRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<{ user: ChatMessage; assistant: ChatMessage }>;
  listDatabases(opts?: { signal?: AbortSignal }): Promise<{ databases: DatabaseSummary[] }>;
  createDatabase(
    req: CreateDatabaseRequest,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<CreateDatabaseResult>;
};

const DEFAULT_BASE_URL = "https://app.nlqdb.com";

// GLOBAL-022 — wire-layer retry budget. Three attempts per call: the
// first plus two retries. Aligns with the server-side per-stage budget
// so end-to-end transient resilience is high without unbounded loops.
const SDK_MAX_ATTEMPTS = 3;

// Thrown on every failure path. Consumers discriminate on `code`
// rather than parsing strings. `httpStatus === 0` signals transport-
// level failure (network / abort) — no response was received.
export class NlqdbApiError extends Error {
  override readonly name = "NlqdbApiError";
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: ApiErrorCode,
    readonly path: string,
    readonly body: ApiErrorBody | null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function createClient(opts: ClientOptions = {}): NlqClient {
  // Defensive runtime guard — the union type above blocks this at
  // compile time, but JS callers (or `as any` escapes) can still slip
  // both through. Failing fast at construction beats a silent
  // dual-auth header in flight.
  const optsAny = opts as { apiKey?: string; withCredentials?: boolean };
  if (optsAny.apiKey && optsAny.withCredentials) {
    throw new Error(
      "@nlqdb/sdk: pass either `apiKey` (server) or `withCredentials: true` (browser), not both. Sending a server-side bearer over a browser cookie risks leaking the key.",
    );
  }

  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetcher = opts.fetch ?? globalThis.fetch;
  const credentials = opts.withCredentials ? ("include" as const) : undefined;

  // Hoist auth + content-type once per client. `call` shallow-copies
  // before merging per-request headers — avoids reallocating the
  // Authorization string on every request without coupling to caller
  // mutation patterns.
  const baseHeaders: Record<string, string> = { "content-type": "application/json" };
  if (opts.apiKey) baseHeaders["authorization"] = `Bearer ${opts.apiKey}`;

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    // GLOBAL-022 + SK-SDK-006 — wire-layer retry loop. Up to 3
    // attempts on transport failures and transient 5xx; 4xx surfaces
    // immediately (caller error). For mutations the same
    // `Idempotency-Key` is reused across attempts: auto-generate one
    // if the caller didn't supply it, so the API's dedupe store
    // collapses retries to a single side-effect (`SK-SDK-006`).
    const headers = mergeHeaders(baseHeaders, init.headers);
    const isMutation = (init.method ?? "GET").toUpperCase() !== "GET";
    if (isMutation && !hasHeader(headers, "idempotency-key")) {
      headers["idempotency-key"] = randomId();
    }
    const reqInit: RequestInit = {
      ...init,
      headers,
      ...(credentials ? { credentials } : {}),
    };

    let lastErr: NlqdbApiError | null = null;
    for (let attempt = 1; attempt <= SDK_MAX_ATTEMPTS; attempt++) {
      const result = await sendOnce<T>(fetcher, `${baseUrl}${path}`, path, reqInit);
      if (result.kind === "ok") return result.value;
      lastErr = result.error;
      // Surface 4xx + parse + abort immediately. Aborts cancel the
      // user's intent; 4xx are caller errors retry can't fix.
      if (!isRecoverable(result.error)) throw result.error;
      if (attempt === SDK_MAX_ATTEMPTS) throw result.error;
    }
    throw (
      lastErr ?? new NlqdbApiError(`nlqdb: ${path} retry exhausted`, 0, "unknown_error", path, null)
    );
  }

  async function streamAsk(req: AskRequest, opts: AskStreamOptions): Promise<AskOk> {
    let res: Response;
    try {
      res = await fetcher(`${baseUrl}/v1/ask`, {
        method: "POST",
        headers: { ...baseHeaders, accept: "text/event-stream" },
        body: JSON.stringify(req),
        signal: opts.signal,
        ...(credentials ? { credentials } : {}),
      });
    } catch (err) {
      const aborted =
        (err instanceof Error && err.name === "AbortError") ||
        (typeof DOMException !== "undefined" &&
          err instanceof DOMException &&
          err.name === "AbortError") ||
        opts.signal?.aborted === true;
      throw new NlqdbApiError(
        aborted ? "nlqdb: /v1/ask aborted" : "nlqdb: /v1/ask network error",
        0,
        aborted ? "aborted" : "network_error",
        "/v1/ask",
        null,
        { cause: err },
      );
    }

    // Errors land as JSON, not SSE. The handler returns the JSON
    // body before opening the event stream, so a non-2xx with a
    // JSON `Content-Type` is the normal error path here.
    if (!res.ok) {
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        throw new NlqdbApiError(
          `nlqdb: /v1/ask → ${res.status} non-JSON response`,
          res.status,
          "non_json_response",
          "/v1/ask",
          null,
        );
      }
      const errBody = extractError(parsed);
      const code = errBody?.status ?? "unknown_error";
      throw new NlqdbApiError(
        `nlqdb: /v1/ask → ${res.status} ${code}`,
        res.status,
        code,
        "/v1/ask",
        errBody,
      );
    }

    if (!res.body) {
      throw new NlqdbApiError(
        "nlqdb: /v1/ask → 200 with no stream body",
        res.status,
        "non_json_response",
        "/v1/ask",
        null,
      );
    }

    const fire = (ev: TraceEvent) => {
      try {
        opts.onTrace?.(ev);
      } catch {
        // SK-SDK-007: a hook throw must not poison the stream.
        // Swallow silently — surfaces own their UI errors.
      }
    };

    let sql = "";
    let cached = false;
    let rows: Record<string, unknown>[] = [];
    let rowCount = 0;
    let summary: string | undefined;
    let requiresConfirm = false;
    let diff: AskDiff | undefined;
    let selectedDb: SelectedDbEcho | undefined;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line. Process each
      // complete frame; stash the trailing partial back in `buf`.
      for (;;) {
        const sep = buf.indexOf("\n\n");
        if (sep === -1) break;
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const parsed = parseSseFrame(frame);
        if (!parsed) continue;
        const { event, data } = parsed;
        let payload: unknown;
        try {
          payload = data ? JSON.parse(data) : {};
        } catch {
          continue;
        }
        const traceEvent = toTraceEvent(event, payload);
        if (traceEvent) fire(traceEvent);
        switch (event) {
          case "plan": {
            const p = payload as { sql?: string; cached?: boolean };
            sql = p.sql ?? "";
            cached = Boolean(p.cached);
            break;
          }
          case "rows": {
            const p = payload as { rows?: Record<string, unknown>[]; rowCount?: number };
            rows = p.rows ?? [];
            rowCount = p.rowCount ?? rows.length;
            break;
          }
          case "summary": {
            const p = payload as { summary?: string };
            summary = p.summary;
            break;
          }
          case "confirm_required": {
            const p = payload as { diff?: AskDiff };
            requiresConfirm = true;
            diff = p.diff;
            break;
          }
          case "selected_db": {
            const p = payload as { db?: SelectedDbEcho };
            if (p.db) selectedDb = p.db;
            break;
          }
          case "error": {
            const p = payload as { error?: ApiErrorBody };
            const errBody = p.error ?? null;
            throw new NlqdbApiError(
              `nlqdb: /v1/ask → ${errBody?.status ?? "unknown_error"}`,
              200,
              errBody?.status ?? "unknown_error",
              "/v1/ask",
              errBody,
            );
          }
          case "done":
            // Final frame; loop continues to drain the reader.
            break;
        }
      }
    }

    return {
      status: "ok",
      cached,
      sql,
      rows,
      rowCount,
      ...(summary !== undefined ? { summary } : {}),
      ...(requiresConfirm ? { requires_confirm: true } : {}),
      ...(diff ? { diff } : {}),
      ...(selectedDb ? { selected_db: selectedDb } : {}),
    };
  }

  return {
    ask: (req, callOpts) =>
      call<AskResponse>("/v1/ask", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
      }),
    askStream: streamAsk,
    listChat: (callOpts) =>
      call<{ messages: ChatMessage[] }>("/v1/chat/messages", { signal: callOpts?.signal }),
    postChat: (req, callOpts) =>
      call("/v1/chat/messages", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
      }),
    listDatabases: (callOpts) =>
      call<{ databases: DatabaseSummary[] }>("/v1/databases", { signal: callOpts?.signal }),
    createDatabase: (req, callOpts) =>
      call<CreateDatabaseResult>("/v1/databases", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      }),
  };
}

// SSE frame parser. Only consumes the subset of the spec the API
// emits: `event:` + `data:` lines, no multi-line `data:`, no `id:`
// or `retry:`. Returns null for comment-only frames.
function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data = data ? `${data}\n${value}` : value;
  }
  if (!event && !data) return null;
  return { event, data };
}

function toTraceEvent(event: string, payload: unknown): TraceEvent | null {
  switch (event) {
    case "plan_pending":
      return { type: "plan_pending" };
    case "plan": {
      const p = payload as { sql?: string; cached?: boolean };
      return { type: "plan", sql: p.sql ?? "", cached: Boolean(p.cached) };
    }
    case "rows": {
      const p = payload as { rows?: Record<string, unknown>[]; rowCount?: number };
      return { type: "rows", rows: p.rows ?? [], rowCount: p.rowCount ?? 0 };
    }
    case "summary": {
      const p = payload as { summary?: string };
      return { type: "summary", summary: p.summary ?? "" };
    }
    case "confirm_required": {
      const p = payload as { diff?: AskDiff };
      if (!p.diff) return null;
      return { type: "confirm_required", diff: p.diff };
    }
    case "selected_db": {
      const p = payload as { db?: SelectedDbEcho };
      if (!p.db) return null;
      return { type: "selected_db", db: p.db };
    }
    case "error": {
      const p = payload as { error?: ApiErrorBody };
      return { type: "error", error: p.error ?? { status: "unknown_error" } };
    }
    case "done":
      return { type: "done", status: "ok" };
    default:
      return null;
  }
}

// Single-attempt request. Returns either the parsed body or a wrapped
// `NlqdbApiError`; the caller's retry loop decides whether to throw.
// Splitting this out keeps the retry loop in `call` focused on
// classification (recoverable vs not) instead of HTTP plumbing.
type SendResult<T> = { kind: "ok"; value: T } | { kind: "err"; error: NlqdbApiError };

async function sendOnce<T>(
  fetcher: FetchLike,
  url: string,
  path: string,
  init: RequestInit,
): Promise<SendResult<T>> {
  let res: Response;
  try {
    res = await fetcher(url, init);
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "AbortError") ||
      init.signal?.aborted === true;
    return {
      kind: "err",
      error: new NlqdbApiError(
        aborted ? `nlqdb: ${path} aborted` : `nlqdb: ${path} network error`,
        0,
        aborted ? "aborted" : "network_error",
        path,
        null,
        { cause: err },
      ),
    };
  }
  const text = await res.text();
  let parsed: unknown;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        kind: "err",
        error: new NlqdbApiError(
          `nlqdb: ${path} → ${res.status} non-JSON response`,
          res.status,
          "non_json_response",
          path,
          null,
        ),
      };
    }
  }
  if (!res.ok) {
    const errBody = extractError(parsed);
    const code = errBody?.status ?? "unknown_error";
    return {
      kind: "err",
      error: new NlqdbApiError(
        `nlqdb: ${path} → ${res.status} ${code}`,
        res.status,
        code,
        path,
        errBody,
      ),
    };
  }
  return { kind: "ok", value: parsed as T };
}

// Recoverable = transport failure or transient 5xx. 4xx surfaces
// immediately; aborts cancel the user's intent. `non_json_response`
// from a 5xx counts (proxy returned an HTML error page); from a 2xx
// it doesn't (server bug, retry won't help).
function isRecoverable(err: NlqdbApiError): boolean {
  if (err.code === "aborted") return false;
  if (err.code === "network_error") return true;
  if (err.httpStatus === 0) return false;
  if (err.httpStatus >= 500 && err.httpStatus < 600) return true;
  return false;
}

function mergeHeaders(
  base: Record<string, string>,
  extra: HeadersInit | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...base };
  if (!extra) return out;
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) out[k.toLowerCase()] = v;
    return out;
  }
  for (const [k, v] of Object.entries(extra)) out[k.toLowerCase()] = String(v);
  return out;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.hasOwn(headers, name.toLowerCase());
}

// 16-byte random id rendered as 32 hex chars. Used for the auto-
// generated `Idempotency-Key` on retried mutations (`SK-SDK-006`).
// Falls back to `Math.random` only when the global `crypto` is missing
// (very old runtimes); the fallback is sufficient for de-dupe — the
// API treats the key as opaque, not a security boundary.
function randomId(): string {
  const cryptoObj: { getRandomValues?: (b: Uint8Array) => Uint8Array } | undefined = (
    globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }
  ).crypto;
  const bytes = new Uint8Array(16);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return out;
}

// Normalize the API's TWO error envelope shapes into a single
// `ApiErrorBody`:
//
//   1. Structured  — `{ error: { status: "rate_limited", limit, count } }`
//      (orchestrator + chat outcome failures)
//   2. String-form — `{ error: "invalid_json" }`
//      (body-parse failures from apps/api/src/http.ts +
//      `secret_unconfigured` from the billing route)
//
// Returning `null` only on shapes we genuinely don't recognize means
// the consumer's `err.code === "invalid_json"` discriminator works
// for the string-form too — without this, every malformed-body 400
// surfaced as `unknown_error`.
function extractError(parsed: unknown): ApiErrorBody | null {
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  const errEnvelope = body["error"];
  if (typeof errEnvelope === "string") {
    return { status: errEnvelope as ApiErrorCode };
  }
  if (errEnvelope && typeof errEnvelope === "object") {
    const inner = errEnvelope as Record<string, unknown>;
    if (typeof inner["status"] === "string") return inner as ApiErrorBody;
  }
  return null;
}
