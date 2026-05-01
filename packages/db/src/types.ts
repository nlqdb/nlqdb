// Engine-agnostic database adapter contract. Phase 0 ships the
// `postgres` engine via Neon HTTP (docs/design.md §2,
// docs/implementation.md §3). Phase 3 may add `redis` / `duckdb` —
// they implement the same shape.
//
// Per the product framing (memory: feedback_engine_agnostic_abstraction),
// nlqdb is "natural-language databases" — never "natural-language
// Postgres". The adapter interface is the seam that keeps that promise.

export type Engine = "postgres";

export type QueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
};

export type DatabaseAdapter = {
  engine: Engine;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
};

// --- SchemaPlan -----------------------------------------------------
// The structured-output shape returned by the typed-plan inference
// step (`apps/api/src/db-create/infer-schema.ts`). Lives here so the
// db-adapter, the typed-plan compiler, the provisioner, and any
// future engine adapter share a single canonical shape.
//
// Owners by skill: `.claude/skills/hosted-db-create/SKILL.md`
// SK-HDC-002 (LLM emits typed plan; deterministic compiler emits
// SQL) and SK-HDC-004 (semantic layer generated at create-time).
// `.claude/skills/db-adapter/SKILL.md` SK-DB-007 (schema-per-DB
// tenancy) consumes the plan when wiring search_path / role grants.

export type Column = {
  name: string;
  type: string;
  nullable: boolean;
  // Optional Postgres-side default literal (e.g. "now()", "0").
  default?: string;
  // Phase 2 semantic-layer hint — surfaces in
  // `plan.dimensions` mapping. Absent for opaque columns.
  description?: string;
};

export type Table = {
  name: string;
  columns: Column[];
  primary_key: string[];
  description?: string;
};

export type ForeignKey = {
  from_table: string;
  from_columns: string[];
  to_table: string;
  to_columns: string[];
};

export type Metric = {
  name: string;
  // SQL-flavoured aggregation expression — bound to a table at
  // compile time. Example: "count(*)", "sum(orders.total_cents)".
  expression: string;
  description?: string;
};

export type Dimension = {
  name: string;
  // `<table>.<column>` reference resolved by the compiler.
  column: string;
  description?: string;
};

export type SampleRow = {
  table: string;
  values: Record<string, unknown>;
};

export type SchemaPlan = {
  // Lower-case, underscore-separated. Used to derive both the
  // schema name and the public dbId — see docs/design.md §14.6
  // example "orders-tracker-a4f". The orchestrator appends a
  // 6-char random suffix at runtime.
  slug_hint: string;
  // Optional human display name (passed through from `args.name`
  // when supplied, otherwise inferred).
  name?: string;
  tables: Table[];
  foreign_keys: ForeignKey[];
  metrics: Metric[];
  dimensions: Dimension[];
  sample_rows: SampleRow[];
};
