// Deterministic structured insert, the PURE half (SK-SCHEMA-012, GLOBAL-041
// Phase A step 10). Maps `insert(table, rows)` JSON onto the DB's observed
// columns and emits the `WidenPlan` + parameterised INSERT the widen batch
// runs. No model on this path: a JSON value names its own type.
//
// Types are the widest that never block a later write (END_GOAL row 3): a
// number is `numeric`, a string `text`, an object/array `jsonb`; mixed types
// in one new column fall back to `text` (or `jsonb` if any value is an
// object). A tighter type is an async proposal (Phase A step 14), never a
// guess here. The one exception is the new table's `id` key: all-integer ids
// get `bigint` (identity) and all-uuid ids `uuid`, the shapes `autoDefault`
// already generates for (SK-HDC-015); with no `id` key the table gets a
// generated `id uuid`.
//
// A `key` (GLOBAL-041 Phase A step 11) makes the write an upsert: the key's
// columns get a unique index on first use, in the same transaction, and a row
// whose key exists updates the fields it names — a re-run import or a flipped
// vote never duplicates, and a field a row omits keeps its stored value.

import { type ColumnType, fingerprintSchema, type Table, type WidenPlan } from "@nlqdb/db";
import { quoted, quoteIdent } from "../db-create/compile-ddl.ts";
import type { PgTransactionStatement } from "../db-create/types.ts";

// One call's ceiling. Neon binds at most 65 535 params per statement; the
// cell cap keeps a bulk import well under it and under the 30 s batch.
export const MAX_ROWS = 1000;
export const MAX_CELLS = 30_000;

export type ObservedSchema = Map<string, Map<string, string>>; // table → column → pg data_type

// The target table's unique indexes (plain-column, non-partial), each as its
// column set — what `ON CONFLICT (cols)` can infer an arbiter from.
export type UniqueKeys = string[][];

export type InsertPlan = {
  table: string;
  plan: WidenPlan;
  // True when the write named a table or field the schema had not observed —
  // the KPI-1 sample (`inserts_infer_*`, SK-SCHEMA-012).
  widens: boolean;
  // Runs right before `insert` when a row names an integer `id`: moves the
  // id's sequence past it (see `SEQUENCE_SQL`). Absent otherwise.
  sequence?: PgTransactionStatement;
  // A keyed write whose key no unique index covers yet: the table lock and
  // the `CREATE UNIQUE INDEX` that run before the inserts. Absent otherwise.
  uniqueIndex?: { lock: string; ddl: string };
  // One INSERT; a keyed write gets one per row shape, so each row updates
  // exactly the fields it names.
  inserts: PgTransactionStatement[];
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

// Postgres reserves these on every table; a CREATE/ADD naming one fails 42701.
const SYSTEM_COLUMNS = new Set(["tableoid", "xmin", "cmin", "xmax", "cmax", "ctid"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idType(values: unknown[]): ColumnType {
  if (values.every((v) => typeof v === "number" && Number.isSafeInteger(v))) return "bigint";
  if (values.every((v) => typeof v === "string" && UUID_RE.test(v))) return "uuid";
  return mergedType(new Set(values.map((v) => kindOf(v) ?? "text")));
}

// A JSON column takes the JSON text of any value; an array column (the
// create path's `text_array`, `data_type` `ARRAY`) takes a JSON array as is,
// which the driver binds as a Postgres array literal; any other column takes
// an object as its JSON text and a primitive as itself (Postgres casts it).
function param(v: unknown, pgType: string | undefined): unknown {
  if (v === undefined || v === null) return null;
  if (pgType === "ARRAY" && Array.isArray(v)) return v;
  if (pgType === "jsonb" || pgType === "json" || typeof v === "object") return JSON.stringify(v);
  return v;
}

// An app-supplied integer `id` does not advance an identity sequence, so a
// row that takes DEFAULT — later in the batch or in a later call — would draw
// the same id (23505). Lift the sequence to the batch's largest explicit id
// before the INSERT, only when that raises it — a setval that kept the value
// could lower a sequence a concurrent insert advanced meanwhile. A no-op on an
// `id` with no sequence.
const SEQUENCE_SQL =
  "SELECT setval(seq::regclass, $1::bigint) FROM pg_get_serial_sequence($2, 'id') AS seq " +
  "WHERE seq IS NOT NULL AND $1::bigint > COALESCE(pg_sequence_last_value(seq::regclass), 0)";

export function planInsert(
  observed: ObservedSchema,
  schemaName: string,
  rawTable: string,
  rows: Record<string, unknown>[],
  rawKey: string[] = [],
  uniqueKeys: UniqueKeys = [],
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
      if (SYSTEM_COLUMNS.has(col)) {
        return { ok: false, reason: `Field "${col}" is a Postgres system column name; rename it.` };
      }
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

  const key: string[] = [];
  for (const k of rawKey) {
    const col = columnName(k);
    if (!col) return { ok: false, reason: `Key field "${k.slice(0, 60)}" has no letters.` };
    if (key.includes(col)) return { ok: false, reason: `Key field "${col}" is named twice.` };
    key.push(col);
  }
  // A NULL never conflicts in a unique index, so a keyless row would insert a
  // duplicate instead of upserting. Two rows on one key would make Postgres
  // update a row twice (21000); they merge, the later one's fields winning,
  // as two calls would.
  const byKey = new Map<string, Map<string, unknown>>();
  for (const [i, row] of named.entries()) {
    const missing = key.find((col) => row.get(col) === null || row.get(col) === undefined);
    if (missing)
      return { ok: false, reason: `Row ${i + 1} has no value for key field "${missing}".` };
    const id = JSON.stringify(key.map((col) => row.get(col)));
    const prior = byKey.get(id);
    byKey.delete(id);
    byKey.set(id, prior ? new Map([...prior, ...row]) : row);
  }
  const landing = key.length > 0 ? [...byKey.values()] : named;

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

  // Unkeyed, one INSERT: a field a row omits is `DEFAULT`, not NULL, so a
  // generated `id` or a `created_at DEFAULT now()` still fills in a
  // mixed-shape batch. Keyed, one INSERT per row shape, so `DO UPDATE` sets
  // only the fields those rows name; it always sets something (the key, to
  // itself, at worst), so `RETURNING` hands back every row.
  // A null `id` names no field: updating a stored row's id to a fresh DEFAULT
  // would re-key it.
  const shapeOf = (row: Map<string, unknown>) =>
    key.length > 0
      ? columns.filter((c) => row.has(c) && !(c === "id" && row.get(c) === null))
      : columns;
  const groups = new Map<string, { cols: string[]; rows: Map<string, unknown>[] }>();
  for (const row of landing) {
    const cols = shapeOf(row);
    const group = groups.get(cols.join(","));
    if (group) group.rows.push(row);
    else groups.set(cols.join(","), { cols, rows: [row] });
  }
  const inserts = [...groups.values()].map(({ cols, rows: group }) => {
    const params: unknown[] = [];
    const tuples = group.map(
      (row) =>
        `(${cols
          .map((col) => {
            // A null `id` is no id: the key is NOT NULL, so it takes DEFAULT too.
            if (!row.has(col) || (col === "id" && row.get(col) === null)) return "DEFAULT";
            params.push(param(row.get(col), types.get(col)));
            return `$${params.length}`;
          })
          .join(", ")})`,
    );
    const set = cols.filter((c) => !key.includes(c));
    const upsert =
      key.length === 0
        ? ""
        : ` ON CONFLICT (${key.map(quoteIdent).join(", ")}) DO UPDATE SET ${(set.length > 0
            ? set
            : key.slice(0, 1)
          )
            .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
            .join(", ")}`;
    const sql =
      `INSERT INTO ${quoted(schemaName, table)} (${cols.map(quoteIdent).join(", ")}) ` +
      `VALUES ${tuples.join(", ")}${upsert} RETURNING *`;
    return { sql, params };
  });

  // First use of a key: a unique index on exactly its columns, unless one
  // exists (or the new table's primary key is the key). Two first uses would
  // each take the index's SHARE lock, then deadlock on their INSERTs; a
  // self-conflicting lock taken first queues them, and the later one's
  // `IF NOT EXISTS` finds the index. Rows already duplicating the key fail it
  // as `write_constraint` (unique).
  const sameSet = (cols: string[]) =>
    cols.length === key.length && cols.every((c) => key.includes(c));
  const covered =
    uniqueKeys.some(sameSet) || (!existing && sameSet(plan.create_tables[0]?.primary_key ?? []));
  // A name past Postgres's 63 bytes is cut and hash-suffixed: plain truncation
  // could land two keys on one name, and `IF NOT EXISTS` would then skip the
  // second key's index.
  const fullName = `${table}_${key.join("_")}_key`;
  const indexName =
    fullName.length <= 63
      ? fullName
      : `${fullName.slice(0, 54)}_${fingerprintSchema(`${table}\0${key.join("\0")}`)}`;
  const uniqueIndex =
    key.length > 0 && !covered
      ? {
          lock: `LOCK TABLE ${quoted(schemaName, table)} IN SHARE ROW EXCLUSIVE MODE`,
          ddl:
            `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(indexName)} ` +
            `ON ${quoted(schemaName, table)} (${key.map(quoteIdent).join(", ")})`,
        }
      : undefined;

  const ids = landing.map((r) => r.get("id")).filter((v) => Number.isSafeInteger(v)) as number[];
  const maxId = Math.max(0, ...ids);

  return {
    ok: true,
    value: {
      table,
      plan,
      widens: plan.create_tables.length + plan.add_columns.length > 0,
      ...(types.has("id") && maxId >= 1
        ? { sequence: { sql: SEQUENCE_SQL, params: [maxId, quoted(schemaName, table)] } }
        : {}),
      ...(uniqueIndex ? { uniqueIndex } : {}),
      inserts,
    },
  };
}
