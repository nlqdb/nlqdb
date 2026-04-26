// Orchestrator unit tests with stubbed deps. Asserts the
// resolve-DB → hash → plan-cache lookup → LLM plan → cache write
// flow lands the right outcomes + side effects.
//
// Telemetry assertions (cache hit/miss counters) live in
// PERFORMANCE §4 row 6's CI assertion bucket — covered when the
// span-tree test lands in commit 5.

import type { LLMRouter } from "@nlqdb/llm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type OrchestrateDeps, orchestrateAsk } from "../src/ask/orchestrate.ts";
import type { PlanCache } from "../src/ask/plan-cache.ts";
import type { CachedPlan, DbRecord } from "../src/ask/types.ts";

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

function stubLLM(planResult: { sql: string } | Error = { sql: "SELECT 1" }) {
  return {
    classify: vi.fn(),
    summarize: vi.fn(),
    plan: vi.fn(async () => {
      if (planResult instanceof Error) throw planResult;
      return planResult;
    }),
  } as unknown as LLMRouter;
}

describe("orchestrateAsk", () => {
  let resolveDb: OrchestrateDeps["resolveDb"];

  beforeEach(() => {
    resolveDb = vi.fn(async () => stubDb());
  });

  it("returns 404-equivalent when the DB does not resolve", async () => {
    resolveDb = vi.fn(async () => null);
    const out = await orchestrateAsk(
      { resolveDb, planCache: stubPlanCache(), llm: stubLLM() },
      { goal: "anything", dbId: "db_missing", userId: "user_1" },
    );
    expect(out).toEqual({ ok: false, error: { status: "db_not_found" } });
  });

  it("rejects when the DB has no schema_hash yet (first-query gating)", async () => {
    resolveDb = vi.fn(async () => stubDb({ schemaHash: null }));
    const out = await orchestrateAsk(
      { resolveDb, planCache: stubPlanCache(), llm: stubLLM() },
      { goal: "anything", dbId: "db_1", userId: "user_1" },
    );
    expect(out).toEqual({ ok: false, error: { status: "schema_unavailable" } });
  });

  it("calls the LLM and writes to cache on a cold-cache request", async () => {
    const cache = stubPlanCache();
    const llm = stubLLM({ sql: "SELECT * FROM users" });
    const out = await orchestrateAsk(
      { resolveDb, planCache: cache, llm },
      { goal: "list users", dbId: "db_1", userId: "user_1" },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result).toMatchObject({ status: "ok", cached: false, sql: "SELECT * FROM users" });
    expect(llm.plan).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledTimes(1);
  });

  it("hits the cache on the second identical request and skips the LLM", async () => {
    const cache = stubPlanCache();
    const llm = stubLLM({ sql: "SELECT 42" });

    const first = await orchestrateAsk(
      { resolveDb, planCache: cache, llm },
      { goal: "what is the answer", dbId: "db_1", userId: "user_1" },
    );
    const second = await orchestrateAsk(
      { resolveDb, planCache: cache, llm },
      { goal: "what is the answer", dbId: "db_1", userId: "user_1" },
    );

    expect(first.ok && first.result.cached).toBe(false);
    expect(second.ok && second.result.cached).toBe(true);
    expect(llm.plan).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledTimes(1);
  });

  it("propagates LLM failure as a structured error", async () => {
    const llm = stubLLM(new Error("all providers exhausted"));
    const out = await orchestrateAsk(
      { resolveDb, planCache: stubPlanCache(), llm },
      { goal: "anything", dbId: "db_1", userId: "user_1" },
    );
    expect(out).toEqual({
      ok: false,
      error: { status: "llm_failed", message: "all providers exhausted" },
    });
  });
});
