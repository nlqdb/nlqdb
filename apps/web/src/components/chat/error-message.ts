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
        return sqlRejectedMessage(err.body);
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
      case "write_no_rows":
        return writeNoRowsMessage(err.body);
      case "write_constraint":
        return writeConstraintMessage(err.body);
    }
  }
  return "Something went wrong — try again.";
}

// SK-ASK-026 — the API already ships the specific allowlist reject reason
// in `body.reason`; map it to honest, actionable copy instead of the flat
// "That query was rejected". The destructive-ambiguous family
// (drop/truncate/delete-all) normally comes back as a `clarify_required`
// with options and never reaches here — this copy is the defense-in-depth
// fallback for the stash/cache reject paths that still emit `sql_rejected`.
const SQL_REJECT_COPY: Record<string, string> = {
  drop_statement: "Dropping tables isn't supported from chat — start a new database instead.",
  truncate_statement:
    "Emptying a whole table isn't a one-click action from chat — delete rows with a filter.",
  delete_without_where: "That would delete every row — add a filter, or say which rows to remove.",
  update_without_where:
    "That would update every row — add a filter (e.g. \"… where status = 'open'\").",
  grant_or_revoke: "Changing database permissions isn't supported from chat.",
  alter_statement: "Changing a table's structure isn't supported from chat.",
  disallowed_verb: "That kind of statement isn't allowed here — ask in plain English.",
  disallowed_function: "That query uses a function that isn't allowed here.",
  multi_statement: "Ask one thing at a time — that came through as multiple statements.",
  parse_failed: "I couldn't turn that into a valid query — try rephrasing.",
  empty: "That came through empty — try rephrasing.",
  // SK-TRUST-006 — an unpreviewable write is never run, so say that plainly.
  preview_unavailable: "I couldn't preview that change, so I didn't run it — try rephrasing.",
};

function sqlRejectedMessage(body: unknown): string {
  const reason = (body as { reason?: string } | null)?.reason;
  return (
    (reason ? SQL_REJECT_COPY[reason] : undefined) ?? "That query was rejected — try rephrasing."
  );
}

// SK-TRUST-006 — a write that affects no rows. `phase: "preview"` means we
// never ran it (the pre-flight count was 0, so there was nothing to approve);
// `phase: "commit"` means an approved write ran and changed nothing. Both say
// so plainly and name the one next action — the old copy was the generic
// "No rows returned." of an empty read, which read as success.
function writeNoRowsMessage(body: unknown): string {
  const b = body as { phase?: string; verb?: string; table?: string } | null;
  const target = b?.table ? ` in ${b.table}` : "";
  if (b?.phase === "commit") {
    return `Nothing was changed${target} — that ran but matched no rows, so say which row to write.`;
  }
  return `Nothing to write${target} — no rows matched, so say which row you mean.`;
}

// SK-ASK-029 — the engine refused the write. Name the column that broke the
// rule (identifiers only — the API never sends the offending values) so the
// user's next message can supply a real one. This used to arrive as
// `db_unreachable` ("Couldn't reach the database — try again"), which sent the
// user to retry a statement that could never succeed.
function writeConstraintMessage(body: unknown): string {
  const b = body as { kind?: string; table?: string; column?: string } | null;
  const field = b?.column ? (b.table ? `${b.table}.${b.column}` : b.column) : null;
  switch (b?.kind) {
    case "foreign_key":
      return `Nothing was written — ${field ?? "that link"} has to point at a row that already exists, so name an existing one.`;
    case "not_null":
      return `Nothing was written — ${field ?? "a required field"} can't be empty, so include it in your request.`;
    case "unique":
      return `Nothing was written — ${field ?? "that value"} already exists, so use a different one.`;
    default:
      return `Nothing was written — the database rejected those values${field ? ` for ${field}` : ""}; try different ones.`;
  }
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
