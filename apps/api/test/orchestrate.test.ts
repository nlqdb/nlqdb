// Orchestrator unit tests with stubbed deps. Asserts the full Slice 6
// flow: rate-limit → resolve-DB → hash → plan-cache → LLM plan →
// sql.validate → exec → summarize → emit-then-commit first-query.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { type OrchestrateDeps, orchestrateAsk } from "../src/ask/orchestrate.ts";
import type { PlanCache } from "../src/ask/plan-cache.ts";
import type { CachedPlan, DbRecord, OrchestrateEvent, QueryResult } from "../src/ask/types.ts";
import { DbConfigError } from "../src/ask/types.ts";

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

function stubExec(result: QueryResult | Error = { rows: [{ x: 1 }], rowCount: 1 }) {
  return vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
}

function stubRateLimiter(allowed = true, count = 1, limit = 60) {
  return { check: vi.fn(async () => ({ allowed, count, limit })) };
}

function stubFirstQuery(notFiredYet = false) {
  return {
    notFiredYet: vi.fn(async () => notFiredYet),
    commit: vi.fn(async () => {}),
  };
}

function makeDeps(overrides: Partial<OrchestrateDeps> = {}): OrchestrateDeps {
  return {
    resolveDb: vi.fn(async () => stubDb()),
    planCache: stubPlanCache(),
    llm: stubLLM(),
    exec: stubExec(),
    rateLimiter: stubRateLimiter(),
    firstQuery: stubFirstQuery(),
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

  it("returns db_unreachable when exec throws a generic error", async () => {
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

  it("returns db_misconfigured when exec throws DbConfigError", async () => {
    const exec = stubExec(
      new DbConfigError('connection_secret_ref "DATABASE_URL" did not resolve'),
    );
    const out = await orchestrateAsk(makeDeps({ exec }), {
      goal: "select",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({
      ok: false,
      error: {
        status: "db_misconfigured",
        message: 'connection_secret_ref "DATABASE_URL" did not resolve',
      },
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

  it("returns rate_limited and skips DB / LLM when the limiter denies", async () => {
    const llm = stubLLM();
    const exec = stubExec();
    const rateLimiter = stubRateLimiter(false, 60, 60);
    const out = await orchestrateAsk(makeDeps({ llm, exec, rateLimiter }), {
      goal: "anything",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({
      ok: false,
      error: { status: "rate_limited", limit: 60, count: 60 },
    });
    expect(llm.plan).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
  });

  it("commits first-query AFTER emit (emit-then-commit, UX > strict-once)", async () => {
    const firstQuery = stubFirstQuery(true);
    const out = await orchestrateAsk(makeDeps({ firstQuery }), {
      goal: "first ever",
      dbId: "db_1",
      userId: "user_new",
    });
    expect(out.ok).toBe(true);
    expect(firstQuery.notFiredYet).toHaveBeenCalledWith("user_new");
    expect(firstQuery.commit).toHaveBeenCalledWith("user_new");
  });

  it("does NOT check first-query when execution fails (event not burned on failed call)", async () => {
    const firstQuery = stubFirstQuery(true);
    const out = await orchestrateAsk(
      makeDeps({ exec: stubExec(new Error("connection refused")), firstQuery }),
      { goal: "anything", dbId: "db_1", userId: "user_1" },
    );
    expect(out.ok).toBe(false);
    expect(firstQuery.notFiredYet).not.toHaveBeenCalled();
    expect(firstQuery.commit).not.toHaveBeenCalled();
  });

  it("first-query commit failure is non-fatal — request still succeeds", async () => {
    const firstQuery = {
      notFiredYet: vi.fn(async () => true),
      commit: vi.fn(async () => {
        throw new Error("KV down");
      }),
    };
    const out = await orchestrateAsk(makeDeps({ firstQuery }), {
      goal: "first ever",
      dbId: "db_1",
      userId: "user_new",
    });
    expect(out.ok).toBe(true);
    expect(firstQuery.commit).toHaveBeenCalledTimes(1);
  });

  it("first-query notFiredYet failure is conservative — no emit, no commit", async () => {
    const firstQuery = {
      notFiredYet: vi.fn(async () => {
        throw new Error("KV down");
      }),
      commit: vi.fn(async () => {}),
    };
    const out = await orchestrateAsk(makeDeps({ firstQuery }), {
      goal: "first ever",
      dbId: "db_1",
      userId: "user_new",
    });
    expect(out.ok).toBe(true);
    expect(firstQuery.commit).not.toHaveBeenCalled();
  });

  it("plan-cache write failure is non-fatal — request returns the fresh plan", async () => {
    const cache = {
      lookup: vi.fn(async () => null),
      write: vi.fn(async () => {
        throw new Error("KV write blocked");
      }),
    };
    const llm = stubLLM({ plan: { sql: "SELECT 1" } });
    const out = await orchestrateAsk(makeDeps({ planCache: cache, llm }), {
      goal: "anything",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result.sql).toBe("SELECT 1");
    expect(cache.write).toHaveBeenCalledTimes(1);
  });

  it("onEvent failure is swallowed — request continues to a successful outcome", async () => {
    const onEvent = vi.fn(async () => {
      throw new Error("client disconnected");
    });
    const out = await orchestrateAsk(
      makeDeps(),
      { goal: "anything", dbId: "db_1", userId: "user_1" },
      { onEvent },
    );
    expect(out.ok).toBe(true);
    expect(onEvent).toHaveBeenCalled();
  });
});
