// SK-ASK-031 — turn a missing-required-reference write failure into a
// `clarify_required` with one re-sendable option per candidate parent row,
// instead of the flat `write_constraint` dead-end.
//
// The incident this closes (2026-08-19, fifth `rateme12345` attempt): a
// pre-SK-HDC-022 schema has `ideas.user_id NOT NULL REFERENCES users(id)`,
// the goal names no user, and BOTH the free planner (scalar-subquery guess
// → NULL → 23502) and the paid planner (placeholder UUID → 23503) emitted
// doomed SQL despite the SK-LLM-050 directive. A planner that must fill a
// required column the goal cannot answer has no honest output — so the
// recovery must be a question, not better copy. The options are built from
// the user's own parent-table rows (their data, shown to them — the values
// never enter an LLM prompt, GLOBAL-037; a chosen value re-enters as goal
// text exactly as if the user had typed it).
//
// Deterministic, no LLM hop: one bounded SELECT on the DB that just
// rejected the write. Any failure here falls back to the SK-ASK-029
// `write_constraint` envelope — this is a UX upgrade, never a new 5xx.

import type {
  ClarifyOption,
  ClarifyRequired,
  DbRecord,
  QueryResult,
  WriteConstraintError,
} from "./types.ts";

// Chip budget: enough to cover a seeded demo table (3 rows) plus real
// early data, small enough to stay scannable (SK-ASK-026's posture).
const MAX_ROW_OPTIONS = 4;
const FETCH_LIMIT = MAX_ROW_OPTIONS + 2;

// Label-column preference for naming a parent row in a chip. First a
// human-name column, else the first textual non-key column.
const PREFERRED_LABELS = ["name", "title", "label", "username", "email", "slug"];
const TEXTUAL = /^(text|varchar|character\s+varying|char|citext)\b/i;

type Exec = (db: DbRecord, sql: string, signal?: AbortSignal) => Promise<QueryResult>;

// Resolve the parent table a failed column points at, from the DB's own
// `schema_text` DDL (both the `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`
// form the typed-plan compiler emits and inline `REFERENCES`). Matching by
// constraint name covers the 23503 shape (no column in the message);
// matching by (child, column) covers 23502.
export function referencedTable(
  schemaText: string,
  target: { table?: string; column?: string; constraint?: string },
): { parent: string; column: string } | null {
  const fkRe =
    /(?:CONSTRAINT\s+"([^"]+)"\s+)?FOREIGN KEY\s*\(\s*"([^"]+)"\s*\)\s*REFERENCES\s+(?:"[^"]+"\s*\.\s*)?"([^"]+)"/gi;
  for (const m of schemaText.matchAll(fkRe)) {
    const [, constraint, column, parent] = m;
    if (target.constraint && constraint === target.constraint)
      return { parent: parent as string, column: column as string };
    if (target.column && column === target.column)
      return { parent: parent as string, column: column as string };
  }
  // Inline form: `"user_id" UUID NOT NULL REFERENCES "users" ("id")`.
  if (target.column) {
    const inline = new RegExp(
      `"${escapeRe(target.column)}"[^,\\n]*?REFERENCES\\s+(?:"[^"]+"\\s*\\.\\s*)?"([^"]+)"`,
      "i",
    );
    const m = inline.exec(schemaText);
    if (m?.[1]) return { parent: m[1], column: target.column };
  }
  return null;
}

// Pick the column that best names a row of `table`, from its CREATE TABLE
// block. Null when the table has no textual column to show (ids alone make
// meaningless chips).
export function labelColumnOf(schemaText: string, table: string): string | null {
  const block = new RegExp(
    `CREATE TABLE\\s+(?:"[^"]+"\\s*\\.\\s*)?"${escapeRe(table)}"\\s*\\(([\\s\\S]*?)\\n\\)`,
    "i",
  ).exec(schemaText)?.[1];
  if (!block) return null;
  const columns: { name: string; type: string }[] = [];
  for (const line of block.split("\n")) {
    const m = /^\s*"([^"]+)"\s+([A-Za-z][A-Za-z0-9 ()]*)/.exec(line);
    if (m?.[1] && m[2] && !/^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|CHECK)$/i.test(m[1])) {
      columns.push({ name: m[1], type: m[2].trim() });
    }
  }
  const preferred = columns.find((c) => PREFERRED_LABELS.includes(c.name.toLowerCase()));
  if (preferred) return preferred.name;
  return columns.find((c) => TEXTUAL.test(c.type) && !/(^|_)id$/i.test(c.name))?.name ?? null;
}

// Build the clarify, or null when this constraint isn't the
// missing-required-reference shape (unique/check/exclusion keep the
// SK-ASK-029 envelope) or the schema/data can't name candidates.
export async function constraintClarify(
  err: WriteConstraintError,
  goal: string,
  db: DbRecord,
  exec: Exec,
): Promise<ClarifyRequired | null> {
  if (err.kind !== "not_null" && err.kind !== "foreign_key") return null;
  if (!db.schemaText) return null;
  const ref = referencedTable(db.schemaText, err.target);
  if (!ref) return null;
  const labelCol = labelColumnOf(db.schemaText, ref.parent);
  if (!labelCol) return null;

  let rows: QueryResult["rows"];
  try {
    ({ rows } = await exec(db, `SELECT "${labelCol}" FROM "${ref.parent}" LIMIT ${FETCH_LIMIT}`));
  } catch {
    return null; // fall back to the plain write_constraint envelope
  }

  const child = err.target.table ?? "new";
  const labels = [
    ...new Set(
      rows
        .map((r) => (r as Record<string, unknown>)[labelCol])
        .filter((v): v is string => typeof v === "string" && v.trim() !== ""),
    ),
  ].slice(0, MAX_ROW_OPTIONS);

  const options: ClarifyOption[] =
    labels.length > 0
      ? labels.map((label) => ({
          label: `For ${label}`,
          // The chosen value re-enters as goal text — the planner then has a
          // named row to reference, which is exactly what it was missing.
          goal: `${goal} (use the ${ref.parent} row whose ${labelCol} is "${label}")`,
        }))
      : [
          {
            label: `Add a ${ref.parent} entry first`,
            goal: `add a row to the ${ref.parent} table`,
          },
        ];

  return {
    code: "clarify_required",
    clarification: "missing_required_reference",
    pinned_db: null,
    reason:
      labels.length > 0
        ? `Nothing was written — every ${child} row must reference a ${ref.parent} row, and your request didn't say which. Pick one:`
        : `Nothing was written — every ${child} row must reference a ${ref.parent} row, and ${ref.parent} is empty.`,
    options,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
