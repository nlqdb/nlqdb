// Sequencing tests for `extendOnWrite` (GLOBAL-041 Phase A step 1 compose).
// Callee internals have their own suites; these pin last-statement-wins,
// stage mapping, the allow-list gate, and D1 best-effort.

import type { LLMRouter } from "@nlqdb/llm";
import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DdlValidationResult,
  PgClient,
  PgTransactionResult,
  PgTransactionStatement,
} from "../db-create/types.ts";
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

const RAW_PLAN = {
  create_tables: [],
  add_columns: [
    { table: "events", column: { name: "note", type: "text", nullable: true, description: "c" } },
  ],
};

function makeLlm(
  impl: (req: { goal: string; schema: string }) => Promise<{
    plan: Record<string, unknown>;
    model: string;
    confidence: number;
  }>,
): LLMRouter {
  return { extendSchema: vi.fn(impl) } as unknown as LLMRouter;
}

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

function passValidate(): DdlValidationResult {
  return { ok: true };
}

function deps(over: Partial<ExtendDeps>): ExtendDeps {
  return {
    llm: makeLlm(async () => ({ plan: RAW_PLAN, model: "m-extend", confidence: 0.9 })),
    pg: makePg().pg,
    d1: makeD1().d1,
    validateCompiledDdl: passValidate,
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

  it("absorbs the write: designs a plan, allow-lists compiled DDL, runs one transaction, catches D1 up, returns the write's rows", async () => {
    const pg = makePg();
    const d1 = makeD1({ changes: 1 });
    const validateCompiledDdl = vi.fn<(statements: string[]) => DdlValidationResult>(passValidate);
    const res = await extendOnWrite(deps({ pg: pg.pg, d1: d1.d1, validateCompiledDdl }), ARGS);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result).toEqual({ rows: [{ id: "e1" }], rowCount: 1 });
    expect(res.schemaRewritten).toBe(true);
    expect(res.model).toBe("m-extend");
    expect(res.confidence).toBe(0.9);
    const batch = pg.batch();
    expect(batch?.at(-1)).toEqual({ sql: ARGS.writeSql });
    expect(d1.bound()).toContain("hash-old");
    expect(d1.bound()).toContain("db_abc");
    expect(validateCompiledDdl).toHaveBeenCalledTimes(1);
    const statements = validateCompiledDdl.mock.calls[0]?.[0] ?? [];
    expect(statements.some((s) => /ADD COLUMN/.test(s))).toBe(true);
    // GLOBAL-041 Phase A step 7 — the ok outcome carries the widen DDL so the
    // orchestrator can surface it in `trace.widen` (SK-TRUST-002 parity). It is
    // exactly the compiled statements the allow-list validated and the batch ran.
    expect(res.widenDdl).toEqual(statements);
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
    expect(pg.batch()).toBeUndefined();
  });

  it("short-circuits at stage=compile when the allow-list rejects compiled DDL", async () => {
    const pg = makePg();
    const validateCompiledDdl = vi.fn(
      (): DdlValidationResult => ({
        ok: false,
        reason: "destructive_verb",
        statement: 'ALTER TABLE "abc"."events" ADD COLUMN "note" TEXT;',
      }),
    );
    const res = await extendOnWrite(deps({ pg: pg.pg, validateCompiledDdl }), ARGS);
    expect(res).toMatchObject({ ok: false, stage: "compile", reason: "destructive_verb" });
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
    expect(d1.bound()).toBeUndefined();
  });

  it("still succeeds when the D1 CAS is lost (concurrent widen won the race)", async () => {
    const res = await extendOnWrite(deps({ d1: makeD1({ changes: 0 }).d1 }), ARGS);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.schemaRewritten).toBe(false);
  });

  it("still succeeds when the D1 write throws (blip swallowed, write already committed)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await extendOnWrite(deps({ d1: makeD1({ throwOnRun: true }).d1 }), ARGS);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.schemaRewritten).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("widen_schema_rewrite_failed");
    error.mockRestore();
  });
});
