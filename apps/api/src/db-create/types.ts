// Shared types for the `/v1/ask kind=create` typed-plan pipeline
// (DESIGN §3.6.1 + §3.6.2). The four sibling modules
// (`infer-schema`, `compile-ddl`, `neon-provision`, `orchestrate`)
// import from here so contracts stay in one place — Worksheet A
// owns this file's canonical shape; the orchestrator (this PR)
// only imports.
//
// Mirrors the layered split documented in
// [`docs/research-receipts.md §1`](../../../../docs/research-receipts.md):
// the LLM emits a typed `SchemaPlan`, our compiler emits SQL, a
// libpg_query parse-validate runs over the compiled DDL, then a
// transactional provisioner executes. The error unions below name
// the failure modes each layer can surface back to the caller.

import type { LLMRouter } from "@nlqdb/llm";

// --- SchemaPlan -----------------------------------------------------
// The structured-output shape returned by `inferSchema`. Both the
// compiler and the provisioner read from it; the orchestrator only
// pulls a few fields out for the response (`metrics`, `dimensions`,
// `foreign_keys`, `sample_rows`).

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
  // schema name and the public dbId — see DESIGN §14.6 example
  // "orders-tracker-a4f". The orchestrator appends a 6-char
  // random suffix at runtime.
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

// --- infer-schema ---------------------------------------------------

export type InferSchemaDeps = {
  llm: LLMRouter;
};

export type InferSchemaArgs = {
  goal: string;
  // Slug override from `POST /v1/ask {name}`. When present the
  // inferer should bias `slug_hint` toward this string.
  name?: string;
};

export type InferFailureReason =
  | "ambiguous_goal"
  | "off_topic"
  | "table_count_exceeded"
  | "validation_failed"
  | "llm_failed";

export type InferSchemaResult =
  | { ok: true; plan: SchemaPlan }
  | { ok: false; reason: InferFailureReason; details?: unknown };

// --- compile-ddl ----------------------------------------------------

export type CompileFailureReason =
  | "identifier_collision"
  | "reserved_word"
  | "cross_tenant_fk"
  | "unsupported_type";

export type CompileDdlResult =
  | { ok: true; statements: string[] }
  | { ok: false; reason: CompileFailureReason; details?: unknown };

// --- validate-compiled-ddl ------------------------------------------
// Defense-in-depth libpg_query parse + reject-list. Even though our
// own compiler authored the SQL, we re-parse before sending to the
// executor — guards against compiler bugs. DESIGN §3.6.5 row 2.

export type DdlValidationFailureReason =
  | "parse_failed"
  | "destructive_verb"
  | "system_catalog_reference"
  | "multi_statement";

export type DdlValidationResult =
  | { ok: true }
  | { ok: false; reason: DdlValidationFailureReason; statement: string };

// --- neon-provision -------------------------------------------------

export type ProvisionDbDeps = {
  pg: PgClient;
  d1: D1Database;
};

export type ProvisionDbArgs = {
  plan: SchemaPlan;
  dbId: string;
  schemaName: string;
  ddl: string[];
  tenantId: string;
  // The `connection_secret_ref` value to write into the
  // `databases` row — resolved by the route handler from
  // `env.DATABASE_URL` (or a per-tier override). The provisioner
  // does not look up env itself.
  secretRef: string;
  // Deterministic hash of `plan` so `/v1/ask` plan-cache lookups
  // see a stable schema fingerprint immediately.
  schemaHash: string;
};

export type ProvisionFailureReason =
  | "schema_already_exists"
  | "ddl_execution_failed"
  | "sample_insert_failed"
  | "registry_insert_failed"
  | "transaction_failed";

export type ProvisionDbResult =
  | {
      ok: true;
      dbId: string;
      schemaName: string;
      // Minted inside the same transaction that inserts the
      // `databases` row, so the key + DB land atomically. `null`
      // for anonymous tenants — the route handler issues a
      // session-scoped key separately (DESIGN §3.6.4).
      pkLive: string | null;
    }
  | { ok: false; reason: ProvisionFailureReason; rolled_back: boolean };

// --- embed-table-cards ----------------------------------------------
// One pgvector row per table for RAG retrieval at query time.
// `docs/research-receipts.md §3` (Pinterest table-card retrieval).

export type EmbedDeps = {
  pg: PgClient;
  llm: LLMRouter;
};

// --- DB clients (opaque to the orchestrator) ------------------------
// The orchestrator forwards these to the sub-modules; it never calls
// methods on them directly. Kept as narrow shapes so tests can pass
// `{} as PgClient` without pulling in a real driver.

export type PgClient = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
};

// --- DbCreate orchestrator surface ----------------------------------

export type DbCreateArgs = {
  goal: string;
  tenantId: string;
  name?: string;
  // Resolved by the route handler from `env.DATABASE_URL` ref —
  // the orchestrator passes it through to the provisioner.
  secretRef: string;
};

export type DbCreatePlanSummary = {
  metrics: Metric[];
  dimensions: Dimension[];
  foreign_keys: ForeignKey[];
};

export type DbCreateError =
  | { kind: "rate_limited"; retry_after_seconds: number }
  | { kind: "infer_failed"; reason: InferFailureReason; details?: unknown }
  | { kind: "compile_failed"; reason: CompileFailureReason; details?: unknown }
  | { kind: "ddl_invalid"; reason: DdlValidationFailureReason; statement: string }
  | { kind: "provision_failed"; reason: ProvisionFailureReason; rolled_back: boolean }
  // The DB itself is good; only the table-card RAG seed failed.
  // `dbId` is included so callers can retry embedding out-of-band
  // (or surface a "search will warm up shortly" hint to the user).
  | { kind: "embed_failed"; reason: string; dbId: string };

export type DbCreateResult =
  | {
      ok: true;
      dbId: string;
      schemaName: string;
      pkLive: string | null;
      plan: DbCreatePlanSummary;
      sampleRows: SampleRow[];
    }
  | { ok: false; error: DbCreateError };

// Re-export for callers that consume the result type and want
// LLMRouter without a second `@nlqdb/llm` import.
export type { LLMRouter };
