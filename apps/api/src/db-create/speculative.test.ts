// SK-ASK-011 — speculative create handle + rollback. Tests cover:
//   • commit (no rollback) returns the create result.
//   • rollback runs DROP SCHEMA + DELETE FROM databases.
//   • rollback awaits an in-flight create (no mid-create abort).
//   • create-failed paths skip the DROP/DELETE work.
//   • rollback is idempotent (second call no-ops).
//   • idempotency-store delete is wired when the dep is present.

import type { LLMRouter } from "@nlqdb/llm";
import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DbCreateDeps } from "./orchestrate.ts";
import {
  type IdempotencyStore,
  type SpeculativeArgs,
  startSpeculativeCreate,
} from "./speculative.ts";
import type { CompileDdlResult, PgClient, ProvisionResult, SchemaPlan } from "./types.ts";

const FIXED_SUFFIX = "a4f3b2";

function stubPlan(): SchemaPlan {
  return {
    slug_hint: "orders_tracker",
    description: "speculative test fixture",
    tables: [
      {
        name: "orders",
        description: "Orders table.",
        primary_key: ["id"],
        columns: [
          { name: "id", type: "uuid", nullable: false, description: "PK." },
          { name: "total", type: "integer", nullable: false, description: "Cents." },
        ],
      },
    ],
    foreign_keys: [],
    metrics: [{ name: "order_count", description: "Count.", agg: "count", expression: "*" }],
    dimensions: [{ name: "id", description: "Per-order id.", table: "orders", column: "id" }],
    sample_rows: [{ table: "orders", values: { id: "00000000-0000-0000-0000-000000000001" } }],
  };
}

type PgStub = {
  pg: PgClient;
  calls: { sql: string; params?: unknown[] }[];
};
function makePgStub(): PgStub {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    return { rows: [] as Record<string, unknown>[], rowCount: 0 };
  }) as unknown as PgClient["query"];
  return { pg: { query }, calls };
}

type D1Stub = {
  d1: D1Database;
  deletes: { sql: string; params: unknown[] }[];
};
function makeD1Stub(): D1Stub {
  const deletes: { sql: string; params: unknown[] }[] = [];
  const prepare = vi.fn((sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      first: async () => null,
      run: async () => {
        if (sql.includes("DELETE FROM databases")) {
          deletes.push({ sql, params: [...bound] });
        }
        return { success: true, meta: {} };
      },
    };
    return stmt;
  });
  return { d1: { prepare } as unknown as D1Database, deletes };
}

function makeDeps(overrides: Partial<DbCreateDeps & { idempotencyStore?: IdempotencyStore }> = {}) {
  const pg = makePgStub();
  const d1 = makeD1Stub();
  return {
    pg,
    d1,
    deps: {
      inferSchema: vi.fn(async () => ({ ok: true as const, plan: stubPlan() })),
      compileDdl: vi.fn(
        (): CompileDdlResult => ({ ok: true, statements: ["CREATE TABLE orders (id INT)"] }),
      ),
      validateCompiledDdl: vi.fn(() => ({ ok: true as const })),
      classifyEngine: vi.fn(async () => ({
        engine: "postgres" as const,
        confidence: 0.9,
        fallbackReason: null,
      })),
      provision: vi.fn(
        async (
          _d: unknown,
          args: { dbId: string; schemaName: string },
        ): Promise<ProvisionResult> => ({
          ok: true,
          dbId: args.dbId,
          schemaName: args.schemaName,
          pkLive: null,
        }),
      ),
      embedTableCards: vi.fn(async () => {}),
      randomSuffix: () => FIXED_SUFFIX,
      schemaHash: () => "schema_v1",
      llm: {} as LLMRouter,
      pg: pg.pg,
      d1: d1.d1,
      ...overrides,
    },
  };
}

const ARGS: SpeculativeArgs = {
  goal: "an orders tracker for my coffee shop",
  tenantId: "user_42",
  secretRef: "DATABASE_URL",
  principalId: "user_42",
  principalKind: "user",
};

let telemetry: TestTelemetry;
beforeEach(() => {
  telemetry = createTestTelemetry();
});
afterEach(() => {
  telemetry.reset();
});

describe("startSpeculativeCreate — commit (no rollback)", () => {
  it("returns the create result; no DROP/DELETE work runs", async () => {
    const { deps, pg, d1 } = makeDeps();
    const handle = startSpeculativeCreate(deps, ARGS);
    const out = await handle.result;
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.dbId).toBe(`db_orders_tracker_${FIXED_SUFFIX}`);
    }
    expect(pg.calls.some((c) => /DROP SCHEMA/.test(c.sql))).toBe(false);
    expect(d1.deletes).toHaveLength(0);
  });

  it("emits the start span with principal_kind label", async () => {
    const { deps } = makeDeps();
    const handle = startSpeculativeCreate(deps, { ...ARGS, principalKind: "anon" });
    await handle.result;
    const startSpan = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.name === "nlqdb.create.speculative.start");
    expect(startSpan).toBeDefined();
    expect(startSpan?.attributes["nlqdb.principal_kind"]).toBe("anon");
  });
});

describe("startSpeculativeCreate — rollback (commit succeeded)", () => {
  it("DROP SCHEMA + DELETE FROM databases via dropSchemaAndRegistry", async () => {
    const { deps, pg, d1 } = makeDeps();
    const handle = startSpeculativeCreate(deps, ARGS);
    await handle.result;
    await handle.rollback();

    expect(pg.calls.some((c) => /DROP SCHEMA "orders_tracker_a4f3b2" CASCADE/.test(c.sql))).toBe(
      true,
    );
    expect(d1.deletes).toHaveLength(1);
    expect(d1.deletes[0]?.params).toEqual([`db_orders_tracker_${FIXED_SUFFIX}`]);
  });

  it("evicts the dedupe entry when idempotencyStore + key are present", async () => {
    const idempotencyStore: IdempotencyStore = {
      delete: vi.fn(async () => {}),
    };
    const { deps } = makeDeps({ idempotencyStore });
    const handle = startSpeculativeCreate(deps, ARGS);
    await handle.result;
    await handle.rollback({ idempotencyKey: "key_xyz" });

    expect(idempotencyStore.delete).toHaveBeenCalledWith("user_42", "key_xyz");
  });

  it("does not call idempotencyStore.delete when key is absent", async () => {
    const idempotencyStore: IdempotencyStore = {
      delete: vi.fn(async () => {}),
    };
    const { deps } = makeDeps({ idempotencyStore });
    const handle = startSpeculativeCreate(deps, ARGS);
    await handle.result;
    await handle.rollback();
    expect(idempotencyStore.delete).not.toHaveBeenCalled();
  });

  it("rollback is idempotent — second call runs DROP/DELETE only once", async () => {
    const { deps, pg, d1 } = makeDeps();
    const handle = startSpeculativeCreate(deps, ARGS);
    await handle.result;
    await handle.rollback();
    await handle.rollback();
    expect(pg.calls.filter((c) => /DROP SCHEMA/.test(c.sql))).toHaveLength(1);
    expect(d1.deletes).toHaveLength(1);
  });

  it("emits the rollback span with reason=dbs_appeared by default", async () => {
    const { deps } = makeDeps();
    const handle = startSpeculativeCreate(deps, ARGS);
    await handle.result;
    await handle.rollback();
    const span = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.name === "nlqdb.create.speculative.rollback");
    expect(span?.attributes["nlqdb.create.speculative.rollback_reason"]).toBe("dbs_appeared");
  });
});

describe("startSpeculativeCreate — rollback (no compensation needed)", () => {
  it("create failed cleanly → no DROP/DELETE; rollback returns", async () => {
    const { deps, pg, d1 } = makeDeps({
      provision: vi.fn(async () => ({
        ok: false as const,
        reason: "ddl_execution_failed" as const,
        rolled_back: true,
      })),
    });
    const handle = startSpeculativeCreate(deps, ARGS);
    const out = await handle.result;
    expect(out.ok).toBe(false);
    await handle.rollback();
    expect(pg.calls.some((c) => /DROP SCHEMA/.test(c.sql))).toBe(false);
    expect(d1.deletes).toHaveLength(0);
  });

  it("create threw → rollback swallows the throw and runs no compensation", async () => {
    const { deps, pg, d1 } = makeDeps({
      provision: vi.fn(async () => {
        throw new Error("orchestrator-internal panic");
      }),
    });
    const handle = startSpeculativeCreate(deps, ARGS);
    await expect(handle.result).rejects.toThrow(/panic/);
    await expect(handle.rollback()).resolves.toBeUndefined();
    expect(pg.calls.some((c) => /DROP SCHEMA/.test(c.sql))).toBe(false);
    expect(d1.deletes).toHaveLength(0);
  });
});

describe("startSpeculativeCreate — mid-create rollback", () => {
  it("awaits an in-flight create before compensating (no mid-create abort)", async () => {
    let resolveProvision: (v: ProvisionResult) => void = () => {};
    const provisionPromise = new Promise<ProvisionResult>((res) => {
      resolveProvision = res;
    });

    const { deps, pg } = makeDeps({
      provision: vi.fn(async (_d, args: { dbId: string; schemaName: string }) => {
        const v = await provisionPromise;
        return v.ok ? { ...v, dbId: args.dbId, schemaName: args.schemaName } : v;
      }),
    });

    const handle = startSpeculativeCreate(deps, ARGS);
    // Kick rollback while provision is still pending.
    const rollbackPromise = handle.rollback();
    // Nothing rolled back yet — the create hasn't settled.
    expect(pg.calls.some((c) => /DROP SCHEMA/.test(c.sql))).toBe(false);

    resolveProvision({
      ok: true,
      dbId: `db_orders_tracker_${FIXED_SUFFIX}`,
      schemaName: `orders_tracker_${FIXED_SUFFIX}`,
      pkLive: null,
    });
    await rollbackPromise;

    expect(pg.calls.some((c) => /DROP SCHEMA/.test(c.sql))).toBe(true);
  });
});
