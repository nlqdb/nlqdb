// Unit tests for the db.create orchestrator. All deps are passed
// as plain test stubs — no `vi.mock`, matching the
// `apps/api/test/orchestrate.test.ts` (`/v1/ask`) convention.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { type DbCreateDeps, orchestrateDbCreate } from "./orchestrate.ts";
import type {
  CompileDdlResult,
  DdlValidationResult,
  InferSchemaResult,
  PgClient,
  ProvisionDbResult,
  SchemaPlan,
} from "./types.ts";

const FIXED_SUFFIX = "a4f3b2";

function stubPlan(overrides: Partial<SchemaPlan> = {}): SchemaPlan {
  return {
    slug_hint: "orders_tracker",
    name: "orders tracker",
    tables: [
      {
        name: "orders",
        primary_key: ["id"],
        columns: [
          { name: "id", type: "uuid", nullable: false },
          { name: "total_cents", type: "integer", nullable: false },
        ],
      },
    ],
    foreign_keys: [],
    metrics: [{ name: "order_count", expression: "count(*)" }],
    dimensions: [{ name: "order_id", column: "orders.id" }],
    sample_rows: [
      { table: "orders", values: { id: "00000000-0000-0000-0000-000000000001", total_cents: 999 } },
    ],
    ...overrides,
  };
}

function stubInferSchema(result?: InferSchemaResult) {
  return vi.fn(async (): Promise<InferSchemaResult> => result ?? { ok: true, plan: stubPlan() });
}

function stubCompileDdl(result?: CompileDdlResult) {
  return vi.fn(
    (): CompileDdlResult =>
      result ?? { ok: true, statements: ["CREATE SCHEMA foo", "CREATE TABLE foo.orders ()"] },
  );
}

function stubValidateCompiledDdl(result?: DdlValidationResult) {
  return vi.fn((): DdlValidationResult => result ?? { ok: true });
}

function stubProvisionDb(result?: ProvisionDbResult) {
  return vi.fn(
    async (
      _deps: unknown,
      args: { dbId: string; schemaName: string; tenantId: string },
    ): Promise<ProvisionDbResult> =>
      result ?? {
        ok: true,
        dbId: args.dbId,
        schemaName: args.schemaName,
        pkLive: `pk_live_${args.dbId}_secret`,
      },
  );
}

function stubEmbedTableCards(impl?: () => Promise<void>) {
  return vi.fn(async () => {
    if (impl) await impl();
  });
}

function stubRateLimiter(allowed = true) {
  return { tryAcquire: vi.fn(async () => allowed) };
}

function makeDeps(overrides: Partial<DbCreateDeps> = {}): DbCreateDeps {
  return {
    inferSchema: stubInferSchema(),
    compileDdl: stubCompileDdl(),
    validateCompiledDdl: stubValidateCompiledDdl(),
    provisionDb: stubProvisionDb(),
    embedTableCards: stubEmbedTableCards(),
    rateLimiter: stubRateLimiter(),
    randomSuffix: () => FIXED_SUFFIX,
    schemaHash: () => "schema_hash_v1",
    llm: {} as LLMRouter,
    pg: {} as PgClient,
    d1: {} as D1Database,
    ...overrides,
  };
}

const ARGS = {
  goal: "an orders tracker for my coffee shop",
  tenantId: "user_1",
  secretRef: "DATABASE_URL",
};

describe("orchestrateDbCreate", () => {
  it("happy path: returns ok with the expected dbId and runs sub-modules in order", async () => {
    const calls: string[] = [];
    const deps = makeDeps({
      inferSchema: vi.fn(async (): Promise<InferSchemaResult> => {
        calls.push("inferSchema");
        return { ok: true, plan: stubPlan() };
      }),
      compileDdl: vi.fn((): CompileDdlResult => {
        calls.push("compileDdl");
        return { ok: true, statements: ["CREATE SCHEMA s", "CREATE TABLE s.orders ()"] };
      }),
      validateCompiledDdl: vi.fn((): DdlValidationResult => {
        calls.push("validateCompiledDdl");
        return { ok: true };
      }),
      provisionDb: vi.fn(async (_d, args): Promise<ProvisionDbResult> => {
        calls.push("provisionDb");
        return {
          ok: true,
          dbId: args.dbId,
          schemaName: args.schemaName,
          pkLive: `pk_live_${args.dbId}_secret`,
        };
      }),
      embedTableCards: vi.fn(async () => {
        calls.push("embedTableCards");
      }),
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out).toEqual({
      ok: true,
      dbId: `db_orders_tracker_${FIXED_SUFFIX}`,
      schemaName: `orders_tracker_${FIXED_SUFFIX}`,
      pkLive: `pk_live_db_orders_tracker_${FIXED_SUFFIX}_secret`,
      plan: {
        metrics: stubPlan().metrics,
        dimensions: stubPlan().dimensions,
        foreign_keys: stubPlan().foreign_keys,
      },
      sampleRows: stubPlan().sample_rows,
    });
    expect(calls).toEqual([
      "inferSchema",
      "compileDdl",
      "validateCompiledDdl",
      "provisionDb",
      "embedTableCards",
    ]);
  });

  it("rate-limit reject short-circuits before any sub-module runs", async () => {
    const inferSchema = stubInferSchema();
    const compileDdl = stubCompileDdl();
    const validateCompiledDdl = stubValidateCompiledDdl();
    const provisionDb = stubProvisionDb();
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      rateLimiter: stubRateLimiter(false),
      inferSchema,
      compileDdl,
      validateCompiledDdl,
      provisionDb,
      embedTableCards,
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error.kind).toBe("rate_limited");
    if (out.error.kind !== "rate_limited") throw new Error("narrow");
    expect(out.error.retry_after_seconds).toBeGreaterThan(0);

    expect(inferSchema).not.toHaveBeenCalled();
    expect(compileDdl).not.toHaveBeenCalled();
    expect(validateCompiledDdl).not.toHaveBeenCalled();
    expect(provisionDb).not.toHaveBeenCalled();
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("rate-limiter is keyed by tenantId", async () => {
    const tryAcquire = vi.fn(async () => true);
    const deps = makeDeps({ rateLimiter: { tryAcquire } });
    await orchestrateDbCreate(deps, { ...ARGS, tenantId: "user_42" });
    expect(tryAcquire).toHaveBeenCalledWith("db_create:user_42");
  });

  it("inferSchema {ok:false, reason:'ambiguous_goal'} surfaces infer_failed and skips downstream", async () => {
    const compileDdl = stubCompileDdl();
    const provisionDb = stubProvisionDb();
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      inferSchema: stubInferSchema({
        ok: false,
        reason: "ambiguous_goal",
        details: { hint: "specify a domain" },
      }),
      compileDdl,
      provisionDb,
      embedTableCards,
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out).toEqual({
      ok: false,
      error: {
        kind: "infer_failed",
        reason: "ambiguous_goal",
        details: { hint: "specify a domain" },
      },
    });
    expect(compileDdl).not.toHaveBeenCalled();
    expect(provisionDb).not.toHaveBeenCalled();
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("compileDdl {ok:false} surfaces compile_failed and skips provision/embed", async () => {
    const provisionDb = stubProvisionDb();
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      compileDdl: stubCompileDdl({
        ok: false,
        reason: "identifier_collision",
        details: { table: "orders" },
      }),
      provisionDb,
      embedTableCards,
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out).toEqual({
      ok: false,
      error: {
        kind: "compile_failed",
        reason: "identifier_collision",
        details: { table: "orders" },
      },
    });
    expect(provisionDb).not.toHaveBeenCalled();
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("validateCompiledDdl {ok:false} surfaces ddl_invalid and skips provision", async () => {
    const provisionDb = stubProvisionDb();
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      validateCompiledDdl: stubValidateCompiledDdl({
        ok: false,
        reason: "destructive_verb",
        statement: "DROP TABLE orders",
      }),
      provisionDb,
      embedTableCards,
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out).toEqual({
      ok: false,
      error: {
        kind: "ddl_invalid",
        reason: "destructive_verb",
        statement: "DROP TABLE orders",
      },
    });
    expect(provisionDb).not.toHaveBeenCalled();
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("provisionDb {ok:false} surfaces provision_failed and skips embed", async () => {
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      provisionDb: stubProvisionDb({
        ok: false,
        reason: "ddl_execution_failed",
        rolled_back: true,
      }),
      embedTableCards,
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out).toEqual({
      ok: false,
      error: {
        kind: "provision_failed",
        reason: "ddl_execution_failed",
        rolled_back: true,
      },
    });
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("embedTableCards throwing returns embed_failed but provisionDb did succeed (dbId surfaced)", async () => {
    const provisionDb = stubProvisionDb();
    const embedTableCards = stubEmbedTableCards(async () => {
      throw new Error("pgvector down");
    });

    const deps = makeDeps({ provisionDb, embedTableCards });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(provisionDb).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error.kind).toBe("embed_failed");
    if (out.error.kind !== "embed_failed") throw new Error("narrow");
    expect(out.error.dbId).toBe(`db_orders_tracker_${FIXED_SUFFIX}`);
    expect(out.error.reason).toContain("pgvector down");
  });

  it("anonymous tenantId yields pkLive: null with all other fields populated", async () => {
    const deps = makeDeps({
      provisionDb: stubProvisionDb({
        ok: true,
        // Even if a stub provisioner returned a pkLive, the
        // orchestrator must override to null for anon tenants.
        dbId: `db_orders_tracker_${FIXED_SUFFIX}`,
        schemaName: `orders_tracker_${FIXED_SUFFIX}`,
        pkLive: "pk_live_should_be_overridden",
      }),
    });

    const out = await orchestrateDbCreate(deps, { ...ARGS, tenantId: "anon:abc123" });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.pkLive).toBeNull();
    expect(out.dbId).toBe(`db_orders_tracker_${FIXED_SUFFIX}`);
    expect(out.schemaName).toBe(`orders_tracker_${FIXED_SUFFIX}`);
    expect(out.plan.metrics).toEqual(stubPlan().metrics);
    expect(out.sampleRows).toEqual(stubPlan().sample_rows);
  });

  it("forwards args.name to inferSchema and schemaHash(plan) to provisionDb", async () => {
    const inferSchema = stubInferSchema();
    const provisionDb = stubProvisionDb();
    const schemaHash = vi.fn(() => "deterministic_hash");

    const deps = makeDeps({ inferSchema, provisionDb, schemaHash });

    await orchestrateDbCreate(deps, { ...ARGS, name: "my coffee shop" });

    expect(inferSchema).toHaveBeenCalledWith(
      { llm: deps.llm },
      { goal: ARGS.goal, name: "my coffee shop" },
    );
    expect(schemaHash).toHaveBeenCalledTimes(1);
    expect(provisionDb).toHaveBeenCalledTimes(1);
    const provisionArgs = provisionDb.mock.calls[0]?.[1] as
      | { schemaHash: string; secretRef: string; tenantId: string }
      | undefined;
    expect(provisionArgs?.schemaHash).toBe("deterministic_hash");
    expect(provisionArgs?.secretRef).toBe(ARGS.secretRef);
    expect(provisionArgs?.tenantId).toBe(ARGS.tenantId);
  });
});
