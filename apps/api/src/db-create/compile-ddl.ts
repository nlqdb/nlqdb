// DDL compiler for the db.create slice (docs/architecture.md §3.6.2,
// §3.6.5). The LLM never emits raw DDL — it emits a typed
// `SchemaPlan` (canonical types in @nlqdb/db/types per SK-HDC-002),
// and this compiler turns the plan into deterministic SQL strings.
// The libpg_query parse-validate that runs after the compiler is the
// sibling file `apps/api/src/ask/sql-validate-ddl.ts` (SK-HDC-006),
// not part of this module — splitting the two keeps the audit story
// clean: every line here is "shape SQL", every line over there is
// "reject anything that isn't compiler-shaped DDL."
//
// Sibling skill: .claude/skills/hosted-db-create/SKILL.md.
//
// Why ALTER for FK constraints, not inline REFERENCES:
//   Forward references (table A's FK pointing at table B that's
//   declared later) blow up if we emit FKs inline during CREATE
//   TABLE. Splitting into ALTER ADD CONSTRAINT after all tables
//   exist makes the table order in the plan irrelevant. The cost is
//   one extra round-trip per FK, paid once at create.

import type { Column, ForeignKey, SchemaPlan, Table } from "@nlqdb/db";

// PgType is the closed set of column types this compiler accepts.
// Once PR #65 lands, `ColumnType` from `@nlqdb/db` will be a Zod
// enum and we switch to importing it. Until then the local alias
// keeps the lookup table exhaustive.
type PgType =
  | "text"
  | "integer"
  | "bigint"
  | "numeric"
  | "real"
  | "double_precision"
  | "boolean"
  | "date"
  | "timestamp_tz"
  | "uuid"
  | "jsonb"
  | "text_array";

// On-delete actions match PR #65's Zod schema (which becomes the
// canonical source once that PR lands). Compiler defaults to
// "restrict" when `ForeignKey.on_delete` is absent (current main).
type OnDeleteAction = "cascade" | "restrict" | "set_null" | "no_action";

export type CompileDdlResult =
  | { ok: true; statements: string[] }
  | { ok: false; reason: CompileFailureReason; details?: unknown };

export type CompileFailureReason =
  | "duplicate_identifier"
  | "fk_target_not_found"
  | "reserved_word"
  | "primary_key_column_missing";

// Defensive PG reserved-word list. The Zod gate in @nlqdb/db/types
// rejects non-identifier characters; this catches the *legal-shape
// but reserved* names (`select`, `from`, …). Worksheet A's inferrer
// should already block these, but we re-check at compile time —
// belt-and-braces against a future inferrer regression.
//
// Full list: https://www.postgresql.org/docs/current/sql-keywords-appendix.html
// — keeping just the non-aliasable RESERVED set so we don't
// accidentally reject common column names like "name" or "value".
const PG_RESERVED = new Set([
  "all",
  "analyse",
  "analyze",
  "and",
  "any",
  "array",
  "as",
  "asc",
  "asymmetric",
  "both",
  "case",
  "cast",
  "check",
  "collate",
  "column",
  "constraint",
  "create",
  "current_catalog",
  "current_date",
  "current_role",
  "current_time",
  "current_timestamp",
  "current_user",
  "default",
  "deferrable",
  "desc",
  "distinct",
  "do",
  "else",
  "end",
  "except",
  "false",
  "fetch",
  "for",
  "foreign",
  "from",
  "grant",
  "group",
  "having",
  "in",
  "initially",
  "intersect",
  "into",
  "lateral",
  "leading",
  "limit",
  "localtime",
  "localtimestamp",
  "not",
  "null",
  "offset",
  "on",
  "only",
  "or",
  "order",
  "placing",
  "primary",
  "references",
  "returning",
  "select",
  "session_user",
  "some",
  "symmetric",
  "table",
  "then",
  "to",
  "trailing",
  "true",
  "union",
  "unique",
  "user",
  "using",
  "variadic",
  "when",
  "where",
  "window",
  "with",
]);

const PG_TYPE_SQL: Record<PgType, string> = {
  text: "TEXT",
  integer: "INTEGER",
  bigint: "BIGINT",
  numeric: "NUMERIC",
  real: "REAL",
  double_precision: "DOUBLE PRECISION",
  boolean: "BOOLEAN",
  date: "DATE",
  timestamp_tz: "TIMESTAMPTZ",
  uuid: "UUID",
  jsonb: "JSONB",
  text_array: "TEXT[]",
};

const ON_DELETE_SQL: Record<OnDeleteAction, string> = {
  no_action: "NO ACTION",
  restrict: "RESTRICT",
  cascade: "CASCADE",
  set_null: "SET NULL",
};

// Identifier regex in @nlqdb/db/types blocks embedded quotes; the
// `""` escape is the PG-correct form if a future inferrer ever
// relaxes the shape.
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoted(schema: string, name: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(name)}`;
}

function checkReserved(name: string): boolean {
  return PG_RESERVED.has(name.toLowerCase());
}

function missingColumn(
  cols: readonly string[],
  allowed: ReadonlySet<string>,
  table: string,
  kind: "from_column" | "to_column",
): CompileDdlResult | null {
  for (const c of cols) {
    if (!allowed.has(c)) {
      return {
        ok: false,
        reason: "fk_target_not_found",
        details: { kind, table, column: c },
      };
    }
  }
  return null;
}

function fkConstraintName(fk: ForeignKey): string {
  return `fk_${fk.from_table}__${fk.from_columns.join("_")}`;
}

function fkIndexName(fk: ForeignKey): string {
  return `idx_${fk.from_table}__${fk.from_columns.join("_")}`;
}

function compileTable(table: Table, schemaName: string): string {
  const lines: string[] = [];
  for (const col of table.columns) {
    lines.push(compileColumn(col));
  }
  const pkCols = table.primary_key.map(quoteIdent).join(", ");
  lines.push(`PRIMARY KEY (${pkCols})`);
  const body = lines.map((l) => `  ${l}`).join(",\n");
  return `CREATE TABLE ${quoted(schemaName, table.name)} (\n${body}\n);`;
}

function compileColumn(col: Column): string {
  // `col.type` is `string` on current main; PR #65's Zod schema
  // narrows it to a `ColumnType` enum. Either way the lookup table
  // is exhaustive against the canonical set; an unknown type
  // resolves to `undefined` and the SQL string is malformed,
  // which the libpg_query parse-validator catches downstream.
  const sqlType = PG_TYPE_SQL[col.type as PgType];
  const parts: string[] = [quoteIdent(col.name), sqlType];
  if (col.nullable === false) parts.push("NOT NULL");
  if (col.default !== undefined && col.default !== null) {
    parts.push(`DEFAULT ${col.default}`);
  }
  return parts.join(" ");
}

function compileForeignKey(fk: ForeignKey, schemaName: string): string {
  const fromCols = fk.from_columns.map(quoteIdent).join(", ");
  const toCols = fk.to_columns.map(quoteIdent).join(", ");
  // Default to "restrict" when the plan omits on_delete — matches
  // PR #65's Zod schema which sets the same default.
  const onDelete: OnDeleteAction = fk.on_delete ?? "restrict";
  return [
    `ALTER TABLE ${quoted(schemaName, fk.from_table)}`,
    `  ADD CONSTRAINT ${quoteIdent(fkConstraintName(fk))}`,
    `  FOREIGN KEY (${fromCols})`,
    `  REFERENCES ${quoted(schemaName, fk.to_table)} (${toCols})`,
    `  ON DELETE ${ON_DELETE_SQL[onDelete]};`,
  ].join("\n");
}

function compileFkIndex(fk: ForeignKey, schemaName: string): string {
  const cols = fk.from_columns.map(quoteIdent).join(", ");
  return `CREATE INDEX ${quoteIdent(fkIndexName(fk))} ON ${quoted(schemaName, fk.from_table)} (${cols});`;
}

export function compileDdl(plan: SchemaPlan, schemaName: string): CompileDdlResult {
  if (checkReserved(schemaName)) {
    return { ok: false, reason: "reserved_word", details: { schemaName } };
  }

  const tableColumns = new Map<string, Set<string>>();
  for (const table of plan.tables) {
    if (tableColumns.has(table.name)) {
      return {
        ok: false,
        reason: "duplicate_identifier",
        details: { kind: "table", name: table.name },
      };
    }
    if (checkReserved(table.name)) {
      return { ok: false, reason: "reserved_word", details: { table: table.name } };
    }

    const cols = new Set<string>();
    for (const col of table.columns) {
      if (cols.has(col.name)) {
        return {
          ok: false,
          reason: "duplicate_identifier",
          details: { kind: "column", table: table.name, name: col.name },
        };
      }
      if (checkReserved(col.name)) {
        return {
          ok: false,
          reason: "reserved_word",
          details: { table: table.name, column: col.name },
        };
      }
      cols.add(col.name);
    }
    for (const pk of table.primary_key) {
      if (!cols.has(pk)) {
        return {
          ok: false,
          reason: "primary_key_column_missing",
          details: { table: table.name, column: pk },
        };
      }
    }
    tableColumns.set(table.name, cols);
  }

  for (const fk of plan.foreign_keys) {
    const targetCols = tableColumns.get(fk.to_table);
    const sourceCols = tableColumns.get(fk.from_table);
    if (!sourceCols) {
      return {
        ok: false,
        reason: "fk_target_not_found",
        details: { kind: "from_table", name: fk.from_table },
      };
    }
    if (!targetCols) {
      return {
        ok: false,
        reason: "fk_target_not_found",
        details: { kind: "to_table", name: fk.to_table },
      };
    }
    if (fk.from_columns.length !== fk.to_columns.length) {
      return {
        ok: false,
        reason: "fk_target_not_found",
        details: { kind: "column_count_mismatch", fk },
      };
    }
    const sideMissing =
      missingColumn(fk.from_columns, sourceCols, fk.from_table, "from_column") ??
      missingColumn(fk.to_columns, targetCols, fk.to_table, "to_column");
    if (sideMissing) return sideMissing;
  }

  // Emission order is locked: CREATE SCHEMA → CREATE TABLE × N (in
  // plan order) → ALTER ADD FK × N → CREATE INDEX × N. The two-phase
  // FK pass means table declaration order in the plan never matters.
  const statements: string[] = [];
  statements.push(`CREATE SCHEMA ${quoteIdent(schemaName)};`);
  for (const table of plan.tables) {
    statements.push(compileTable(table, schemaName));
  }
  for (const fk of plan.foreign_keys) {
    statements.push(compileForeignKey(fk, schemaName));
  }
  for (const fk of plan.foreign_keys) {
    statements.push(compileFkIndex(fk, schemaName));
  }
  return { ok: true, statements };
}
