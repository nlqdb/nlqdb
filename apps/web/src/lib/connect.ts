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

import { firstTouchSource } from "./attribution";

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
  const body: Record<string, unknown> = {
    engine: args.engine,
    connection_url: args.connectionUrl,
  };
  const trimmedName = args.name?.trim();
  if (trimmedName) body["name"] = trimmedName;
  // SK-GTM-007 — forward the first-touch acquisition source so a
  // connect-first signup (common on the developer channels: land from a
  // github/npm README, connect your own DB, never ask-create a demo) is
  // attributable, not `untracked`. Telemetry only — the API drops a
  // malformed value, never fails the connect.
  const source = firstTouchSource();
  if (source) body["source"] = source;

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

// ── Supabase OAuth connect (SK-DBCONN-003) ──────────────────────────────────
// The provider button is a plain navigation to `/start` (it 302s to Supabase);
// the callback returns to `/app/connect` with `?connected` / `?error` / `?pick`.
// The two helpers below drive the multi-project picker (`?pick`).

export interface SupabaseProjectOption {
  ref: string;
  name: string;
  region: string;
}

// One-sentence, action-first copy per callback `?error=` code (GLOBAL-012).
export function oauthConnectErrorMessage(code: string): string {
  switch (code) {
    case "denied":
      return "You didn't approve access on Supabase — try again, or paste a connection string.";
    case "no_projects":
      return "No projects found in your Supabase account — create one, then reconnect.";
    case "expired":
      return "That connect link expired — start the Supabase connect again.";
    case "introspection":
      return "Connected, but the schema couldn't be read — reconnect and make sure the project is active.";
    case "unconfigured":
      return "Supabase connect isn't configured on this deployment — paste a connection string instead.";
    default:
      return "Something went wrong connecting Supabase — try again, or paste a connection string.";
  }
}

export async function listPickProjects(
  apiBase: string,
  pickId: string,
): Promise<{ ok: true; projects: SupabaseProjectOption[] } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch(
      `${apiBase.replace(/\/$/, "")}/v1/db/connect/oauth/supabase/projects?pick=${encodeURIComponent(pickId)}`,
      { credentials: "include" },
    );
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  if (!res.ok) return { ok: false, message: oauthConnectErrorMessage("expired") };
  try {
    const json = (await res.json()) as { projects?: SupabaseProjectOption[] };
    return { ok: true, projects: json.projects ?? [] };
  } catch {
    return { ok: false, message: UNREADABLE_MESSAGE };
  }
}

export async function selectPickProject(
  apiBase: string,
  pickId: string,
  ref: string,
  name?: string,
): Promise<ConnectOutcome> {
  let res: Response;
  try {
    res = await fetch(`${apiBase.replace(/\/$/, "")}/v1/db/connect/oauth/supabase/select`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pick: pickId, ref, ...(name ? { name } : {}) }),
    });
  } catch {
    return { ok: false, status: 0, message: NETWORK_MESSAGE };
  }
  if (res.ok) {
    try {
      const json = (await res.json()) as { db_id: string; name: string; schema_preview: string };
      return {
        ok: true,
        result: {
          dbId: json.db_id,
          name: json.name,
          engine: "postgres",
          schemaPreview: json.schema_preview,
          pkLive: null,
        },
      };
    } catch {
      return { ok: false, status: res.status, message: UNREADABLE_MESSAGE };
    }
  }
  try {
    const json = (await res.json()) as { error?: { status?: number; message?: string } };
    if (json.error?.message) {
      return { ok: false, status: json.error.status ?? res.status, message: json.error.message };
    }
  } catch {
    // not json — fall through
  }
  return { ok: false, status: res.status, message: UNREADABLE_MESSAGE };
}
