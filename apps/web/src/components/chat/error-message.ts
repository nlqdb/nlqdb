// Stranger-facing copy for a failed `/v1/ask` (SK-WEB-005 — the first-answer
// error moment gates the first-10-queries success KPI, GLOBAL-025). Extracted
// from ChatPanel so the mapping is unit-tested like its sibling pure helpers
// (`data-rows.ts`, `reply-settle.ts`): a stranger's recovery hinges on the
// exact words, and an untested branch drifts.

import { NlqdbApiError } from "@nlqdb/sdk";

// How many available table names to spell out in the schema_mismatch copy
// before summarising the rest. Bounds message length while the `+N more`
// suffix (below) keeps the list honest — a stranger must never read the
// shown subset as the DB's complete schema and abandon a valid query.
const SCHEMA_TABLES_SHOWN = 5;

export function messageFor(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    switch (err.code) {
      case "rate_limited":
        return "Slow down — try again in a moment.";
      case "unauthorized":
        return "Sign in expired — sign in again to continue.";
      case "sql_rejected":
        return "That query was rejected — try rephrasing.";
      case "db_unreachable":
      case "db_misconfigured":
        return "Couldn't reach the database — try again.";
      case "llm_failed":
        return "Couldn't generate a plan — try rephrasing.";
      case "aborted":
        return "Cancelled.";
      case "network_error":
        return "Couldn't reach the API — check your connection.";
      case "db_not_found":
        return "That database isn't available — try a different one.";
      case "schema_unavailable":
        return "Couldn't load the database schema — try again.";
      case "schema_mismatch":
        return schemaMismatchMessage(err.body);
    }
  }
  return "Something went wrong — try again.";
}

// SK-ASK-016 — the pre-flight path returns referencedTables (in the goal,
// missing from the DB) and schemaTables (what's actually there). Surface both
// so the user can rephrase or create a new DB instead of dead-ending on
// "Something went wrong". The exec-catch backstop leaves both empty (it only
// knows a relation was missing), so fall through to the generic line.
function schemaMismatchMessage(body: unknown): string {
  const b = body as { referencedTables?: string[]; schemaTables?: string[] } | null;
  const missing = b?.referencedTables ?? [];
  const allAvailable = b?.schemaTables ?? [];
  const shown = allAvailable.slice(0, SCHEMA_TABLES_SHOWN);
  if (missing.length > 0 && shown.length > 0) {
    const tablesWord = missing.length === 1 ? "table" : "tables";
    // The API sends the full table list; we only cap the display. Name the
    // remainder so the shown subset never reads as the complete schema.
    const overflow = allAvailable.length - shown.length;
    const more = overflow > 0 ? ` (+${overflow} more)` : "";
    return `No such ${tablesWord}: ${missing.join(", ")}. This database has: ${shown.join(", ")}${more}.`;
  }
  if (missing.length > 0) {
    return `This database has no ${missing.join(", ")} table — try rephrasing or creating a new database.`;
  }
  return "That query references a table this database doesn't have — try rephrasing or creating a new database.";
}
