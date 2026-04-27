// @nlqdb/sdk — typed HTTP client for the nlqdb /v1 API.
//
// Two auth modes:
//   • apiKey: 'sk_…'             server-to-server (Node, Bun, Workers)
//   • withCredentials: true      browser, riding the session cookie
//
// Runtime-agnostic: only depends on global fetch.
//
// Error contract: every method throws `NlqdbApiError` on non-2xx.
// The error carries the parsed envelope's `error.status` (or
// `unknown_error` if the body wasn't the structured shape) plus the
// HTTP status. Consumers `try/catch` and discriminate on `err.code`.

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

export type ApiErrorBody = {
  status: string;
  message?: string;
  reason?: string;
  limit?: number;
  count?: number;
};

export type ChatMessage =
  | { id: string; role: "user"; userId: string; dbId: string; goal: string; createdAt: number }
  | {
      id: string;
      role: "assistant";
      userId: string;
      dbId: string;
      createdAt: number;
      result: AskOk | (ApiErrorBody & { kind: "error" });
    };

// Minimal fetch shape — just the call signature, not the runtime-
// specific static methods (Bun's `typeof globalThis.fetch` requires a
// `preconnect` method that test stubs shouldn't have to provide).
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  withCredentials?: boolean;
  fetch?: FetchLike;
};

export type NlqClient = {
  ask(req: AskRequest, opts?: { signal?: AbortSignal }): Promise<AskOk>;
  listChat(opts?: { signal?: AbortSignal }): Promise<{ messages: ChatMessage[] }>;
  postChat(
    req: AskRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<{ user: ChatMessage; assistant: ChatMessage }>;
};

const DEFAULT_BASE_URL = "https://app.nlqdb.com";

// Thrown on every non-2xx. Consumers discriminate on `code` (the
// API's `error.status` discriminant — `rate_limited`, `db_not_found`,
// `unauthorized`, …) rather than parsing strings.
export class NlqdbApiError extends Error {
  override readonly name = "NlqdbApiError";
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: string,
    readonly path: string,
    readonly body: ApiErrorBody | null,
  ) {
    super(message);
  }
}

export function createClient(opts: ClientOptions = {}): NlqClient {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetcher = opts.fetch ?? globalThis.fetch;
  const credentials = opts.withCredentials ? ("include" as const) : undefined;

  function headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (opts.apiKey) h["authorization"] = `Bearer ${opts.apiKey}`;
    return h;
  }

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers(), ...(init.headers ?? {}) },
      ...(credentials ? { credentials } : {}),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // Non-JSON body. Don't echo body content into the thrown
      // message — proxies / CDNs sometimes return HTML error pages
      // and the contents may carry deployment internals.
      throw new NlqdbApiError(
        `nlqdb: ${path} → ${res.status} non-JSON response`,
        res.status,
        "non_json_response",
        path,
        null,
      );
    }
    if (!res.ok) {
      const errBody = extractError(parsed);
      throw new NlqdbApiError(
        `nlqdb: ${path} → ${res.status} ${errBody?.status ?? "unknown_error"}`,
        res.status,
        errBody?.status ?? "unknown_error",
        path,
        errBody,
      );
    }
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

function extractError(parsed: unknown): ApiErrorBody | null {
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  const errEnvelope = body["error"];
  if (errEnvelope && typeof errEnvelope === "object") {
    const inner = errEnvelope as Record<string, unknown>;
    if (typeof inner["status"] === "string") return inner as ApiErrorBody;
  }
  return null;
}
