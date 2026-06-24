import type { CreateError } from "./api";

// User-facing copy for each anonymous-create failure. Centralised here so
// the CreateForm island and its tests share one source of truth, and the
// switch stays exhaustive over CreateError["kind"] (TS errors if a new kind
// lands without copy). Every branch returns a plain, actionable sentence —
// it never leaks the raw `kind` slug to the user (GLOBAL-012).
export function messageFor(error: CreateError): string {
  switch (error.kind) {
    case "challenge_required":
      return "Refresh and try again in a moment.";
    case "rate_limited":
      return error.retryAfter
        ? `Slow down — try again in ${error.retryAfter}s.`
        : "Slow down — try again in a moment.";
    case "auth_required":
      // Reached only if the redirect didn't fire (e.g. browser
      // blocked navigation). The pending prompt is already saved.
      return "Sign in to continue — your prompt is saved.";
    case "unauthorized":
      return "Clear your browser storage and reload to continue.";
    case "goal_unclear":
      return "Try describing what you want to build, e.g. 'a messages database' or 'an orders tracker'.";
    case "server_error":
      return "Try again — the database couldn't be created.";
  }
}
