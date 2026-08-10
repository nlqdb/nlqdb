// Grant-scope validation layer for cross-tenant reads (EK-06 box 2,
// SK-EKP-008 guardrail #1).
//
// A buyer's granted `/v1/ask` query runs against the *owner's* knowledge
// DB. SK-EKP-008 makes this safe with **three layered guardrails**, not
// one (the same lesson as `sql-validate.ts`): (1) validation-layer scope
// rejection — this module; (2) execution under a non-owner, SELECT-only
// role; (3) `ALTER TABLE … FORCE ROW LEVEL SECURITY`. Layers 2–3 are the
// DB-role half of box 2 and land with the executor wiring; this module
// owns layer 1 and is the piece that refuses **join-leakage** before a
// row is ever read.
//
// The grant's `scope` (a `grants` row, `grants.ts`) enumerates the bare
// table names the buyer may read and is **authoritative** — a table the
// owner adds later is not auto-included (SK-EKP-008: schema widening
// never widens a grant; deny-by-default). A granted query that reaches
// any table outside the scope — directly, or via a JOIN, subquery, or
// CTE body — is rejected here, before execution.
//
// Fail-closed (SK-PIVOT-009 posture, extended never relaxed):
//   - the query must pass the base `/v1/ask` allowlist (`validateSql`),
//     so DDL, multi-statement, disallowed functions (incl. the
//     `set_config`/`current_setting` GUC-spoof primitives), and any
//     unparseable SQL are rejected — inherited, not re-implemented;
//   - a grant is read-only, so any write verb (incl. a data-modifying
//     `WITH … RETURNING` CTE) is rejected — a grant never confers write;
//   - because the base allowlist already rejects `parse_failed`, a query
//     that reaches the scope walk is known-parseable, so `extractTables`
//     returning `[]` here means "genuinely references no table", never
//     "could not be parsed" — no fail-open on a parse the walk missed.

import { extractTables } from "./recent-tables.ts";
import {
  containsWriteVerb,
  leadingVerb,
  stripLeadingComments,
  validateSql,
} from "./sql-validate.ts";

export type GrantScopeReject =
  // Failed the base `/v1/ask` allowlist (DDL, multi-statement, disallowed
  // function, parse failure, …). `detail` carries the base reason.
  | "not_allowed"
  // A grant is SELECT-only; the query writes (top-level or via a
  // data-modifying CTE) or is a non-read verb.
  | "not_read_only"
  // References a table the grant's scope does not enumerate. `detail`
  // carries the offending table name.
  | "out_of_scope";

export type GrantScopeResult =
  | { ok: true; tables: string[] }
  | { ok: false; reason: GrantScopeReject; detail?: string };

// Validate a buyer's SQL against a grant's scope. Returns the referenced
// tables on success (deduped, encounter order) — the caller uses them for
// role provisioning and (grant, buyer, seller) metering attribution.
//
// `scope` is the grant row's table list; it is already lower-cased and
// shape-checked at mint (`grants.ts` `validateScope`). Referenced table
// names are lower-cased for the membership test, mirroring Postgres's own
// case-folding of *unquoted* identifiers (`Lessons` → `lessons`). v1 grants
// are platform-provisioned hosted DBs whose identifiers are only ever
// unquoted lower-case, so a quoted mixed-case reference (`"Lessons"`) can
// resolve only to that same lower-case relation or to nothing — it can
// never name a distinct out-of-scope table, so lower-casing here cannot
// smuggle one past the check.
export function validateGrantScope(rawSql: string, scope: string[]): GrantScopeResult {
  const base = validateSql(rawSql);
  if (!base.ok) return { ok: false, reason: "not_allowed", detail: base.reason };

  // Read-only: reject writes anywhere (top-level or data-modifying CTE),
  // and any leading verb that is not a read. `select`/`with` are the only
  // shapes that produce buyer rows; `show`/`explain` do not read granted
  // rows and are refused so the surface stays exactly "SELECT-only".
  if (containsWriteVerb(rawSql)) return { ok: false, reason: "not_read_only" };
  const leading = leadingVerb(stripLeadingComments(rawSql.trim()));
  if (leading !== "select" && leading !== "with") return { ok: false, reason: "not_read_only" };

  const allowed = new Set(scope.map((t) => t.toLowerCase()));
  const tables = extractTables(rawSql);
  for (const table of tables) {
    if (!allowed.has(table.toLowerCase())) {
      return { ok: false, reason: "out_of_scope", detail: table };
    }
  }
  return { ok: true, tables };
}
