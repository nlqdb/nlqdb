// Unit tests for the db.create orchestrator. All deps are passed
// as plain test stubs — no `vi.mock`, matching the
// `apps/api/test/orchestrate.test.ts` (`/v1/ask`) convention.
//
// Rate-limit cases are deliberately absent — per
// `docs/features/hosted-db-create/FEATURE.md` SK-HDC-008 the per-IP
// / per-account limiter runs in `apps/api/src/ask/classifier.ts`
// before the orchestrator is called, so a rate-limited request
// never reaches `orchestrateDbCreate`. Tests for that gate live
// alongside the classifier.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { type DbCreateDeps, orchestrateDbCreate } from "./orchestrate.ts";
import type {
  CompileDdlResult,
  DdlValidationResult,
  InferSchemaResult,
  PgClient,
  ProvisionResult,
  SchemaPlan,
} from "./types.ts";

const FIXED_SUFFIX = "a4f3b2";

function stubPlan(overrides: Partial<SchemaPlan> = {}): SchemaPlan {
  // The Zod schema in `packages/db/src/types.ts` requires
  // `description` on Table / Column / Metric / Dimension and a
  // top-level `description` on SchemaPlan — SK-HDC-004 puts the
  // semantic-layer-at-create-time moat on these fields, so leaving
  // them empty would defeat the purpose. Tests carry plausible
  // values to mirror the production contract.
  return {
    slug_hint: "orders_tracker",
    description: "fixture orders tracker for orchestrator tests",
    tables: [
      {
        name: "orders",
        description: "Order line items the orchestrator test exercises.",
        primary_key: ["id"],
        columns: [
          {
            name: "id",
            type: "uuid",
            nullable: false,
            description: "Primary key for an order.",
          },
          {
            name: "total_cents",
            type: "integer",
            nullable: false,
            description: "Total order amount in minor units (cents).",
          },
        ],
      },
    ],
    foreign_keys: [],
    metrics: [
      {
        name: "order_count",
        description: "Total number of orders in the period.",
        agg: "count",
        expression: "*",
      },
    ],
    dimensions: [
      {
        name: "order_id",
        description: "Per-order identifier dimension.",
        table: "orders",
        column: "id",
      },
    ],
    sample_rows: [
      { table: "orders", values: { id: "00000000-0000-0000-0000-000000000001", total_cents: 999 } },
    ],
    ...overrides,
  };
}

function stubInferSchema(result?: InferSchemaResult) {
  return vi.fn(async (): Promise<InferSchemaResult> => result ?? { ok: true, plan: stubPlan(), model: "fake-model", confidence: 1.0 });
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

function stubProvision(result?: ProvisionResult) {
  return vi.fn(
    async (
      _deps: unknown,
      args: { dbId: string; schemaName: string; tenantId: string },
    ): Promise<ProvisionResult> =>
      result ?? {
        ok: true,
        dbId: args.dbId,
        schemaName: args.schemaName,
      },
  );
}

function stubEmbedTableCards(impl?: () => Promise<void>) {
  return vi.fn(async () => {
    if (impl) await impl();
  });
}

function stubClassifyEngine(
  result: {
    engine: "postgres" | "clickhouse";
    confidence: number;
    fallbackReason?: import("./engine-classify.ts").EngineFallbackReason | null;
  } = {
    engine: "postgres",
    confidence: 0.9,
  },
) {
  // Default `fallbackReason` to `null` (LLM pick used) so callers can
  // omit the field; tests that exercise the fallback paths can set it
  // explicitly when they want to assert the dashboard-side signal.
  return vi.fn(async () => ({
    ...result,
    fallbackReason: result.fallbackReason ?? null,
  }));
}

function makeDeps(overrides: Partial<DbCreateDeps> = {}): DbCreateDeps {
  return {
    inferSchema: stubInferSchema(),
    compileDdl: stubCompileDdl(),
    validateCompiledDdl: stubValidateCompiledDdl(),
    classifyEngine: stubClassifyEngine(),
    provision: stubProvision(),
    embedTableCards: stubEmbedTableCards(),
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
        return { ok: true, plan: stubPlan(), model: "fake-model", confidence: 1.0 };
      }),
      compileDdl: vi.fn((): CompileDdlResult => {
        calls.push("compileDdl");
        return { ok: true, statements: ["CREATE SCHEMA s", "CREATE TABLE s.orders ()"] };
      }),
      validateCompiledDdl: vi.fn((): DdlValidationResult => {
        calls.push("validateCompiledDdl");
        return { ok: true };
      }),
      provision: vi.fn(async (_d, args): Promise<ProvisionResult> => {
        calls.push("provision");
        return { ok: true, dbId: args.dbId, schemaName: args.schemaName };
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
      engine: "postgres",
      pkLive: null,
      // SK-TRUST-002 — the DDL + inferring model surface on the ok
      // result so the route can build the create trace block.
      ddl: ["CREATE SCHEMA s", "CREATE TABLE s.orders ()"],
      model: "fake-model",
      confidence: 1.0,
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
      "provision",
      "embedTableCards",
    ]);
  });

  it("inferSchema {ok:false, reason:'ambiguous_goal'} surfaces infer_failed and skips downstream", async () => {
    const compileDdl = stubCompileDdl();
    const provision = stubProvision();
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      inferSchema: stubInferSchema({
        ok: false,
        reason: "ambiguous_goal",
      }),
      compileDdl,
      provision,
      embedTableCards,
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out).toEqual({
      ok: false,
      error: {
        kind: "infer_failed",
        reason: "ambiguous_goal",
      },
    });
    expect(compileDdl).not.toHaveBeenCalled();
    expect(provision).not.toHaveBeenCalled();
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("compileDdl {ok:false} surfaces compile_failed and skips provision/embed", async () => {
    const provision = stubProvision();
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      compileDdl: stubCompileDdl({
        ok: false,
        reason: "duplicate_identifier",
        details: { table: "orders" },
      }),
      provision,
      embedTableCards,
    });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out).toEqual({
      ok: false,
      error: {
        kind: "compile_failed",
        reason: "duplicate_identifier",
        details: { table: "orders" },
      },
    });
    expect(provision).not.toHaveBeenCalled();
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("validateCompiledDdl {ok:false} surfaces ddl_invalid and skips provision", async () => {
    const provision = stubProvision();
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      validateCompiledDdl: stubValidateCompiledDdl({
        ok: false,
        reason: "destructive_verb",
        statement: "DROP TABLE orders",
      }),
      provision,
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
    expect(provision).not.toHaveBeenCalled();
    expect(embedTableCards).not.toHaveBeenCalled();
  });

  it("provision {ok:false} surfaces provision_failed and skips embed", async () => {
    const embedTableCards = stubEmbedTableCards();

    const deps = makeDeps({
      provision: stubProvision({
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

  it("embedTableCards throwing returns embed_failed but provision did succeed (dbId surfaced)", async () => {
    const provision = stubProvision();
    const embedTableCards = stubEmbedTableCards(async () => {
      throw new Error("pgvector down");
    });

    const deps = makeDeps({ provision, embedTableCards });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(provision).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error.kind).toBe("embed_failed");
    if (out.error.kind !== "embed_failed") throw new Error("narrow");
    expect(out.error.dbId).toBe(`db_orders_tracker_${FIXED_SUFFIX}`);
    // The embed error message can include internal endpoint URLs and is
    // stripped at the boundary (GLOBAL-012); only the OTel span on the
    // embed call retains it. Asserting absence locks the contract.
    expect(out.error).not.toHaveProperty("reason");
  });

  it("SK-HDC-013: when waitUntil is provided, embed + recent-tables tail-fire off-path", async () => {
    // Slow embed that would block ~50ms if awaited. With waitUntil
    // injected the orchestrator must NOT block on it — the response
    // returns immediately and the embed runs against the lifetime
    // collected by the test.
    const embedStarted = { value: false };
    const embedDone = { value: false };
    const embedTableCards = stubEmbedTableCards(async () => {
      embedStarted.value = true;
      await new Promise((r) => setTimeout(r, 50));
      embedDone.value = true;
    });
    const touchStarted = { value: false };
    const touchDone = { value: false };
    const recentTables = {
      touch: vi.fn(async () => {
        touchStarted.value = true;
        await new Promise((r) => setTimeout(r, 50));
        touchDone.value = true;
      }),
      // load is unused by the orchestrator (the route handler reads
      // recent tables; the orchestrator only writes). Stub returns
      // empty to satisfy the type checker.
      load: vi.fn(async () => []),
    };
    const collected: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => {
      collected.push(p);
    };
    const deps = makeDeps({ embedTableCards, recentTables, waitUntil });

    const t0 = Date.now();
    const out = await orchestrateDbCreate(deps, ARGS);
    const elapsed = Date.now() - t0;

    expect(out.ok).toBe(true);
    // Response came back before tail steps finished (otherwise we'd be
    // at >= 100ms). Generous threshold to avoid CI flake.
    expect(elapsed).toBeLessThan(45);
    expect(embedStarted.value).toBe(true);
    expect(embedDone.value).toBe(false);
    expect(touchStarted.value).toBe(true);
    expect(touchDone.value).toBe(false);
    // waitUntil received 2 promises — one for embed, one for touch.
    expect(collected).toHaveLength(2);
    // Drain so the test isolate doesn't leak pending timers.
    await Promise.all(collected);
    expect(embedDone.value).toBe(true);
    expect(touchDone.value).toBe(true);
  });

  it("SK-HDC-013: embed failure in waitUntil path does NOT surface embed_failed (response is 200)", async () => {
    // With waitUntil, the response already shipped before embed
    // settled — the typed embed_failed envelope is only available on
    // the inline-await path. The orchestrator must swallow the throw
    // and return ok.
    const embedTableCards = stubEmbedTableCards(async () => {
      throw new Error("pgvector down");
    });
    const collected: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => {
      collected.push(p);
    };
    const deps = makeDeps({ embedTableCards, waitUntil });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out.ok).toBe(true);
    // Drain the tail so the swallowed throw doesn't leak as an
    // unhandled rejection in subsequent tests.
    await Promise.all(collected.map((p) => p.catch(() => undefined)));
  });

  it("pkLive: null when mintPkLive dep is absent (unit tests don't stub it)", async () => {
    const deps = makeDeps();

    const out = await orchestrateDbCreate(deps, { ...ARGS, tenantId: "anon:abc123" });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.pkLive).toBeNull();
  });

  it("mintPkLive dep is called and returned in pkLive for any tenant", async () => {
    const mintPkLive = vi.fn(async (dbId: string) => `pk_live_${dbId}_minted`);
    const deps = makeDeps({ mintPkLive });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(mintPkLive).toHaveBeenCalledWith(`db_orders_tracker_${FIXED_SUFFIX}`, ARGS.tenantId);
    expect(out.pkLive).toBe(`pk_live_db_orders_tracker_${FIXED_SUFFIX}_minted`);
  });

  it("default path: classifier picks engine and orchestrator forwards it to provision (SK-DB-010)", async () => {
    const classifyEngine = stubClassifyEngine({ engine: "clickhouse", confidence: 0.85 });
    const provision = stubProvision();
    const deps = makeDeps({ classifyEngine, provision });

    const out = await orchestrateDbCreate(deps, ARGS);

    expect(classifyEngine).toHaveBeenCalledTimes(1);
    expect(classifyEngine).toHaveBeenCalledWith({ llm: deps.llm }, ARGS.goal);
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.engine).toBe("clickhouse");
    const provisionArgs = (provision.mock.calls[0]?.[1] ?? {}) as { engine?: string };
    expect(provisionArgs.engine).toBe("clickhouse");
  });

  it("explicit args.engine override skips the classifier LLM call (SK-DB-010 power-user path)", async () => {
    const classifyEngine = stubClassifyEngine({ engine: "clickhouse", confidence: 0.85 });
    const provision = stubProvision();
    const deps = makeDeps({ classifyEngine, provision });

    const out = await orchestrateDbCreate(deps, { ...ARGS, engine: "postgres" });

    // The no-mock-call assertion is the testable contract from the
    // worksheet: explicit override must not spend a classifier LLM call.
    expect(classifyEngine).not.toHaveBeenCalled();
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.engine).toBe("postgres");
    const provisionArgs = (provision.mock.calls[0]?.[1] ?? {}) as { engine?: string };
    expect(provisionArgs.engine).toBe("postgres");
  });

  it("explicit clickhouse override: skips classifier and threads engine through to provisioner", async () => {
    const classifyEngine = stubClassifyEngine();
    const provision = stubProvision();
    const deps = makeDeps({ classifyEngine, provision });

    const out = await orchestrateDbCreate(deps, { ...ARGS, engine: "clickhouse" });

    expect(classifyEngine).not.toHaveBeenCalled();
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.engine).toBe("clickhouse");
    const provisionArgs = (provision.mock.calls[0]?.[1] ?? {}) as { engine?: string };
    expect(provisionArgs.engine).toBe("clickhouse");
  });

  it("retries with a fresh randomSuffix on schema_already_exists, succeeding on the 2nd attempt (SK-HDC-012)", async () => {
    // SK-HDC-012 dropped the in-band populated guard; a true 6-hex
    // collision (~1 in 16M) surfaces as `schema_already_exists` from
    // the provisioner. The orchestrator regenerates the suffix and
    // retries, bounded to 3 attempts.
    const seenIds: string[] = [];
    const provision = vi.fn(async (_d, args): Promise<ProvisionResult> => {
      seenIds.push(args.dbId);
      if (seenIds.length === 1) {
        return { ok: false, reason: "schema_already_exists", rolled_back: true };
      }
      return { ok: true, dbId: args.dbId, schemaName: args.schemaName };
    });
    const suffixes = ["aaaaaa", "bbbbbb", "cccccc"];
    let suffixIdx = 0;
    const randomSuffix = vi.fn(() => suffixes[suffixIdx++] ?? "zzzzzz");

    const deps = makeDeps({ provision, randomSuffix });
    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(provision).toHaveBeenCalledTimes(2);
    expect(seenIds).toEqual(["db_orders_tracker_aaaaaa", "db_orders_tracker_bbbbbb"]);
    // Final dbId reflects the second-attempt suffix.
    expect(out.dbId).toBe("db_orders_tracker_bbbbbb");
    expect(out.schemaName).toBe("orders_tracker_bbbbbb");
  });

  it("gives up after 3 schema_already_exists attempts and surfaces provision_failed", async () => {
    const provision = vi.fn(
      async (): Promise<ProvisionResult> => ({
        ok: false,
        reason: "schema_already_exists",
        rolled_back: true,
      }),
    );
    const randomSuffix = vi.fn(() => "deadbe");

    const deps = makeDeps({ provision, randomSuffix });
    const out = await orchestrateDbCreate(deps, ARGS);

    expect(provision).toHaveBeenCalledTimes(3);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error).toEqual({
      kind: "provision_failed",
      reason: "schema_already_exists",
      rolled_back: true,
    });
  });

  it("SK-HDC-018: retries once WITHOUT sample rows on sample_insert_failed, returning a committed DB with an empty seed set", async () => {
    // A single LLM-authored sample row that violates its own schema
    // (FK / NOT NULL / type → SQLSTATE 22/23 → `sample_insert_failed`)
    // must not 500 the create. The orchestrator retries without seed
    // data so the schema-complete DB still commits.
    const provision = vi.fn(async (_d, args): Promise<ProvisionResult> => {
      const callArgs = args as unknown as { plan: SchemaPlan; dbId: string; schemaName: string };
      if (callArgs.plan.sample_rows.length > 0) {
        return { ok: false, reason: "sample_insert_failed", rolled_back: true };
      }
      return { ok: true, dbId: callArgs.dbId, schemaName: callArgs.schemaName };
    });

    const deps = makeDeps({ provision });
    const out = await orchestrateDbCreate(deps, ARGS);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(provision).toHaveBeenCalledTimes(2);
    // Same ids reused on the strip-retry (rolled-back schema is free) so
    // the compiled DDL still matches the schema name.
    expect(out.dbId).toBe(`db_orders_tracker_${FIXED_SUFFIX}`);
    // Second attempt was handed a sample-free plan…
    const secondArgs = provision.mock.calls[1]?.[1] as unknown as { plan: SchemaPlan };
    expect(secondArgs.plan.sample_rows).toEqual([]);
    // …and the response reports the actually-inserted (empty) seed set,
    // never the original rows the DB doesn't hold.
    expect(out.sampleRows).toEqual([]);
  });

  it("SK-HDC-018: a second sample_insert_failed surfaces provision_failed (no infinite retry)", async () => {
    const provision = vi.fn(
      async (): Promise<ProvisionResult> => ({
        ok: false,
        reason: "sample_insert_failed",
        rolled_back: true,
      }),
    );

    const deps = makeDeps({ provision });
    const out = await orchestrateDbCreate(deps, ARGS);

    // One attempt with seed data, one without; then give up.
    expect(provision).toHaveBeenCalledTimes(2);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error).toEqual({
      kind: "provision_failed",
      reason: "sample_insert_failed",
      rolled_back: true,
    });
  });

  it("does not retry on non-collision provision failures", async () => {
    const provision = vi.fn(
      async (): Promise<ProvisionResult> => ({
        ok: false,
        reason: "ddl_execution_failed",
        rolled_back: true,
      }),
    );

    const deps = makeDeps({ provision });
    const out = await orchestrateDbCreate(deps, ARGS);

    expect(provision).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error).toEqual({
      kind: "provision_failed",
      reason: "ddl_execution_failed",
      rolled_back: true,
    });
  });

  it("forwards args.name to inferSchema and schemaHash(plan) to provision", async () => {
    const inferSchema = stubInferSchema();
    const provision = stubProvision();
    const schemaHash = vi.fn(() => "deterministic_hash");

    const deps = makeDeps({ inferSchema, provision, schemaHash });

    await orchestrateDbCreate(deps, { ...ARGS, name: "my coffee shop" });

    expect(inferSchema).toHaveBeenCalledWith(
      { llm: deps.llm },
      { goal: ARGS.goal, name: "my coffee shop" },
    );
    expect(schemaHash).toHaveBeenCalledTimes(1);
    expect(provision).toHaveBeenCalledTimes(1);
    const provisionArgs = provision.mock.calls[0]?.[1] as
      | { schemaHash: string; secretRef: string; tenantId: string }
      | undefined;
    expect(provisionArgs?.schemaHash).toBe("deterministic_hash");
    expect(provisionArgs?.secretRef).toBe(ARGS.secretRef);
    expect(provisionArgs?.tenantId).toBe(ARGS.tenantId);
  });

  // SK-HDC-020 — the agent-memory preset path. The LLM is bypassed
  // entirely; the deterministic preset DDL still flows through
  // validateCompiledDdl + provision (defense-in-depth preserved).
  describe("preset path (SK-HDC-020)", () => {
    const PRESET_ARGS = {
      goal: "",
      tenantId: "user_1",
      secretRef: "DATABASE_URL",
      preset: "agent_memory_v1" as const,
    };

    it("provisions agent_memory_v1 without calling inferSchema/compileDdl/classifyEngine", async () => {
      const inferSchema = stubInferSchema();
      const compileDdl = stubCompileDdl();
      const classifyEngine = stubClassifyEngine();
      const validateCompiledDdl = stubValidateCompiledDdl();
      const provision = stubProvision();
      const deps = makeDeps({
        inferSchema,
        compileDdl,
        classifyEngine,
        validateCompiledDdl,
        provision,
      });

      const out = await orchestrateDbCreate(deps, PRESET_ARGS);

      expect(out.ok).toBe(true);
      // LLM-backed stages are skipped on the preset path.
      expect(inferSchema).not.toHaveBeenCalled();
      expect(compileDdl).not.toHaveBeenCalled();
      expect(classifyEngine).not.toHaveBeenCalled();
      // Defense-in-depth: the hand-authored DDL is still validated + provisioned.
      expect(validateCompiledDdl).toHaveBeenCalledTimes(1);
      expect(provision).toHaveBeenCalledTimes(1);

      if (!out.ok) throw new Error("expected ok");
      expect(out.engine).toBe("postgres");
      // SK-TRUST-002 — no LLM ran; the trace model slot names the preset.
      expect(out.model).toBe("preset:agent_memory_v1");
      expect(out.dbId).toBe(`db_agent_memory_v1_${FIXED_SUFFIX}`);
      expect(out.schemaName).toBe(`agent_memory_v1_${FIXED_SUFFIX}`);
      // No seed/semantic data on the preset path.
      expect(out.sampleRows).toEqual([]);
      expect(out.plan.metrics).toEqual([]);
      expect(out.plan.foreign_keys).toHaveLength(2);
    });

    it("hands the four-table preset DDL (schema-qualified) to the provisioner", async () => {
      const provision = stubProvision();
      const deps = makeDeps({ provision });

      await orchestrateDbCreate(deps, PRESET_ARGS);

      const provisionArgs = provision.mock.calls[0]?.[1] as
        | { ddl: string[]; schemaText: string; schemaName: string; engine: string }
        | undefined;
      const schema = `agent_memory_v1_${FIXED_SUFFIX}`;
      for (const table of ["facts", "episodes", "entities", "entity_facts"]) {
        expect(
          provisionArgs?.ddl.some((s) => s.includes(`CREATE TABLE "${schema}"."${table}"`)),
        ).toBe(true);
      }
      expect(provisionArgs?.schemaText).toContain(`"${schema}"."facts"`);
      expect(provisionArgs?.engine).toBe("postgres");
    });

    it("re-derives the schema-qualified DDL on a collision retry", async () => {
      const suffixes = ["aaa111", "bbb222"];
      let i = 0;
      const randomSuffix = vi.fn(() => suffixes[i++] ?? "zzz999");
      const provision = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, reason: "schema_already_exists", rolled_back: false })
        .mockImplementationOnce(async (_d, args) => ({
          ok: true,
          dbId: args.dbId,
          schemaName: args.schemaName,
        }));
      const deps = makeDeps({ randomSuffix, provision });

      const out = await orchestrateDbCreate(deps, PRESET_ARGS);

      expect(out.ok).toBe(true);
      // Second attempt re-mints the suffix AND re-qualifies the DDL to it.
      const secondArgs = provision.mock.calls[1]?.[1] as { ddl: string[] } | undefined;
      expect(secondArgs?.ddl.some((s) => s.includes(`"agent_memory_v1_bbb222"."facts"`))).toBe(
        true,
      );
    });
  });
});
