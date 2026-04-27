// @nlqdb/sdk — typed HTTP client for the nlqdb /v1 API.
//
// Two auth modes:
//   • apiKey: 'sk_…'             server-to-server (Node, Bun, Workers)
//   • credentials: 'include'     browser, riding the session cookie
//
// Runtime-agnostic: only depends on global fetch.

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

export type AskError = {
  status:
    | "db_not_found"
    | "schema_unavailable"
    | "db_misconfigured"
    | "db_unreachable"
    | "sql_rejected"
    | "llm_failed"
    | "rate_limited";
  message?: string;
  reason?: string;
  limit?: number;
  count?: number;
};

export type AskResponse = AskOk | { error: AskError };

export type ChatMessage =
  | { id: string; role: "user"; userId: string; dbId: string; goal: string; createdAt: number }
  | {
      id: string;
      role: "assistant";
      userId: string;
      dbId: string;
      createdAt: number;
      result: AskOk | (AskError & { kind: "error" });
    };

// Minimal fetch shape — just the call signature, not the runtime-
// specific static methods (Bun's `typeof globalThis.fetch` requires a
// `preconnect` method that test stubs shouldn't have to provide).
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  // Browser cookie mode. When true, sets `credentials: 'include'`
  // on every request so the session cookie travels.
  withCredentials?: boolean;
  // Test injection point.
  fetch?: FetchLike;
};

export type NlqClient = {
  ask(req: AskRequest, opts?: { signal?: AbortSignal }): Promise<AskResponse>;
  listChat(opts?: { signal?: AbortSignal }): Promise<{ messages: ChatMessage[] }>;
  postChat(
    req: AskRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<{ user: ChatMessage; assistant: ChatMessage }>;
};

const DEFAULT_BASE_URL = "https://app.nlqdb.com";

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
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      throw new Error(`nlqdb: ${path} → ${res.status} non-JSON body: ${text.slice(0, 200)}`);
    }
    if (!res.ok && !(body && typeof body === "object" && "error" in body)) {
      throw new Error(`nlqdb: ${path} → ${res.status}`);
    }
    return body as T;
  }

  return {
    ask: (req, callOpts) =>
      call<AskResponse>("/v1/ask", {
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
