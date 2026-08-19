// SK-ASK-026 — turn a destructive-ambiguous SQL rejection into a
// `clarify_required` with re-sendable options, instead of the flat
// `sql_rejected` dead-end. "clear db" / "reset" / "wipe everything" makes
// the planner emit TRUNCATE / DROP / bare-DELETE, which the read/write
// allowlist rejects (the Replit-incident guardrail — SK-ASK-004 /
// research-receipts §1 — deliberately NOT relaxed here; SK-TRUST-005 names
// this exact dead-end). This only reshapes the ERROR: the ambiguity is
// real ("clear" = empty the data, drop the DB, or start clean) and the
// options name the interpretations as one-click choices.
//
// Options are built deterministically from the DB's own tables, so there
// is no extra LLM hop — the conversion rides the rejection the plan call
// already produced.

import { tablesFromSchemaText } from "./recent-tables.ts";
import type { ClarifyOption, ClarifyRequired, DbRecord } from "./types.ts";

// Reasons where whole-database intent is likely and the interpretations
// genuinely differ. Every OTHER reject reason (`parse_failed`,
// `disallowed_function`, `multi_statement`, `grant_or_revoke`,
// `alter_statement`, `update_without_where`, …) is not a "which did you
// mean" question — those stay `sql_rejected`, and surfaces render honest,
// reason-specific copy for them.
export const DESTRUCTIVE_CLARIFY_REASONS: ReadonlySet<string> = new Set([
  "drop_statement",
  "truncate_statement",
  "delete_without_where",
]);

// Cap the per-table "empty" chips so the clarify stays scannable; the
// "start fresh" create option is always appended after.
const MAX_TABLE_OPTIONS = 3;

// Returns a `destructive_ambiguous` clarify when `reason` qualifies, else
// `null` (the caller falls back to `sql_rejected`).
export function destructiveClarify(reason: string, db: DbRecord): ClarifyRequired | null {
  if (!DESTRUCTIVE_CLARIFY_REASONS.has(reason)) return null;

  const tables = db.schemaText ? tablesFromSchemaText(db.schemaText) : [];
  const options: ClarifyOption[] = tables.slice(0, MAX_TABLE_OPTIONS).map((t) => ({
    label: `Empty the "${t}" table`,
    // Phrased to keep the planner at full-table scope; SK-ASK-013's
    // validator feedback appends a WHERE, clearing the delete_without_where
    // gate and landing in the SK-TRUST-001 preview→confirm rather than
    // running unconfirmed.
    goal: `delete every row from the ${t} table`,
  }));

  // Always offered: deterministic (forceNoPin routes to the create path)
  // and safe (additive — the existing DB is untouched). This is usually
  // what "clear the database" means: a clean slate.
  options.push({
    label: "Start fresh with a new, empty database",
    goal: "create a new empty database",
    forceNoPin: true,
  });

  return {
    code: "clarify_required",
    clarification: "destructive_ambiguous",
    pinned_db: null,
    reason:
      "Clearing the whole database could mean a few things — pick one, or tell me exactly which rows to remove.",
    options,
  };
}
