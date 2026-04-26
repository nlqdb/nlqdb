// Orchestrator unit tests with stubbed deps. Asserts the full Slice 6
// flow: resolve-DB → hash → plan-cache → LLM plan → sql.validate →
// exec → summarize. Telemetry assertions (cache hit/miss counters,
// span tree) live in the integration suite.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { type OrchestrateDeps, orchestrateAsk } from "../src/ask/orchestrate.ts";
import type { PlanCache } from "../src/ask/plan-cache.ts";
import type { CachedPlan, DbRecord, OrchestrateEvent, QueryResult } from "../src/ask/types.ts";

function stubDb(overrides: Partial<DbRecord> = {}): DbRecord {
  return {
    id: "db_1",
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "DATABASE_URL",
    schemaHash: "schema_v1",
    ...overrides,
  };
}

function stubPlanCache(seed: Map<string, CachedPlan> = new Map()) {
  return {
    lookup: vi.fn(async (schemaHash: string, queryHash: string) => {
      return seed.get(`${schemaHash}:${queryHash}`) ?? null;
    }),
    write: vi.fn(async (schemaHash: string, queryHash: string, plan: CachedPlan) => {
      seed.set(`${schemaHash}:${queryHash}`, plan);
    }),
  } satisfies PlanCache;
}

function stubLLM(
  opts: { plan?: { sql: string } | Error; summary?: { summary: string } | Error } = {},
) {
  return {
    classify: vi.fn(),
    plan: vi.fn(async () => {
      const r = opts.plan ?? { sql: "SELECT 1" };
      if (r instanceof Error) throw r;
      return r;
    }),
    summarize: vi.fn(async () => {
      const r = opts.summary ?? { summary: "default summary" };
      if (r instanceof Error) throw r;
      return r;
    }),
  } as unknown as LLMRouter;
}

function stubExec(result: QueryResult | Error | null = { rows: [{ x: 1 }], rowCount: 1 }) {
  return vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
}

function makeDeps(overrides: Partial<OrchestrateDeps> = {}): OrchestrateDeps {
  return {
    resolveDb: vi.fn(async () => stubDb()),
    planCache: stubPlanCache(),
    llm: stubLLM(),
    exec: stubExec(),
    ...overrides,
  };
}

describe("orchestrateAsk", () => {
  it("returns db_not_found when the resolver returns null", async () => {
    const out = await orchestrateAsk(makeDeps({ resolveDb: vi.fn(async () => null) }), {
      goal: "anything",
      dbId: "db_missing",
      userId: "user_1",
    });
    expect(out).toEqual({ ok: false, error: { status: "db_not_found" } });
  });

  it("returns schema_unavailable when the DB has no schema_hash yet", async () => {
    const out = await orchestrateAsk(
      makeDeps({ resolveDb: vi.fn(async () => stubDb({ schemaHash: null })) }),
      { goal: "anything", dbId: "db_1", userId: "user_1" },
    );
    expect(out).toEqual({ ok: false, error: { status: "schema_unavailable" } });
  });

  it("calls LLM + writes cache on a cold-cache request", async () => {
    const cache = stubPlanCache();
    const llm = stubLLM({ plan: { sql: "SELECT * FROM users" } });
    const out = await orchestrateAsk(makeDeps({ planCache: cache, llm }), {
      goal: "list users",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result).toMatchObject({
      status: "ok",
      cached: false,
      sql: "SELECT * FROM users",
      rowCount: 1,
    });
    expect(llm.plan).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledTimes(1);
  });

  it("hits cache on a second identical call and skips LLM.plan", async () => {
    const cache = stubPlanCache();
    const llm = stubLLM({ plan: { sql: "SELECT 42" } });
    const deps = makeDeps({ planCache: cache, llm });

    const first = await orchestrateAsk(deps, {
      goal: "what is the answer",
      dbId: "db_1",
      userId: "user_1",
    });
    const second = await orchestrateAsk(deps, {
      goal: "what is the answer",
      dbId: "db_1",
      userId: "user_1",
    });

    expect(first.ok && first.result.cached).toBe(false);
    expect(second.ok && second.result.cached).toBe(true);
    expect(llm.plan).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledTimes(1);
  });

  it("rejects an LLM-emitted destructive plan via sql.validate", async () => {
    const llm = stubLLM({ plan: { sql: "DROP TABLE users" } });
    const out = await orchestrateAsk(makeDeps({ llm }), {
      goal: "drop everything",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({
      ok: false,
      error: { status: "sql_rejected", reason: "drop_statement" },
    });
  });

  it("propagates LLM.plan failure as a structured error", async () => {
    const llm = stubLLM({ plan: new Error("all providers exhausted") });
    const out = await orchestrateAsk(makeDeps({ llm }), {
      goal: "anything",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({
      ok: false,
      error: { status: "llm_failed", message: "all providers exhausted" },
    });
  });

  it("returns db_unreachable when exec throws", async () => {
    const exec = stubExec(new Error("connection refused"));
    const out = await orchestrateAsk(makeDeps({ exec }), {
      goal: "select",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({
      ok: false,
      error: { status: "db_unreachable", message: "connection refused" },
    });
  });

  it("includes summary by default and skips it when skipSummary=true", async () => {
    const llm = stubLLM({ summary: { summary: "five rows" } });
    const withSummary = await orchestrateAsk(makeDeps({ llm }), {
      goal: "anything",
      dbId: "db_1",
      userId: "user_1",
    });
    if (!withSummary.ok) throw new Error("unreachable");
    expect(withSummary.result.summary).toBe("five rows");

    const llm2 = stubLLM();
    const withoutSummary = await orchestrateAsk(
      makeDeps({ llm: llm2 }),
      { goal: "anything", dbId: "db_1", userId: "user_1" },
      { skipSummary: true },
    );
    if (!withoutSummary.ok) throw new Error("unreachable");
    expect(withoutSummary.result.summary).toBeUndefined();
    expect(llm2.summarize).not.toHaveBeenCalled();
  });

  it("emits SSE events in order: plan → rows → summary", async () => {
    const events: OrchestrateEvent[] = [];
    await orchestrateAsk(
      makeDeps({
        llm: stubLLM({ plan: { sql: "SELECT 1" }, summary: { summary: "ok" } }),
        exec: stubExec({ rows: [{ x: 1 }, { x: 2 }], rowCount: 2 }),
      }),
      { goal: "go", dbId: "db_1", userId: "user_1" },
      { onEvent: (e) => void events.push(e) },
    );
    expect(events.map((e) => e.type)).toEqual(["plan", "rows", "summary"]);
    expect(events[0]).toMatchObject({ type: "plan", sql: "SELECT 1", cached: false });
    expect(events[1]).toMatchObject({ type: "rows", rowCount: 2 });
    expect(events[2]).toMatchObject({ type: "summary", summary: "ok" });
  });

  it("summary failure is non-fatal — returns rows + sql, omits summary", async () => {
    const out = await orchestrateAsk(
      makeDeps({
        llm: stubLLM({ summary: new Error("rate limited") }),
      }),
      { goal: "anything", dbId: "db_1", userId: "user_1" },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result.summary).toBeUndefined();
    expect(out.result.rowCount).toBe(1);
  });
});
