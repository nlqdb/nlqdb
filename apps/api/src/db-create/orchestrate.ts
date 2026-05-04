// `/v1/ask kind=create` orchestrator. Pure function — every external
// dep is passed in. Mirrors `apps/api/src/ask/orchestrate.ts` (the
// canonical deps-injected pattern in this repo); tests construct
// stubs, the route handler builds prod deps from the request context
// (env bindings + execution ctx) — see `apps/api/src/ask/build-deps.ts`.
//
// Pipeline implements the typed-plan flow from
// [`docs/architecture.md §3.6.1`](../../../../docs/architecture.md#361-endpoint-shape) +
// [`docs/architecture.md §3.6.2`](../../../../docs/architecture.md#362-typed-plan-pipeline-the-create-path):
//
//   inferSchema → compileDdl → validateCompiledDdl →
//   provision → embedTableCards
//
// Each layer is a separate guardrail (`docs/research-receipts.md
// §1`); the orchestrator's job is to ensure they run in order and
// short-circuit cleanly on any failure.
//
// Rate-limit is NOT in this pipeline — per
// `.claude/skills/hosted-db-create/SKILL.md` SK-HDC-008 the per-IP
// (5/hr anonymous) / per-account (20/day authed) check runs in
// `apps/api/src/ask/classifier.ts` before the orchestrator is
// called, where the request-level info needed to discriminate IP
// from account is still in scope.
//
// Sub-modules own their own OTel spans on external calls
// (GLOBAL-014); the orchestrator is in-process and adds no external
// boundaries of its own.
//
// Related skill: `.claude/skills/hosted-db-create/SKILL.md` is the
// canonical owner of the create path (SK-HDC-001..008). The
// `kind=create` branch routes here from `/v1/ask` per SK-ASK-001
// in `.claude/skills/ask-pipeline/SKILL.md`.

import type {
  CompileDdlResult,
  DbCreateArgs,
  DbCreateError,
  DbCreateResult,
  DdlValidationResult,
  EmbedDeps,
  InferSchemaArgs,
  InferSchemaDeps,
  InferSchemaResult,
  LLMRouter,
  PgClient,
  ProvisionFn,
  SchemaPlan,
} from "./types.ts";

export type DbCreateDeps = {
  inferSchema: (deps: InferSchemaDeps, args: InferSchemaArgs) => Promise<InferSchemaResult>;
  compileDdl: (plan: SchemaPlan, schemaName: string) => CompileDdlResult;
  validateCompiledDdl: (statements: string[]) => DdlValidationResult;
  // Per SK-HDC-007 the orchestrator takes a generic ProvisionFn so
  // Phase 1 wires `provisionDb` and Phase 4 wires `registerByoDb`
  // with no orchestrator change.
  provision: ProvisionFn;
  // pgvector writer for table-card RAG. Awaited but failure does
  // NOT roll back the provisioned DB — see step 6 below.
  embedTableCards: (deps: EmbedDeps, plan: SchemaPlan, dbId: string) => Promise<void>;
  // 6-char random for the dbId tail. Injectable so tests can
  // assert exact ids; prod uses `crypto.randomUUID().slice(...)` or
  // similar in `build-deps.ts`.
  randomSuffix: () => string;
  // Deterministic SchemaPlan fingerprint, written into the
  // `databases` row so `/v1/ask` plan-cache lookups see a stable
  // hash from the moment the DB exists.
  schemaHash: (plan: SchemaPlan) => string;
  // Forwarded to sub-modules; the orchestrator never calls
  // methods on these directly.
  llm: LLMRouter;
  pg: PgClient;
  d1: D1Database;
};

export async function orchestrateDbCreate(
  deps: DbCreateDeps,
  args: DbCreateArgs,
): Promise<DbCreateResult> {
  // 1. Infer the SchemaPlan. The LLM never emits raw DDL — only
  //    a typed JSON plan (docs/architecture.md §3.6.2 / receipts §2;
  //    SK-HDC-002). Zod validation lives inside `inferSchema`;
  //    failures surface here as `infer_failed`.
  const inferred = await deps.inferSchema(
    { llm: deps.llm },
    { goal: args.goal, ...(args.name !== undefined ? { name: args.name } : {}) },
  );
  if (!inferred.ok) {
    if (inferred.reason === "plan_invalid") {
      return err({ kind: "infer_failed", reason: "plan_invalid", details: inferred.details });
    }
    return err({ kind: "infer_failed", reason: inferred.reason });
  }
  const plan = inferred.plan;

  // 2. Mint the dbId + schema name. Format from docs/architecture.md §3.6:
  //    "db_<slug_hint>_<6-char-random>"; schema name drops the
  //    `db_` prefix (matches Worksheet C's contract).
  const suffix = deps.randomSuffix();
  const dbId = `db_${plan.slug_hint}_${suffix}`;
  const schemaName = `${plan.slug_hint}_${suffix}`;

  // 3. Deterministic compiler emits CREATE TABLE / CREATE INDEX /
  //    FK constraints. Pure function over `plan` + schemaName.
  const compiled = deps.compileDdl(plan, schemaName);
  if (!compiled.ok) {
    return err({
      kind: "compile_failed",
      reason: compiled.reason,
      ...(compiled.details !== undefined ? { details: compiled.details } : {}),
    });
  }

  // 4. libpg_query parse-validate over the compiled DDL — the
  //    second of two DDL guardrails (docs/architecture.md §3.6.5;
  //    SK-HDC-003 defense-in-depth, SK-HDC-006 read/write vs DDL
  //    split). Catches compiler bugs that smuggled a destructive
  //    verb through.
  const validation = deps.validateCompiledDdl(compiled.statements);
  if (!validation.ok) {
    return err({
      kind: "ddl_invalid",
      reason: validation.reason,
      statement: validation.statement,
    });
  }

  // 5. Transactional provisioner. Schema + role + RLS + sample
  //    rows + `databases` row + (for non-anonymous tenants)
  //    pk_live row, all in one transaction with rollback on any
  //    structural fail. SK-HDC-007 keeps this dep generic so Phase 4
  //    BYO can swap `provisionDb` for `registerByoDb` with no
  //    orchestrator change.
  const provisioned = await deps.provision(
    { pg: deps.pg, d1: deps.d1 },
    {
      plan,
      dbId,
      schemaName,
      ddl: compiled.statements,
      tenantId: args.tenantId,
      secretRef: args.secretRef,
      schemaHash: deps.schemaHash(plan),
    },
  );
  if (!provisioned.ok) {
    return err({
      kind: "provision_failed",
      reason: provisioned.reason,
      rolled_back: provisioned.rolled_back,
    });
  }

  // 6. Table-card RAG seed. Awaited so the response reflects RAG
  //    readiness, but a throw here does NOT roll back the DB —
  //    the dbId is already committed and queryable. We surface a
  //    typed `embed_failed` with the dbId so callers can retry
  //    embedding out-of-band.
  try {
    await deps.embedTableCards({ pg: deps.pg, llm: deps.llm }, plan, dbId);
  } catch {
    // Embedding errors (Workers AI / pgvector) can contain internal
    // endpoint details — keep them server-side. The dbId is still valid
    // and queryable; surface it so callers can retry embed out-of-band.
    return err({ kind: "embed_failed", dbId });
  }

  // 7. Anonymous tenants get `pkLive: null` regardless of what the
  //    provisioner returned — the route handler issues a
  //    session-scoped key separately (docs/architecture.md §3.6.4 row 1;
  //    SK-HDC-005 documents the deterministic-resolution rationale).
  const pkLive = isAnonymous(args.tenantId) ? null : provisioned.pkLive;

  return {
    ok: true,
    dbId,
    schemaName,
    pkLive,
    plan: {
      metrics: plan.metrics,
      dimensions: plan.dimensions,
      foreign_keys: plan.foreign_keys,
    },
    sampleRows: plan.sample_rows,
  };
}

function isAnonymous(tenantId: string): boolean {
  return tenantId.startsWith("anon:");
}

function err(error: DbCreateError): DbCreateResult {
  return { ok: false, error };
}
