// `POST /v1/ask` client. Pure network layer — no DOM, no state.
// `element.ts` wraps it with attribute reads + render swaps.
//
// Auth: cookie-based session today (Better Auth, `credentials: "include"`),
// `pk_live_*` Authorization Bearer once Slice 11 lands. Both are sent
// when present so this client is forward-compatible — the API just
// ignores Authorization in Slice 10.

export type AskSuccess = {
  status: "ok";
  cached: boolean;
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  summary?: string;
};

// API errors mirror `apps/api/src/ask/types.ts AskError` plus the bare
// string forms the handler emits for `goal_required` / `dbId_required`
// / `invalid_json`. Kept loose (`unknown` payload) so adding a variant
// to AskError doesn't ripple a type bump through the CDN bundle.
export type ApiErrorBody = { status: string; [k: string]: unknown };
export type AskFailure =
  | { kind: "network"; message: string }
  | { kind: "auth"; status: number }
  | { kind: "api"; status: number; error: ApiErrorBody | string };

export type AskOutcome = { ok: true; data: AskSuccess } | { ok: false; failure: AskFailure };

// Structural fetch signature. Narrower than `typeof fetch` so test
// stubs (vi.fn, etc.) don't need to satisfy `fetch.preconnect` and
// other static members we never call.
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type AskParams = {
  endpoint: string;
  goal: string;
  dbId: string;
  apiKey: string | null;
  signal?: AbortSignal;
  // Override the default `fetch` — used in tests so they don't have
  // to monkey-patch a global.
  fetchImpl?: FetchLike;
};

export const ABORT_SENTINEL = Symbol("nlq-data:aborted");

// Returns `ABORT_SENTINEL` when the caller aborts mid-flight, so the
// element knows to stop processing without surfacing a fake "network
// error" placeholder in the DOM.
export async function fetchAsk(p: AskParams): Promise<AskOutcome | typeof ABORT_SENTINEL> {
  const fetchImpl = p.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (p.apiKey) headers["authorization"] = `Bearer ${p.apiKey}`;

  let response: Response;
  try {
    response = await fetchImpl(p.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ goal: p.goal, dbId: p.dbId }),
      // Cookie-bearing same-site / cross-site session is the v0 auth
      // path (Better Auth `__Host-session`); harmless when caller has
      // no cookie set.
      credentials: "include",
      signal: p.signal,
    });
  } catch (err) {
    if (p.signal?.aborted) return ABORT_SENTINEL;
    return {
      ok: false,
      failure: { kind: "network", message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, failure: { kind: "auth", status: response.status } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      failure: { kind: "network", message: "invalid_json_response" },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      failure: { kind: "api", status: response.status, error: extractError(body) },
    };
  }

  return { ok: true, data: body as AskSuccess };
}

function extractError(body: unknown): ApiErrorBody | string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: unknown }).error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object") return e as ApiErrorBody;
  }
  return "unknown_error";
}
