// Engine-agnostic database adapter contract. Phase 0 ships the
// `postgres` engine via Neon HTTP (docs/design.md §2, docs/implementation.md §3).
// Phase 3 may add `redis` / `duckdb` — they implement the same shape.
//
// Per the product framing (memory: feedback_engine_agnostic_abstraction),
// nlqdb is "natural-language databases" — never "natural-language
// Postgres". The adapter interface is the seam that keeps that promise.
//
// `SchemaPlan` and friends — the typed plan emitted by the
// schema-inference LLM call and consumed by the deterministic DDL
// compiler — live below the adapter types because they're the
// engine-side contract for the hosted db.create pipeline
// (.claude/skills/hosted-db-create/SKILL.md SK-HDC-002, SK-HDC-003).
// SK-HDC's Touchpoints names this file as the canonical home so
// every sub-module imports the same Zod schema and inferred types.

import { z } from "zod";

export type Engine = "postgres";

export type QueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
};

export type DatabaseAdapter = {
  engine: Engine;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
};

// PostgreSQL reserved words (SQL standard + PG-specific). Useful
// subset — perfection deferred to the libpg_query parse over the
// compiled DDL (SK-HDC-003 defense-in-depth). This list catches the
// common LLM slips early and gives a friendlier error than a parse
// failure. Source: PostgreSQL appendix C "SQL Key Words" (reserved +
// reserved non-standard rows).
const POSTGRES_RESERVED = new Set([
  "all",
  "analyse",
  "analyze",
  "and",
  "any",
  "array",
  "as",
  "asc",
  "asymmetric",
  "authorization",
  "between",
  "binary",
  "both",
  "case",
  "cast",
  "check",
  "collate",
  "collation",
  "column",
  "concurrently",
  "constraint",
  "create",
  "cross",
  "current_catalog",
  "current_date",
  "current_role",
  "current_schema",
  "current_time",
  "current_timestamp",
  "current_user",
  "default",
  "deferrable",
  "delete",
  "desc",
  "distinct",
  "do",
  "drop",
  "else",
  "end",
  "except",
  "false",
  "fetch",
  "for",
  "foreign",
  "freeze",
  "from",
  "full",
  "grant",
  "group",
  "having",
  "ilike",
  "in",
  "index",
  "initially",
  "inner",
  "insert",
  "intersect",
  "into",
  "is",
  "isnull",
  "join",
  "lateral",
  "leading",
  "left",
  "like",
  "limit",
  "localtime",
  "localtimestamp",
  "natural",
  "not",
  "notnull",
  "null",
  "offset",
  "on",
  "only",
  "or",
  "order",
  "outer",
  "overlaps",
  "placing",
  "primary",
  "references",
  "returning",
  "right",
  "row",
  "select",
  "session_user",
  "similar",
  "some",
  "symmetric",
  "system_user",
  "table",
  "tablesample",
  "then",
  "to",
  "trailing",
  "true",
  "truncate",
  "union",
  "unique",
  "update",
  "user",
  "using",
  "variadic",
  "verbose",
  "when",
  "where",
  "window",
  "with",
]);

// Lower-snake-case identifier; rejects Postgres reserved words. Used
// for every table/column/metric/dimension/slug name in the plan.
export const IdentifierSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/, "must match /^[a-z][a-z0-9_]*$/ (lower_snake_case)")
  .refine((s) => !POSTGRES_RESERVED.has(s), {
    message: "must not be a Postgres reserved word",
  });
export type Identifier = z.infer<typeof IdentifierSchema>;

export const ColumnTypeSchema = z.enum([
  "text",
  "integer",
  "bigint",
  "numeric",
  "real",
  "double_precision",
  "boolean",
  "date",
  "timestamp_tz",
  "uuid",
  "jsonb",
  "text_array",
]);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

// Safe DEFAULT expressions: numeric literals, booleans, NULL, single-quoted
// string literals (no embedded single quotes — use doubled '' if needed),
// and the common zero-arg functions the schema-inference LLM is likely to emit.
// Rejects `;`, `--`, and `/*` which have no legitimate place in a DEFAULT
// clause and are the canonical SQL injection entry points.
// libpg_query parse (SK-HDC-003 layer 2) catches everything else.
const SAFE_DEFAULT_RE =
  /^(-?\d+(\.\d+)?|true|false|TRUE|FALSE|null|NULL|'[^']*'|gen_random_uuid\(\)|uuid_generate_v4\(\)|now\(\)|CURRENT_TIMESTAMP|CURRENT_DATE)$/;

export const ColumnSchema = z.object({
  name: IdentifierSchema,
  type: ColumnTypeSchema,
  nullable: z.boolean().default(true),
  default: z
    .string()
    .refine((s) => !s.includes(";") && !s.includes("--") && !s.includes("/*"), {
      message: "DEFAULT value must not contain SQL statement terminators or comments",
    })
    .refine((s) => SAFE_DEFAULT_RE.test(s.trim()), {
      message:
        "DEFAULT must be a numeric literal, boolean, NULL, quoted string, or a known zero-arg function (gen_random_uuid(), now(), CURRENT_TIMESTAMP, CURRENT_DATE)",
    })
    .nullable()
    .optional(),
  description: z.string().max(500),
});
export type Column = z.infer<typeof ColumnSchema>;

export const TableSchema = z.object({
  name: IdentifierSchema,
  description: z.string().max(500),
  columns: z.array(ColumnSchema).min(1).max(50),
  primary_key: z.array(IdentifierSchema).min(1),
});
export type Table = z.infer<typeof TableSchema>;

export const OnDeleteSchema = z.enum(["cascade", "restrict", "set_null", "no_action"]);
export type OnDelete = z.infer<typeof OnDeleteSchema>;

export const ForeignKeySchema = z.object({
  from_table: IdentifierSchema,
  from_columns: z.array(IdentifierSchema).min(1),
  to_table: IdentifierSchema,
  to_columns: z.array(IdentifierSchema).min(1),
  on_delete: OnDeleteSchema.default("restrict"),
});
export type ForeignKey = z.infer<typeof ForeignKeySchema>;

export const AggSchema = z.enum(["sum", "count", "count_distinct", "avg", "min", "max"]);
export type Agg = z.infer<typeof AggSchema>;

export const MetricSchema = z.object({
  name: IdentifierSchema,
  description: z.string().max(500),
  agg: AggSchema,
  // `table.column` reference (e.g. "orders.total") or `table.*` for
  // count-star. The compiler resolves it; the LLM doesn't get to
  // author SQL here. Restricted to lower_snake_case identifiers so
  // the expression can never smuggle a SQL fragment through.
  expression: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]*\.[a-z*][a-z0-9_]*$/,
      'must be a "table.column" reference (lower_snake_case) or "table.*" for count-star',
    ),
});
export type Metric = z.infer<typeof MetricSchema>;

export const DimensionSchema = z.object({
  name: IdentifierSchema,
  description: z.string().max(500),
  table: IdentifierSchema,
  column: IdentifierSchema,
});
export type Dimension = z.infer<typeof DimensionSchema>;

// Sample-row values are parameterised in INSERT statements (SK-HDC-009
// point 2) so every value must be a scalar Postgres can accept as a $N
// parameter. Objects and arrays can't be parameterised and would fail
// at INSERT time; reject them here so the error surfaces at plan
// validation rather than mid-transaction.
export const SampleRowSchema = z.object({
  table: IdentifierSchema,
  values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type SampleRow = z.infer<typeof SampleRowSchema>;

// `metrics` and `dimensions` are required arrays — empty allowed,
// absent rejected — per SK-HDC-004 (semantic layer is generated at
// create-time, not deferred).
export const SchemaPlanSchema = z.object({
  slug_hint: IdentifierSchema,
  description: z.string().max(1000),
  tables: z.array(TableSchema).min(1).max(20),
  foreign_keys: z.array(ForeignKeySchema).max(50),
  metrics: z.array(MetricSchema).max(30),
  dimensions: z.array(DimensionSchema).max(50),
  sample_rows: z.array(SampleRowSchema).max(50),
});
export type SchemaPlan = z.infer<typeof SchemaPlanSchema>;
