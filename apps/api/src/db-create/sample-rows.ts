// db.create — deterministic sample-row validation (SK-HDC-019).
//
// The deterministic complement to SK-LLM-033's probabilistic prompt and the
// strengthened floor under SK-HDC-018. The LLM authors `sample_rows` for the
// seeded first-value demo; at default temperature on the free chain it
// intermittently emits a row that violates the schema's own constraints
// (forward FK reference, missing NOT NULL value, uncoercible type). The
// provisioner inserts every row in one transaction (`neon-provision.ts`), so
// a SINGLE bad row aborts the whole insert with SQLSTATE class 22/23 and
// SK-HDC-018 retries with `sample_rows: []` — i.e. one bad row degrades the
// stranger's first value from "seeded demo" to "empty DB". That all-or-nothing
// drop is what `seeded_ok_ratio` (SK-STRG-008) measures the cost of.
//
// This pass runs BEFORE provisioning and drops ONLY rows it can statically
// PROVE will fail to insert against the plan's declared constraints — never a
// row that might insert. A currently-succeeding create has zero provable
// failures, so pruning is a no-op and the happy path is untouched; a create
// with one bad row keeps the other rows seeded instead of losing all of them.
//
// Soundness contract (why each check only ever drops a guaranteed failure):
//   - unknown table / column → INSERT names an object that doesn't exist
//     (class 42), the row cannot insert as authored.
//   - NOT NULL (incl. primary-key columns, implicitly NOT NULL) with no
//     DEFAULT and an absent/null value → 23502.
//   - type: integer/bigint/numeric/real/double/uuid/boolean values that no
//     Postgres input function for that type would accept → 22P02. Coercible
//     forms ('1', 1, 'true', 'NaN', …) are kept; ambiguous types
//     (date/timestamp/jsonb/text_array/text) are never judged.
//   - foreign key: a non-null FK value with no matching parent row ACCEPTED
//     earlier in plan order → 23503. Matching uses string-coerced equality so
//     a parent that Postgres would accept is never treated as missing.

import type { SampleRow, SchemaPlan } from "./types.ts";

export type DroppedSampleRow = { row: SampleRow; reason: string };
export type SampleRowPruneResult = { rows: SampleRow[]; dropped: DroppedSampleRow[] };

// Postgres boolean input accepts exactly this set (case-insensitive, trimmed).
const BOOL_LITERALS = new Set(["t", "true", "y", "yes", "on", "1", "f", "false", "n", "no", "off", "0"]);
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const INT_RE = /^[+-]?\d+$/;
const NUMERIC_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

// Returns false only when no Postgres input function for `type` could accept
// `value`. Conservative by design — `true` (keep) on any doubt.
function isInsertableValue(value: string | number | boolean, type: string): boolean {
  switch (type) {
    case "integer":
    case "bigint":
      if (typeof value === "number") return Number.isInteger(value);
      if (typeof value === "string") return INT_RE.test(value.trim());
      return true; // boolean → leave to Postgres
    case "numeric":
    case "real":
    case "double_precision":
      if (typeof value === "number") return true;
      if (typeof value === "string") {
        const s = value.trim();
        return NUMERIC_RE.test(s) || ["nan", "infinity", "-infinity", "+infinity"].includes(s.toLowerCase());
      }
      return true;
    case "uuid":
      return typeof value === "string" && UUID_RE.test(value.trim());
    case "boolean":
      if (typeof value === "boolean") return true;
      if (typeof value === "string") return BOOL_LITERALS.has(value.trim().toLowerCase());
      return true; // number → leave to Postgres
    default:
      // text, date, timestamp_tz, jsonb, text_array — too many valid forms
      // to soundly reject. Never judged.
      return true;
  }
}

// Drop only the sample rows that provably cannot insert against `plan`'s
// declared constraints, in plan order so a dropped parent cascades to its
// dangling children. Pure: no IO, no mutation of the input.
export function pruneUninsertableSampleRows(plan: SchemaPlan): SampleRowPruneResult {
  const tables = new Map(plan.tables.map((t) => [t.name, t]));
  const rows: SampleRow[] = [];
  const dropped: DroppedSampleRow[] = [];
  // Accepted rows per table, for FK resolution against earlier inserts.
  const accepted = new Map<string, Array<Record<string, string | number | boolean | null>>>();

  for (const row of plan.sample_rows) {
    const table = tables.get(row.table);
    if (!table) {
      dropped.push({ row, reason: "unknown_table" });
      continue;
    }

    const columnsByName = new Map(table.columns.map((c) => [c.name, c]));
    const pk = new Set(table.primary_key);

    // Unknown column → INSERT would name a non-existent column (42703).
    const unknownColumn = Object.keys(row.values).find((c) => !columnsByName.has(c));
    if (unknownColumn) {
      dropped.push({ row, reason: "unknown_column" });
      continue;
    }

    // NOT NULL completeness — a column is required when it is NOT NULL
    // (explicit `nullable: false` or a primary-key member) AND has no DEFAULT.
    let badReason: string | undefined;
    for (const col of table.columns) {
      const isNotNull = col.nullable === false || pk.has(col.name);
      const hasDefault = col.default != null;
      if (isNotNull && !hasDefault) {
        const v = row.values[col.name];
        if (v == null) {
          badReason = "not_null_violation";
          break;
        }
      }
      const v = row.values[col.name];
      if (v != null && !isInsertableValue(v, col.type)) {
        badReason = "type_mismatch";
        break;
      }
    }
    if (badReason) {
      dropped.push({ row, reason: badReason });
      continue;
    }

    // Foreign keys — a non-null FK value must match a parent row already
    // accepted earlier in plan order (parent-first; forward refs fail 23503).
    let fkBad = false;
    for (const fk of plan.foreign_keys) {
      if (fk.from_table !== row.table) continue;
      const fromVals = fk.from_columns.map((c) => row.values[c]);
      if (fromVals.some((v) => v == null)) continue; // NULL FK is allowed
      const parents = accepted.get(fk.to_table) ?? [];
      const match = parents.some((p) =>
        fk.to_columns.every((c, i) => String(p[c]) === String(fromVals[i])),
      );
      if (!match) {
        fkBad = true;
        break;
      }
    }
    if (fkBad) {
      dropped.push({ row, reason: "fk_violation" });
      continue;
    }

    rows.push(row);
    const bucket = accepted.get(row.table);
    if (bucket) bucket.push(row.values);
    else accepted.set(row.table, [row.values]);
  }

  return { rows, dropped };
}
