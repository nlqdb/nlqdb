// Tiny `POST /v1/db/connect` client for the BYO-connect page
// (SK-WEB-019; backend SK-DBCONN-001). Cookie-authenticated
// (`credentials: "include"`) — unlike the anon hero create (`api.ts`,
// `credentials: "omit"`), the connect page is behind the auth guard, so
// the session cookie is exactly the principal we want.
//
// Secrets discipline (GLOBAL-031 / GLOBAL-012): the connection URL is a
// secret. It rides the request body and is NEVER persisted client-side
// (no localStorage draft, unlike CreateForm) — see ConnectForm.tsx. This
// helper just shapes the call + normalises the response into a tagged
// outcome; the error `message` is rendered verbatim as one sentence.

export type ConnectEngine = "clickhouse" | "postgres";

export interface ConnectSuccess {
  dbId: string;
  name: string;
  engine: string;
  schemaPreview: string;
  pkLive: string | null;
}

export type ConnectOutcome =
  | { ok: true; result: ConnectSuccess }
  // `status` is the HTTP status; `message` is the already-safe sentence
  // the API returns in `{ error: { status, message } }` (GLOBAL-012).
  | { ok: false; status: number; message: string };

export interface ConnectArgs {
  engine: ConnectEngine;
  connectionUrl: string;
  name?: string;
}

const NETWORK_MESSAGE = "Couldn't reach the API — check your connection and try again.";
const UNREADABLE_MESSAGE = "Something went wrong connecting your database — try again.";

export async function postConnect(apiBase: string, args: ConnectArgs): Promise<ConnectOutcome> {
  const body: Record<string, string> = {
    engine: args.engine,
    connection_url: args.connectionUrl,
  };
  const trimmedName = args.name?.trim();
  if (trimmedName) body["name"] = trimmedName;

  let res: Response;
  try {
    res = await fetch(`${apiBase.replace(/\/$/, "")}/v1/db/connect`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Optional idempotency on a mutating endpoint (GLOBAL-005) — a
        // double-submit reuses the same connect rather than minting twice.
        ...(typeof crypto !== "undefined" && crypto.randomUUID
          ? { "idempotency-key": crypto.randomUUID() }
          : {}),
      },
      // Cookie session is the principal (the page is auth-guarded).
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, message: NETWORK_MESSAGE };
  }

  if (res.ok) {
    try {
      const json = (await res.json()) as ConnectSuccess;
      return { ok: true, result: json };
    } catch {
      return { ok: false, status: res.status, message: UNREADABLE_MESSAGE };
    }
  }

  // Error envelope: `{ error: { status, message } }` (GLOBAL-012). Fall
  // back to a generic sentence if the body isn't the expected shape.
  try {
    const json = (await res.json()) as { error?: { status?: number; message?: string } };
    const message = json.error?.message;
    if (message) {
      return { ok: false, status: json.error?.status ?? res.status, message };
    }
  } catch {
    // not json — fall through
  }
  return { ok: false, status: res.status, message: UNREADABLE_MESSAGE };
}
