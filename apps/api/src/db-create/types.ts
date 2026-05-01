// Shared types for the `/v1/ask kind=create` typed-plan pipeline
// (docs/design.md §3.6.1 + §3.6.2). The four sibling modules
// (`infer-schema`, `compile-ddl`, `neon-provision`, `orchestrate`)
// import from here so contracts stay in one place — Worksheet A
// owns this file's canonical shape; the orchestrator (this PR)
// only imports.
//
// Mirrors the layered split documented in
// [`docs/research-receipts.md §1`](../../../../docs/research-receipts.md):
// the LLM emits a typed `SchemaPlan` (canonical home in
// `packages/db/src/types.ts` per
// `.claude/skills/hosted-db-create/SKILL.md` SK-HDC-002), our
// compiler emits SQL, a libpg_query parse-validate runs over the
// compiled DDL, then a transactional provisioner executes. The
// error unions below name the failure modes each layer can surface
// back to the caller.
//
// Related skills:
// - `.claude/skills/hosted-db-create/SKILL.md` (canonical owner of
//   the create path; SK-HDC-001..008 govern this file's contracts).
// - `.claude/skills/ask-pipeline/SKILL.md` — the `kind=create`
//   branch routes here from `/v1/ask` (SK-ASK-001).

import type { Dimension, ForeignKey, Metric, SampleRow, SchemaPlan } from "@nlqdb/db";
import type { LLMRouter } from "@nlqdb/llm";

// Re-exports for callers that consume the SchemaPlan family
// alongside the orchestrator's surface, so the import site doesn't
// need a second `@nlqdb/db` line. Canonical home stays in
// `packages/db/src/types.ts` (SK-HDC-002).
export type {
  Column,
  Dimension,
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
  | { ok: false; reason: InferFailureReason; details?: unknown };

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
// executor — guards against compiler bugs. docs/design.md §3.6.5
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
// `registerByoDb` (BYO connection_url, `docs/design.md §3.6.7`).
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

export type ProvisionResult =
  | {
      ok: true;
      dbId: string;
      schemaName: string;
      // Minted inside the same transaction that inserts the
      // `databases` row, so the key + DB land atomically. `null`
      // for anonymous tenants — the route handler issues a
      // session-scoped key separately (docs/design.md §3.6.4).
      pkLive: string | null;
    }
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

// Rate-limit rejection is NOT a member of this union — per
// SK-HDC-008 the per-IP / per-account limiter runs in
// `apps/api/src/ask/classifier.ts` before the orchestrator is
// called, so a rate-limited request never reaches `orchestrateDbCreate`.
export type DbCreateError =
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
