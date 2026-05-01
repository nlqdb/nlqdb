// `/v1/ask kind=create` orchestrator. Pure function — every external
// dep is passed in. Mirrors `apps/api/src/ask/orchestrate.ts` (the
// canonical deps-injected pattern in this repo); tests construct
// stubs, the route handler builds prod deps from the request context
// (env bindings + execution ctx) — see `apps/api/src/ask/build-deps.ts`.
//
// Pipeline implements the typed-plan flow from
// [`docs/design.md §3.6.1`](../../../../docs/design.md#361-endpoint-shape) +
// [`docs/design.md §3.6.2`](../../../../docs/design.md#362-typed-plan-pipeline-the-create-path):
//
//   rate-limit → inferSchema → compileDdl → validateCompiledDdl →
//   provisionDb → embedTableCards
//
// Each layer is a separate guardrail (`docs/research-receipts.md
// §1`); the orchestrator's job is to ensure they run in order and
// short-circuit cleanly on any failure. Sub-modules own their own
// OTel spans on external calls (GLOBAL-014); the orchestrator is
// in-process and adds no external boundaries of its own.
//
// Related skill: `.claude/skills/ask-pipeline/SKILL.md` — the
// `kind=create` branch routes here from `/v1/ask` (SK-ASK-001).

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
  ProvisionDbArgs,
  ProvisionDbDeps,
  ProvisionDbResult,
  SchemaPlan,
} from "./types.ts";

export type DbCreateDeps = {
  inferSchema: (deps: InferSchemaDeps, args: InferSchemaArgs) => Promise<InferSchemaResult>;
  compileDdl: (plan: SchemaPlan, schemaName: string) => CompileDdlResult;
  validateCompiledDdl: (statements: string[]) => DdlValidationResult;
  provisionDb: (deps: ProvisionDbDeps, args: ProvisionDbArgs) => Promise<ProvisionDbResult>;
  // pgvector writer for table-card RAG. Awaited but failure does
  // NOT roll back the provisioned DB — see step 7 below.
  embedTableCards: (deps: EmbedDeps, plan: SchemaPlan, dbId: string) => Promise<void>;
  // Per-tenant key from docs/implementation.md §8 (5/hr per IP,
  // 20/day per account). The route handler decides whether the key
  // is an IP bucket or an account bucket — this orchestrator just
  // acquires.
  rateLimiter: { tryAcquire(key: string): Promise<boolean> };
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

// IPs and accounts hit different windows (per-hour vs per-day);
// surfacing a uniform retry hint avoids leaking which limit fired.
const RATE_LIMIT_RETRY_AFTER_SECONDS = 3600;

export async function orchestrateDbCreate(
  deps: DbCreateDeps,
  args: DbCreateArgs,
): Promise<DbCreateResult> {
  // 1. Rate-limit. Fail fast before any LLM spend.
  const allowed = await deps.rateLimiter.tryAcquire(`db_create:${args.tenantId}`);
  if (!allowed) {
    return err({ kind: "rate_limited", retry_after_seconds: RATE_LIMIT_RETRY_AFTER_SECONDS });
  }

  // 2. Infer the SchemaPlan. The LLM never emits raw DDL — only
  //    a typed JSON plan (docs/design.md §3.6.2 / receipts §2).
  const inferred = await deps.inferSchema(
    { llm: deps.llm },
    { goal: args.goal, ...(args.name !== undefined ? { name: args.name } : {}) },
  );
  if (!inferred.ok) {
    return err({
      kind: "infer_failed",
      reason: inferred.reason,
      ...(inferred.details !== undefined ? { details: inferred.details } : {}),
    });
  }
  const plan = inferred.plan;

  // 3. Mint the dbId + schema name. Format from docs/design.md §14.6:
  //    "db_<slug_hint>_<6-char-random>"; schema name drops the
  //    `db_` prefix (matches Worksheet C's contract).
  const suffix = deps.randomSuffix();
  const dbId = `db_${plan.slug_hint}_${suffix}`;
  const schemaName = `${plan.slug_hint}_${suffix}`;

  // 4. Deterministic compiler emits CREATE TABLE / CREATE INDEX /
  //    FK constraints. Pure function over `plan` + schemaName.
  const compiled = deps.compileDdl(plan, schemaName);
  if (!compiled.ok) {
    return err({
      kind: "compile_failed",
      reason: compiled.reason,
      ...(compiled.details !== undefined ? { details: compiled.details } : {}),
    });
  }

  // 5. libpg_query parse-validate over the compiled DDL — the
  //    second of two DDL guardrails (docs/design.md §3.6.5; see also
  //    `.claude/skills/ask-pipeline/SKILL.md` SK-ASK-004). Catches
  //    compiler bugs that smuggled a destructive verb through.
  const validation = deps.validateCompiledDdl(compiled.statements);
  if (!validation.ok) {
    return err({
      kind: "ddl_invalid",
      reason: validation.reason,
      statement: validation.statement,
    });
  }

  // 6. Transactional provisioner. Schema + role + RLS + sample
  //    rows + `databases` row + (for non-anonymous tenants)
  //    pk_live row, all in one transaction with rollback on any
  //    structural fail.
  const provisioned = await deps.provisionDb(
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

  // 7. Table-card RAG seed. Awaited so the response reflects RAG
  //    readiness, but a throw here does NOT roll back the DB —
  //    the dbId is already committed and queryable. We surface a
  //    typed `embed_failed` with the dbId so callers can retry
  //    embedding out-of-band.
  try {
    await deps.embedTableCards({ pg: deps.pg, llm: deps.llm }, plan, dbId);
  } catch (e) {
    return err({
      kind: "embed_failed",
      reason: e instanceof Error ? e.message : String(e),
      dbId,
    });
  }

  // 8. Anonymous tenants get `pkLive: null` regardless of what
  //    provisionDb returned — the route handler issues a
  //    session-scoped key separately (docs/design.md §3.6.4 row 1;
  //    SK-ASK-003 documents the deterministic-resolution rationale).
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
