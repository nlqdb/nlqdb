// Deterministic structured insert, the PURE half (SK-SCHEMA-012, GLOBAL-041
// Phase A step 10). Maps `insert(table, rows)` JSON onto the DB's observed
// columns and emits the `WidenPlan` + parameterised INSERT the widen batch
// runs. No model on this path: a JSON value names its own type.
//
// Types are the widest that never block a later write (END_GOAL row 3): a
// number is `numeric`, a string `text`, an object/array `jsonb`; mixed types
// in one new column fall back to `text` (or `jsonb` if any value is an
// object). A tighter type is an async proposal (Phase A step 11), never a
// guess here. The one exception is the new table's `id` key: all-integer ids
// get `bigint` (identity) and all-uuid ids `uuid`, the shapes `autoDefault`
// already generates for (SK-HDC-015); with no `id` key the table gets a
// generated `id uuid`.

import type { ColumnType, Table, WidenPlan } from "@nlqdb/db";
import { quoted, quoteIdent } from "../db-create/compile-ddl.ts";
import type { PgTransactionStatement } from "../db-create/types.ts";

// One call's ceiling. Neon binds at most 65 535 params per statement; the
// cell cap keeps a bulk import well under it and under the 30 s batch.
export const MAX_ROWS = 1000;
export const MAX_CELLS = 30_000;

export type ObservedSchema = Map<string, Map<string, string>>; // table → column → pg data_type

export type InsertPlan = {
  table: string;
  plan: WidenPlan;
  // True when the write named a table or field the schema had not observed —
  // the KPI-1 sample (`inserts_infer_*`, SK-SCHEMA-012).
  widens: boolean;
  insert: PgTransactionStatement;
};

export type InsertPlanResult = { ok: true; value: InsertPlan } | { ok: false; reason: string };

// camelCase / kebab / dotted / `$`-prefixed JSON keys → the lower_snake_case
// identifier every widen name must match (`WriteIdentifierSchema`). Null when
// nothing identifier-like survives.
export function columnName(key: string): string | null {
  const name = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
    .slice(0, 63)
    .replace(/_+$/, "");
  return name.length > 0 ? name : null;
}

type ValueKind = "null" | "boolean" | "numeric" | "text" | "jsonb";

function kindOf(v: unknown): ValueKind | null {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return Number.isFinite(v) ? "numeric" : null;
  if (typeof v === "string") return "text";
  if (typeof v === "object") return "jsonb";
  return null;
}

function mergedType(kinds: Set<ValueKind>): ColumnType {
  kinds.delete("null");
  if (kinds.size === 1) return [...kinds][0] as ColumnType;
  return kinds.has("jsonb") ? "jsonb" : "text";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idType(values: unknown[]): ColumnType {
  if (values.every((v) => typeof v === "number" && Number.isSafeInteger(v))) return "bigint";
  if (values.every((v) => typeof v === "string" && UUID_RE.test(v))) return "uuid";
  return mergedType(new Set(values.map((v) => kindOf(v) ?? "text")));
}

// A JSON column takes the JSON text of any value; any other column takes an
// object as its JSON text and a primitive as itself (Postgres casts it).
function param(v: unknown, pgType: string | undefined): unknown {
  if (v === undefined || v === null) return null;
  if (pgType === "jsonb" || pgType === "json" || typeof v === "object") return JSON.stringify(v);
  return v;
}

export function planInsert(
  observed: ObservedSchema,
  schemaName: string,
  rawTable: string,
  rows: Record<string, unknown>[],
): InsertPlanResult {
  const table = columnName(rawTable);
  if (!table) return { ok: false, reason: "`table` must contain a letter." };
  if (rows.length === 0) return { ok: false, reason: "`rows` must hold at least one row." };
  if (rows.length > MAX_ROWS) {
    return { ok: false, reason: `\`rows\` holds more than ${MAX_ROWS} rows; split the call.` };
  }

  // Normalise every row's keys; first-seen order is the column order.
  const columns: string[] = [];
  const kinds = new Map<string, Set<ValueKind>>();
  const named: Map<string, unknown>[] = [];
  for (const row of rows) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, reason: "Each row must be a JSON object." };
    }
    const out = new Map<string, unknown>();
    for (const [key, value] of Object.entries(row)) {
      const col = columnName(key);
      if (!col) return { ok: false, reason: `Field "${key.slice(0, 60)}" has no letters.` };
      if (out.has(col)) {
        return { ok: false, reason: `Two fields in one row both map to the column "${col}".` };
      }
      const kind = kindOf(value);
      if (!kind) return { ok: false, reason: `Field "${col}" holds a non-JSON value.` };
      out.set(col, value);
      if (!kinds.has(col)) {
        columns.push(col);
        kinds.set(col, new Set());
      }
      kinds.get(col)?.add(kind);
    }
    if (out.size === 0) return { ok: false, reason: "Each row needs at least one field." };
    named.push(out);
  }
  if (rows.length * columns.length > MAX_CELLS) {
    return { ok: false, reason: `One call may write at most ${MAX_CELLS} values; split the call.` };
  }

  const plan: WidenPlan = { create_tables: [], add_columns: [] };
  const existing = observed.get(table);
  const types = new Map<string, string>(existing ?? []);
  if (!existing) {
    const created: Table = { name: table, description: "", columns: [], primary_key: ["id"] };
    if (!kinds.has("id")) {
      created.columns.push({ name: "id", description: "", type: "uuid", nullable: false });
    }
    for (const col of columns) {
      const type =
        col === "id"
          ? idType(named.map((r) => r.get("id")).filter((v) => v !== null && v !== undefined))
          : mergedType(kinds.get(col) ?? new Set());
      created.columns.push({ name: col, description: "", type, nullable: col !== "id" });
    }
    plan.create_tables.push(created);
    for (const c of created.columns) types.set(c.name, c.type);
  } else {
    for (const col of columns) {
      if (existing.has(col)) continue;
      const type = mergedType(kinds.get(col) ?? new Set());
      plan.add_columns.push({
        table,
        column: { name: col, description: "", type, nullable: true },
      });
      types.set(col, type);
    }
  }

  const params: unknown[] = [];
  const tuples = named.map(
    (row) =>
      `(${columns
        .map((col) => {
          params.push(param(row.get(col), types.get(col)));
          return `$${params.length}`;
        })
        .join(", ")})`,
  );
  const sql =
    `INSERT INTO ${quoted(schemaName, table)} (${columns.map(quoteIdent).join(", ")}) ` +
    `VALUES ${tuples.join(", ")} RETURNING *`;

  return {
    ok: true,
    value: {
      table,
      plan,
      widens: plan.create_tables.length + plan.add_columns.length > 0,
      insert: { sql, params },
    },
  };
}
