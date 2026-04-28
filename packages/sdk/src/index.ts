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
  dbId: string;
};

export type AskOk = {
  status: "ok";
  cached: boolean;
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  summary?: string;
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
  // SDK-only sentinels — never sent by the API.
  | "unknown_error"
  | "non_json_response"
  | "network_error"
  | "aborted"
  | (string & {});

export type ApiErrorBody = {
  status: ApiErrorCode;
  message?: string;
  reason?: string;
  limit?: number;
  count?: number;
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

export type NlqClient = {
  ask(req: AskRequest, opts?: { signal?: AbortSignal }): Promise<AskOk>;
  listChat(opts?: { signal?: AbortSignal }): Promise<{ messages: ChatMessage[] }>;
  postChat(
    req: AskRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<{ user: ChatMessage; assistant: ChatMessage }>;
};

const DEFAULT_BASE_URL = "https://app.nlqdb.com";

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
    let res: Response;
    try {
      res = await fetcher(`${baseUrl}${path}`, {
        ...init,
        headers: { ...baseHeaders, ...(init.headers ?? {}) },
        ...(credentials ? { credentials } : {}),
      });
    } catch (err) {
      // Transport-level failure: DNS, CORS preflight, network drop,
      // or AbortSignal firing mid-request. Wrap into the uniform
      // error shape promised by README — consumers want one
      // `catch (err: NlqdbApiError)` block, not `try/catch (err) if
      // (err instanceof TypeError)`.
      const aborted =
        (err instanceof Error && err.name === "AbortError") ||
        (typeof DOMException !== "undefined" &&
          err instanceof DOMException &&
          err.name === "AbortError") ||
        init.signal?.aborted === true;
      throw new NlqdbApiError(
        aborted ? `nlqdb: ${path} aborted` : `nlqdb: ${path} network error`,
        0,
        aborted ? "aborted" : "network_error",
        path,
        null,
        { cause: err },
      );
    }
    const text = await res.text();
    let parsed: unknown;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Non-JSON body. Don't echo body content into the thrown
        // message — proxies / CDNs sometimes return HTML error
        // pages whose contents may carry deployment internals.
        throw new NlqdbApiError(
          `nlqdb: ${path} → ${res.status} non-JSON response`,
          res.status,
          "non_json_response",
          path,
          null,
        );
      }
    }
    if (!res.ok) {
      const errBody = extractError(parsed);
      const code = errBody?.status ?? "unknown_error";
      throw new NlqdbApiError(
        `nlqdb: ${path} → ${res.status} ${code}`,
        res.status,
        code,
        path,
        errBody,
      );
    }
    // Empty 2xx (e.g. 204 No Content) — `parsed` is `undefined`, but
    // we still cast to `T` because the caller's type already commits
    // to a shape. If the API ever 204s a route that the caller
    // expects to return JSON, the bug surfaces as a property-access
    // TypeError downstream rather than a silent empty object.
    return parsed as T;
  }

  return {
    ask: (req, callOpts) =>
      call<AskOk>("/v1/ask", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
      }),
    listChat: (callOpts) =>
      call<{ messages: ChatMessage[] }>("/v1/chat/messages", { signal: callOpts?.signal }),
    postChat: (req, callOpts) =>
      call("/v1/chat/messages", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
      }),
  };
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
