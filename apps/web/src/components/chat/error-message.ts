// Stranger-facing copy for a failed `/v1/ask` (SK-WEB-005 — the first-answer
// error moment gates the first-10-queries success KPI, GLOBAL-025).
//
// SK-ERR-001 — the API renders one sentence + the next action from the shared
// `@nlqdb/errors` registry, so this is a pass-through. The per-code switch that
// used to live here is gone: it was one of four parallel copy tables that had
// already drifted, and it could only ever guess at a cause the throw site knew
// (it is what told a user with a rejected BYOLLM key to "try rephrasing", and a
// foreign-key violation that the database was unreachable — 2026-08-17/18).
//
// What stays is the handful of failures the *client* owns, which never reach the
// server and so have no wire copy: a dropped connection and a user-cancelled
// request.

import { NlqdbApiError } from "@nlqdb/sdk";

// Client-side failure sentinels. Not overrides of server copy — the server
// never sees these, so someone has to phrase them, and it is us.
const CLIENT_COPY: Record<string, string> = {
  aborted: "Cancelled.",
  network_error: "Couldn't reach the API — check your connection.",
};

export function messageFor(err: unknown): string {
  if (!(err instanceof NlqdbApiError)) return "Something went wrong — try again.";
  const client = CLIENT_COPY[err.code];
  if (client) return client;
  const body = err.body;
  if (body?.message) {
    // The action is the half a stranger acts on, so never drop it. Joined with
    // an em-dash to match the one-line chip the chat renders.
    return body.action ? `${body.message} ${body.action}` : body.message;
  }
  // A response with no envelope at all (a proxy error page, an ancient API).
  return "Something went wrong — try again.";
}
