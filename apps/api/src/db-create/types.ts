// Shared types for the `/v1/ask kind=create` typed-plan pipeline
// (docs/architecture.md §3.6.1 + §3.6.2). The four sibling modules
// (`infer-schema`, `compile-ddl`, `neon-provision`, `orchestrate`)
// import from here so contracts stay in one place — Worksheet A
// owns this file's canonical shape; the orchestrator (this PR)
// only imports.
//
// Mirrors the layered split documented in
// [`docs/research-receipts.md §1`](../../../../docs/research-receipts.md):
// the LLM emits a typed `SchemaPlan` (canonical home in
// `packages/db/src/types.ts` per
// `docs/features/hosted-db-create/FEATURE.md` SK-HDC-002), our
// compiler emits SQL, a libpg_query parse-validate runs over the
// compiled DDL, then a transactional provisioner executes. The
// error unions below name the failure modes each layer can surface
// back to the caller.
//
// Related skills:
// - `docs/features/hosted-db-create/FEATURE.md` (canonical owner of
//   the create path; SK-HDC-001..008 govern this file's contracts).
// - `docs/features/ask-pipeline/FEATURE.md` — the `kind=create`
//   branch routes here from `/v1/ask` (SK-ASK-001).

import type { Dimension, Engine, ForeignKey, Metric, SampleRow, SchemaPlan } from "@nlqdb/db";
import type { LLMRouter } from "@nlqdb/llm";
import type { MemoryPreset } from "./presets/agent-memory-v1.ts";

// Re-exports for callers that consume the SchemaPlan family
// alongside the orchestrator's surface, so the import site doesn't
// need a second `@nlqdb/db` line. Canonical home stays in
// `packages/db/src/types.ts` (SK-HDC-002).
export type {
  Column,
  Dimension,
  Engine,
  ForeignKey,
  Metric,
  SampleRow,
  SchemaPlan,
  Table,
} from "@nlqdb/db";

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

// Reason union mirrors what `apps/api/src/db-create/infer-schema.ts`
// actually emits (single source of truth). Wider futures
// (`off_topic`, `table_count_exceeded`) live in `details` for now;
// promote to first-class members when the inferer surfaces them
// distinctly.
export type InferFailureReason = "ambiguous_goal" | "llm_failed" | "plan_invalid";

export type InferSchemaResult =
  | { ok: true; plan: SchemaPlan }
  | { ok: false; reason: Exclude<InferFailureReason, "plan_invalid"> }
  | { ok: false; reason: "plan_invalid"; details: { issue_count: number } };

// --- compile-ddl ----------------------------------------------------
//
// Reason union mirrors what `apps/api/src/db-create/compile-ddl.ts`
// actually emits (single source of truth). The orchestrator + tests
// import these names from here; the compiler re-exports its own
// alias so its caller doesn't need a second import path.

export type CompileFailureReason =
  | "duplicate_identifier"
  | "fk_target_not_found"
  | "reserved_word"
  | "primary_key_column_missing";

export type CompileDdlResult =
  | { ok: true; statements: string[] }
  | { ok: false; reason: CompileFailureReason; details?: unknown };

// --- validate-compiled-ddl ------------------------------------------
// Defense-in-depth libpg_query parse + reject-list. Even though our
// own compiler authored the SQL, we re-parse before sending to the
// executor — guards against compiler bugs. docs/architecture.md §3.6.5
// row 2; SK-HDC-006 codifies the read/write vs DDL split.
//
// Reason union mirrors `apps/api/src/ask/sql-validate-ddl.ts`'s
// emitted set — single source of truth, lives there.

export type DdlValidationFailureReason =
  | "parse_failed"
  | "destructive_verb"
  | "system_schema_ref"
  | "side_effect_function";

export type DdlValidationResult =
  | { ok: true }
  | { ok: false; reason: DdlValidationFailureReason; statement: string; details?: unknown };

// --- provisioner ----------------------------------------------------
// SK-HDC-007 splits the provisioner from day one: Phase 1 wires
// `provisionDb` (schema on shared Neon branch); Phase 4 wires
// `registerByoDb` (BYO connection_url, `docs/architecture.md §3.6.7`).
// Both implement the same `ProvisionFn` shape so the orchestrator
// swaps with a single dep change, not a refactor.

export type ProvisionDeps = {
  pg: PgClient;
  d1: D1Database;
};

export type ProvisionArgs = {
  plan: SchemaPlan;
  dbId: string;
  schemaName: string;
  ddl: string[];
  tenantId: string;
  // SK-DB-010 — engine resolved by the orchestrator (classifier
  // default or explicit override). Persisted into the `databases`
  // row's `engine` column (migration 0001_init.sql) so future
  // /v1/ask reads can route to the right adapter.
  engine: Engine;
  // The `connection_secret_ref` value to write into the
  // `databases` row — resolved by the route handler from
  // `env.DATABASE_URL` (or a per-tier override). The provisioner
  // does not look up env itself.
  secretRef: string;
  // Deterministic hash of `plan` so `/v1/ask` plan-cache lookups
  // see a stable schema fingerprint immediately.
  schemaHash: string;
  // Compiled DDL joined with newlines — the LLM-facing schema text
  // used by `/v1/ask`'s plan prompt. Provisioner stores it on the
  // `databases.schema_text` column so `resolveDb` can return it
  // without re-introspecting Postgres. Separate from `schemaHash`
  // (the cache key, GLOBAL-006) and from `args.ddl` (the executed
  // statements) so callers can override the prompt shape later
  // without touching either of the other two.
  schemaText: string;
};

export type ProvisionFailureReason =
  | "schema_already_exists"
  | "ddl_execution_failed"
  | "sample_insert_failed"
  | "registry_insert_failed"
  | "transaction_failed";

export type ProvisionResult =
  | { ok: true; dbId: string; schemaName: string }
  | { ok: false; reason: ProvisionFailureReason; rolled_back: boolean };

// The injectable shape SK-HDC-007 calls out: Phase 1 = `provisionDb`;
// Phase 4 = `registerByoDb`. The orchestrator only knows the type.
export type ProvisionFn = (deps: ProvisionDeps, args: ProvisionArgs) => Promise<ProvisionResult>;

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

// SK-HDC-012 — `transaction(stmts)` batches a list of SQL statements
// (with optional per-statement params) into a single Neon HTTP round
// trip wrapped server-side in `BEGIN/COMMIT`. Used by the provisioner
// to issue CREATE SCHEMA + role + DDL + RLS + sample inserts in one
// shot; replaces the legacy per-statement loop whose client-side
// `BEGIN/COMMIT` was decorative on Neon HTTP. `query` stays for
// rollback-time `DROP SCHEMA` and the D1 idempotency `SELECT`.
export type PgTransactionStatement = {
  sql: string;
  params?: unknown[];
};

export type PgTransactionResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
};

export type PgClient = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  transaction(statements: PgTransactionStatement[]): Promise<PgTransactionResult[]>;
};

// --- DbCreate orchestrator surface ----------------------------------

export type DbCreateArgs = {
  goal: string;
  tenantId: string;
  name?: string;
  // SK-DB-010 — explicit engine override. When present the
  // orchestrator skips the classifier LLM call and uses this engine.
  // When absent the orchestrator runs `classifyEngine` against the
  // goal text. Validated at the route handler against the canonical
  // `Engine` literal in `@nlqdb/db` before reaching here.
  engine?: Engine;
  // Resolved by the route handler from `env.DATABASE_URL` ref —
  // the orchestrator passes it through to the provisioner.
  secretRef: string;
  // SK-HDC-020 — opt-in agent-memory preset. When set, the orchestrator
  // skips inferSchema / classifyEngine / compileDdl and provisions the
  // deterministic `agent_memory_v1` schema (Postgres-only in v1). The DDL
  // still flows through `validateCompiledDdl` + the provisioner, so
  // SK-HDC-003 defense-in-depth holds. Mutually exclusive with `engine`
  // (the preset pins `postgres`). Gated behind `MEMORY_PRESET` at the route.
  preset?: MemoryPreset;
};

export type DbCreatePlanSummary = {
  metrics: Metric[];
  dimensions: Dimension[];
  foreign_keys: ForeignKey[];
};

// Rate-limit rejection is NOT a member of this union — per
// SK-HDC-008 the per-IP / per-account limiter runs in
// `apps/api/src/ask/classifier.ts` before the orchestrator is
// called, so a rate-limited request never reaches `orchestrateDbCreate`.
export type DbCreateError =
  | {
      kind: "infer_failed";
      reason: Exclude<InferFailureReason, "plan_invalid">;
    }
  | {
      kind: "infer_failed";
      reason: "plan_invalid";
      // Only the count — not the raw Zod issues array — so we don't
      // leak the schema shape to callers.
      details: { issue_count: number };
    }
  | { kind: "compile_failed"; reason: CompileFailureReason; details?: unknown }
  | { kind: "ddl_invalid"; reason: DdlValidationFailureReason; statement: string }
  | { kind: "provision_failed"; reason: ProvisionFailureReason; rolled_back: boolean }
  // The DB itself is good; only the table-card RAG seed failed.
  // `dbId` is included so callers can retry embedding out-of-band
  // (or surface a "search will warm up shortly" hint to the user).
  // `reason` is intentionally absent — embedding error details can
  // contain internal endpoint URLs; keep them server-side.
  | { kind: "embed_failed"; dbId: string };

export type DbCreateResult =
  | {
      ok: true;
      dbId: string;
      schemaName: string;
      // SK-DB-010 — engine the orchestrator picked (classifier
      // default or explicit override). Surfaces echo it on the
      // create response so callers see what was provisioned.
      engine: Engine;
      pkLive: string | null;
      plan: DbCreatePlanSummary;
      sampleRows: SampleRow[];
    }
  | { ok: false; error: DbCreateError };

// Re-export for callers that consume the result type and want
// LLMRouter without a second `@nlqdb/llm` import.
export type { LLMRouter };
