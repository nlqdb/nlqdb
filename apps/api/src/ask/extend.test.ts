// Unit tests for the pure extend orchestrator (GLOBAL-041 Phase A step 1,
// compose half, SK-SCHEMA-008). The composition sequences five built +
// separately-tested slices, so these tests cover the SEQUENCING and the typed
// outcome the orchestrator's hot-path wire will consume — not the callees'
// internals (those have their own suites):
//   - happy path: plan designed → batch run in one transaction → D1 caught up,
//     returning the write's LAST-statement rows + the extend model/confidence;
//   - each failure stage short-circuits with the right `stage` + `reason`
//     (`plan` / `compile` / `exec`) and, for exec, the raw error + sqlState;
//   - the D1 catch-up is best-effort: a lost CAS or a D1 throw still returns ok
//     (the write committed), only `schemaRewritten` reflects it.

import type { LLMRouter } from "@nlqdb/llm";
import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PgClient, PgTransactionResult, PgTransactionStatement } from "../db-create/types.ts";
import { type ExtendArgs, type ExtendDeps, extendOnWrite } from "./extend.ts";

const ARGS: ExtendArgs = {
  dbId: "db_abc",
  tenantId: "tenant-1",
  schemaName: "abc",
  schemaText: 'CREATE TABLE "abc"."events" (id uuid);',
  observedHash: "hash-old",
  goal: "log an event with a note",
  writeSql: 'INSERT INTO "events" ("id", "note") VALUES (\'e1\', \'hi\')',
};

// A raw WidenPlan-shaped object the extend LLM would emit — passes
// `WidenPlanSchema` inside `extendSchema`, compiles to one ADD COLUMN.
const RAW_PLAN = {
  create_tables: [],
  add_columns: [
    { table: "events", column: { name: "note", type: "text", nullable: true, description: "c" } },
  ],
};

// Minimal LLMRouter stub — only `extendSchema` is exercised by this module.
function makeLlm(
  impl: (req: { goal: string; schema: string }) => Promise<{
    plan: Record<string, unknown>;
    model: string;
    confidence: number;
  }>,
): LLMRouter {
  return { extendSchema: vi.fn(impl) } as unknown as LLMRouter;
}

// PgClient stub recording the one `transaction([...])` batch; when armed with a
// SQLSTATE it rejects NeonDbError-shaped (`.code`). On success every statement
// returns one row so we can assert the LAST result maps to the write outcome.
function makePg(opts?: { fail?: { code?: string; message?: string } }): {
  pg: PgClient;
  batch: () => PgTransactionStatement[] | undefined;
} {
  let seen: PgTransactionStatement[] | undefined;
  const transaction = vi.fn(async (statements: PgTransactionStatement[]) => {
    seen = statements;
    if (opts?.fail) {
      const e: Error & { code?: string } = new Error(opts.fail.message ?? "tx stub failure");
      if (opts.fail.code) e.code = opts.fail.code;
      throw e;
    }
    // Distinct rowCount per statement so "last statement wins" is observable:
    // the trailing INSERT (index n-1) reports 1 affected row.
    return statements.map(
      (_s, i) =>
        ({
          rows: i === statements.length - 1 ? [{ id: "e1" }] : [],
          rowCount: i === statements.length - 1 ? 1 : 0,
        }) satisfies PgTransactionResult,
    );
  }) as unknown as PgClient["transaction"];
  const query = (async () => ({ rows: [], rowCount: 0 })) as unknown as PgClient["query"];
  return { pg: { query, transaction }, batch: () => seen };
}

// D1Database stub — only `rewriteWidenedSchema`'s prepare→bind→run chain is hit.
// `changes` drives the CAS outcome; `throwOnRun` simulates a D1 blip.
function makeD1(opts?: { changes?: number; throwOnRun?: boolean }): {
  d1: D1Database;
  bound: () => unknown[] | undefined;
} {
  let bound: unknown[] | undefined;
  const stmt = {
    bind: (...params: unknown[]) => {
      bound = params;
      return stmt;
    },
    run: async () => {
      if (opts?.throwOnRun) throw new Error("D1_ERROR: storage blip");
      return { meta: { changes: opts?.changes ?? 1 } };
    },
  };
  const d1 = { prepare: () => stmt } as unknown as D1Database;
  return { d1, bound: () => bound };
}

function deps(over: Partial<ExtendDeps>): ExtendDeps {
  return {
    llm: makeLlm(async () => ({ plan: RAW_PLAN, model: "m-extend", confidence: 0.9 })),
    pg: makePg().pg,
    d1: makeD1().d1,
    ...over,
  };
}

describe("extendOnWrite", () => {
  let telemetry: TestTelemetry;
  beforeEach(() => {
    telemetry = createTestTelemetry();
  });
  afterEach(() => {
    telemetry.reset();
  });

  it("absorbs the write: designs a plan, runs one transaction, catches D1 up, returns the write's rows", async () => {
    const pg = makePg();
    const d1 = makeD1({ changes: 1 });
    const res = await extendOnWrite(deps({ pg: pg.pg, d1: d1.d1 }), ARGS);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // The write's rows come from the LAST batch statement (the INSERT).
    expect(res.result).toEqual({ rows: [{ id: "e1" }], rowCount: 1 });
    expect(res.schemaRewritten).toBe(true);
    // Extend model/confidence ride through for the trace block.
    expect(res.model).toBe("m-extend");
    expect(res.confidence).toBe(0.9);
    // One transaction whose LAST statement is the orchestrator's write, verbatim.
    const batch = pg.batch();
    expect(batch?.at(-1)).toEqual({ sql: ARGS.writeSql });
    // The CAS bound the OBSERVED hash as the expected-hash guard.
    expect(d1.bound()).toContain("hash-old");
    expect(d1.bound()).toContain("db_abc");
  });

  it("short-circuits at stage=plan when the extend LLM fails", async () => {
    const llm = makeLlm(async () => {
      throw new Error("provider 500");
    });
    const res = await extendOnWrite(deps({ llm }), ARGS);
    expect(res).toMatchObject({ ok: false, stage: "plan", reason: "llm_failed" });
  });

  it("short-circuits at stage=plan when the LLM's plan fails the Zod gate", async () => {
    const llm = makeLlm(async () => ({ plan: { not: "a widen plan" }, model: "m", confidence: 1 }));
    const res = await extendOnWrite(deps({ llm }), ARGS);
    expect(res).toMatchObject({ ok: false, stage: "plan", reason: "plan_invalid" });
  });

  it("short-circuits at stage=compile when a Zod-valid plan violates a compile invariant", async () => {
    // A `primary_key` that names a column the table doesn't declare passes the
    // Zod shape gate (it validates each is an identifier, not that it exists)
    // but the compiler refuses it. The compiler's typed reason must surface as
    // a compile-stage stop, and nothing should reach Postgres.
    const llm = makeLlm(async () => ({
      plan: {
        create_tables: [
          {
            name: "orders",
            description: "t",
            columns: [{ name: "id", type: "uuid", nullable: false, description: "pk" }],
            primary_key: ["nonexistent"],
          },
        ],
        add_columns: [],
      },
      model: "m",
      confidence: 1,
    }));
    const pg = makePg();
    const res = await extendOnWrite(deps({ llm, pg: pg.pg }), ARGS);
    expect(res).toMatchObject({
      ok: false,
      stage: "compile",
      reason: "primary_key_column_missing",
    });
    // The transaction was never run.
    expect(pg.batch()).toBeUndefined();
  });

  it("short-circuits at stage=exec on a rolled-back transaction, preserving sqlState + raw error", async () => {
    const pg = makePg({ fail: { code: "23502", message: "null value violates not-null" } });
    const d1 = makeD1();
    const res = await extendOnWrite(deps({ pg: pg.pg, d1: d1.d1 }), ARGS);
    expect(res).toMatchObject({
      ok: false,
      stage: "exec",
      reason: "write_rejected",
      sqlState: "23502",
    });
    if (!res.ok) expect(res.error).toBeInstanceOf(Error);
    // A failed widen must not touch D1's schema.
    expect(d1.bound()).toBeUndefined();
  });

  it("still succeeds when the D1 CAS is lost (concurrent widen won the race)", async () => {
    const res = await extendOnWrite(deps({ d1: makeD1({ changes: 0 }).d1 }), ARGS);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.schemaRewritten).toBe(false);
  });

  it("still succeeds when the D1 write throws (blip swallowed, write already committed)", async () => {
    const res = await extendOnWrite(deps({ d1: makeD1({ throwOnRun: true }).d1 }), ARGS);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.schemaRewritten).toBe(false);
  });
});
