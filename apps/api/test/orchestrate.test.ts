// Orchestrator unit tests with stubbed deps. Asserts the full Slice 6
// flow: rate-limit → resolve-DB → hash → plan-cache → LLM plan →
// sql.validate → exec → summarize → emit-then-commit first-query.

import { makeNoopEmitter, type ProductEvent } from "@nlqdb/events";
import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { type OrchestrateDeps, orchestrateAsk } from "../src/ask/orchestrate.ts";
import type { PlanCache } from "../src/ask/plan-cache.ts";
import type { CachedPlan, DbRecord, OrchestrateEvent, QueryResult } from "../src/ask/types.ts";
import { DbConfigError } from "../src/ask/types.ts";

function stubEmitter() {
  return { emit: vi.fn<(event: ProductEvent) => Promise<void>>(async () => {}) };
}

function stubDb(overrides: Partial<DbRecord> = {}): DbRecord {
  return {
    id: "db_1",
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "DATABASE_URL",
    schemaHash: "schema_v1",
    schemaText: 'CREATE TABLE "schema_v1"."orders" (id integer);',
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
  opts: {
    plan?: { sql: string; model?: string; confidence?: number } | Error;
    summary?: { summary: string } | Error;
  } = {},
) {
  return {
    route: vi.fn(),
    plan: vi.fn(async () => {
      const r = opts.plan ?? { sql: "SELECT 1" };
      if (r instanceof Error) throw r;
      return { model: "stub-model", confidence: 1.0, ...r };
    }),
    summarize: vi.fn(async () => {
      const r = opts.summary ?? { summary: "default summary" };
      if (r instanceof Error) throw r;
      return r;
    }),
    schemaInfer: vi.fn(),
    // SK-DB-010 — kept on every LLMRouter stub so contract widening
    // doesn't cascade into orchestrator-test failures.
    engineClassify: vi.fn(),
  } as unknown as LLMRouter;
}

function stubExec(result: QueryResult | Error = { rows: [{ x: 1 }], rowCount: 1 }) {
  return vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
}

function stubRateLimiter(allowed = true, count = 1, limit = 60, resetAt = 0) {
  return { check: vi.fn(async () => ({ allowed, count, limit, resetAt })) };
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
    events: makeNoopEmitter(),
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
    const llm = stubLLM({ plan: { sql: "SELECT * FROM orders" } });
    const out = await orchestrateAsk(makeDeps({ planCache: cache, llm }), {
      goal: "list users",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result).toMatchObject({
      status: "ok",
      rowCount: 1,
      trace: { sql: "SELECT * FROM orders", cache_hit: false },
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

    expect(first.ok && first.result.trace.cache_hit).toBe(false);
    expect(second.ok && second.result.trace.cache_hit).toBe(true);
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
    // Provider error messages can carry API keys / prompt fragments
    // and are stripped at the boundary; only the OTel span retains
    // them (GLOBAL-012).
    expect(out).toEqual({
      ok: false,
      error: { status: "llm_failed" },
    });
  });

  it("returns db_unreachable when exec throws a generic error", async () => {
    const exec = stubExec(new Error("connection refused"));
    const out = await orchestrateAsk(makeDeps({ exec }), {
      goal: "select",
      dbId: "db_1",
      userId: "user_1",
    });
    // Postgres / connection-string fragments are stripped — status only.
    expect(out).toEqual({
      ok: false,
      error: { status: "db_unreachable" },
    });
  });

  it("SK-ASK-015: cache miss + exec failure → no plan.write", async () => {
    // Trace evidence from prod: an anon /v1/ask cached a SELECT against a
    // non-existent table; the next request 28 s later hit the bad cache
    // and 502'd in 1.4 s without an LLM call. The cache write must wait
    // for exec to confirm the plan actually runs.
    //
    // SK-ASK-016 caveat: a missing-table SQL would short-circuit at
    // the pre-flight check before reaching exec. To exercise the
    // SK-ASK-015 invariant cleanly we pick a SQL that passes pre-flight
    // (`orders` is in the stub schema) and force exec to throw a generic
    // transient error.
    const cache = stubPlanCache();
    const llm = stubLLM({ plan: { sql: "SELECT * FROM orders" } });
    const exec = stubExec(new Error("connection refused"));
    const out = await orchestrateAsk(makeDeps({ planCache: cache, llm, exec }), {
      goal: "rows from orders",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({ ok: false, error: { status: "db_unreachable" } });
    expect(cache.write).not.toHaveBeenCalled();
    expect(cache.lookup).toHaveBeenCalledTimes(1);
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
    // Operator-config error message (secret name, schema name) is also
    // captured server-side via OTel and not echoed to the client.
    expect(out).toEqual({
      ok: false,
      error: { status: "db_misconfigured" },
    });
  });

  it("SK-ASK-016 Defense A: pre-flight schema_mismatch when LLM references absent table", async () => {
    // Stub DB has only `orders`. LLM emits a SELECT against `users`.
    const llm = stubLLM({ plan: { sql: "SELECT * FROM users" } });
    const exec = stubExec();
    const out = await orchestrateAsk(makeDeps({ llm, exec }), {
      goal: "list users",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({
      ok: false,
      error: {
        status: "schema_mismatch",
        referencedTables: ["users"],
        schemaTables: ["orders"],
      },
    });
    // Pre-flight short-circuits before exec — no DB round-trip wasted.
    expect(exec).not.toHaveBeenCalled();
  });

  it("SK-ASK-016 Defense B: exec PG 42P01 → schema_mismatch, retry bails after one attempt", async () => {
    // SchemaText null bypasses Defense A so we exercise the post-exec
    // backstop. NeonDbError-shaped object: `.code = "42P01"` + message.
    const ghostError = Object.assign(new Error('relation "ghost" does not exist'), {
      code: "42P01",
    });
    const exec = stubExec(ghostError);
    const out = await orchestrateAsk(
      makeDeps({
        resolveDb: vi.fn(async () => stubDb({ schemaText: null })),
        llm: stubLLM({ plan: { sql: "SELECT * FROM ghost" } }),
        exec,
      }),
      { goal: "anything", dbId: "db_1", userId: "user_1" },
    );
    expect(out).toEqual({
      ok: false,
      error: { status: "schema_mismatch", referencedTables: [], schemaTables: [] },
    });
    // Nonrecoverable wrapping means SK-ASK-013's 3-attempt retry stops
    // after the first failure — no point re-running the same SQL.
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("SK-ASK-016: pre-flight passes when all referenced tables exist", async () => {
    // Plan references a real table — orchestrator proceeds to exec.
    const llm = stubLLM({ plan: { sql: "SELECT * FROM orders" } });
    const exec = stubExec();
    const out = await orchestrateAsk(makeDeps({ llm, exec }), {
      goal: "list orders",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    expect(exec).toHaveBeenCalledTimes(1);
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

  it("emits SSE events in order: plan_pending → plan → rows → summary", async () => {
    const events: OrchestrateEvent[] = [];
    await orchestrateAsk(
      makeDeps({
        llm: stubLLM({ plan: { sql: "SELECT 1" }, summary: { summary: "ok" } }),
        exec: stubExec({ rows: [{ x: 1 }, { x: 2 }], rowCount: 2 }),
      }),
      { goal: "go", dbId: "db_1", userId: "user_1" },
      { onEvent: (e) => void events.push(e) },
    );
    expect(events.map((e) => e.type)).toEqual(["plan_pending", "plan", "rows", "summary"]);
    expect(events[1]).toMatchObject({
      type: "plan",
      trace: { sql: "SELECT 1", cache_hit: false },
    });
    expect(events[2]).toMatchObject({ type: "rows", rowCount: 2 });
    expect(events[3]).toMatchObject({ type: "summary", summary: "ok" });
  });

  it("emits plan_pending unconditionally — cache hit still fires the heartbeat", async () => {
    // Pre-seed the cache so the second call lands on a hit. Clients
    // depend on the documented `plan_pending → plan → …` order; the
    // heartbeat must fire even when there's no LLM call to cover.
    const cache = stubPlanCache();
    const llm = stubLLM({ plan: { sql: "SELECT 99" }, summary: { summary: "ok" } });
    const deps = makeDeps({ planCache: cache, llm });
    await orchestrateAsk(deps, { goal: "warm-up", dbId: "db_1", userId: "user_1" });

    const events: OrchestrateEvent[] = [];
    const out = await orchestrateAsk(
      deps,
      { goal: "warm-up", dbId: "db_1", userId: "user_1" },
      { onEvent: (e) => void events.push(e) },
    );
    expect(out.ok && out.result.trace.cache_hit).toBe(true);
    expect(events.map((e) => e.type)).toEqual(["plan_pending", "plan", "rows", "summary"]);
    expect(events[1]).toMatchObject({
      type: "plan",
      trace: { sql: "SELECT 99", cache_hit: true },
    });
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
      error: { status: "rate_limited", limit: 60, count: 60, resetAt: 0 },
    });
    expect(llm.plan).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
  });

  it("commits first-query AFTER emit (emit-then-commit, UX > strict-once)", async () => {
    const firstQuery = stubFirstQuery(true);
    const events = stubEmitter();
    const out = await orchestrateAsk(makeDeps({ firstQuery, events }), {
      goal: "first ever",
      dbId: "db_1",
      userId: "user_new",
    });
    expect(out.ok).toBe(true);
    expect(firstQuery.notFiredYet).toHaveBeenCalledWith("user_new");
    expect(events.emit).toHaveBeenCalledWith({
      name: "user.first_query",
      userId: "user_new",
      dbId: "db_1",
    });
    expect(firstQuery.commit).toHaveBeenCalledWith("user_new");
    // Emit (the user.first_query one) MUST precede commit — the
    // contract is "show on the observability path before persisting
    // the seen-flag". `ask.completed` fires after both per W4 (it's
    // the workload-analyser fingerprint, not a lifecycle event).
    const firstQueryEmitOrder = events.emit.mock.calls.findIndex(
      (call) => call[0].name === "user.first_query",
    );
    expect(firstQueryEmitOrder).toBeGreaterThanOrEqual(0);
    const firstQueryEmitInvocation = events.emit.mock.invocationCallOrder[firstQueryEmitOrder];
    const commitOrder = firstQuery.commit.mock.invocationCallOrder[0];
    if (firstQueryEmitInvocation === undefined)
      throw new Error("expected events.emit invocation order");
    if (commitOrder === undefined) throw new Error("expected firstQuery.commit invocation order");
    expect(firstQueryEmitInvocation).toBeLessThan(commitOrder);
  });

  it("does NOT emit user.first_query when first-query has already fired", async () => {
    const firstQuery = stubFirstQuery(false);
    const events = stubEmitter();
    const out = await orchestrateAsk(makeDeps({ firstQuery, events }), {
      goal: "second time",
      dbId: "db_1",
      userId: "user_seen",
    });
    expect(out.ok).toBe(true);
    expect(events.emit.mock.calls.some((call) => call[0].name === "user.first_query")).toBe(false);
    expect(firstQuery.commit).not.toHaveBeenCalled();
  });

  it("publishes ask.completed on every successful resolution (workload-analyser input, W4)", async () => {
    const events = stubEmitter();
    const out = await orchestrateAsk(
      makeDeps({
        events,
        llm: stubLLM({ plan: { sql: "SELECT * FROM orders" } }),
        exec: stubExec({ rows: [{ x: 1 }, { x: 2 }, { x: 3 }], rowCount: 3 }),
      }),
      { goal: "list users", dbId: "db_1", userId: "user_seen" },
    );
    expect(out.ok).toBe(true);
    const askCompletedCall = events.emit.mock.calls.find(
      (call) => call[0].name === "ask.completed",
    );
    if (!askCompletedCall) throw new Error("expected ask.completed emission");
    const askCompleted = askCompletedCall[0];
    if (askCompleted.name !== "ask.completed") {
      throw new Error("narrowing failed");
    }
    expect(askCompleted).toMatchObject({
      name: "ask.completed",
      dbId: "db_1",
      schemaHash: "schema_v1",
      engine: "postgres",
      rowsReturned: 3,
    });
    // No SQL text, no values — the wire shape is anonymised. Hashes
    // are hex strings; `orchestratorMs` and `ts` are numeric.
    expect(askCompleted).not.toHaveProperty("sql");
    expect(typeof askCompleted.queryHash).toBe("string");
    expect(typeof askCompleted.planShape).toBe("string");
    expect(typeof askCompleted.orchestratorMs).toBe("number");
    expect(typeof askCompleted.ts).toBe("number");
    // The renamed field is the only canonical name — no stray `ms`
    // alias should leak through, since W5 must not conflate it with
    // the `/v1/ask` SLO timing.
    expect(askCompleted).not.toHaveProperty("ms");
  });

  it("returns a pendingAskCompleted promise on success (route handler ctx.waitUntils it)", async () => {
    const events = stubEmitter();
    const out = await orchestrateAsk(makeDeps({ events }), {
      goal: "anything",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.pendingAskCompleted).toBeInstanceOf(Promise);
    // emit() is fire-and-forget — never throws.
    await expect(out.pendingAskCompleted).resolves.toBeUndefined();
  });

  it("does NOT publish ask.completed on a failed /v1/ask (analyser only sees successes)", async () => {
    const events = stubEmitter();
    const out = await orchestrateAsk(
      makeDeps({ events, exec: stubExec(new Error("connection refused")) }),
      { goal: "anything", dbId: "db_1", userId: "user_1" },
    );
    expect(out.ok).toBe(false);
    expect(events.emit.mock.calls.some((call) => call[0].name === "ask.completed")).toBe(false);
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
    expect(out.result.trace.sql).toBe("SELECT 1");
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

  // GLOBAL-022 — recoverable failures retry to success. Tests pin the
  // four orchestrator stages: plan retries on LLM throw, plan retries
  // on validator-reject (with feedback), exec retries on transient
  // throws, DbConfigError is non-recoverable.

  it("GLOBAL-022: plan retries on transient LLM throw and succeeds on attempt 2", async () => {
    let calls = 0;
    const llm = stubLLM();
    llm.plan = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error("provider chain exhausted");
      return { sql: "SELECT 1" };
    }) as unknown as typeof llm.plan;
    const out = await orchestrateAsk(makeDeps({ llm }), {
      goal: "x",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("GLOBAL-022: validator-reject feeds previousAttempt back into next plan call", async () => {
    const planArgs: unknown[] = [];
    const llm = stubLLM();
    llm.plan = vi.fn(async (req) => {
      planArgs.push(req);
      if (planArgs.length === 1) return { sql: "DROP TABLE users" };
      return { sql: "SELECT 1" };
    }) as unknown as typeof llm.plan;
    const out = await orchestrateAsk(makeDeps({ llm }), {
      goal: "x",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    expect(planArgs).toHaveLength(2);
    // Second attempt sees the rejected SQL + reason in previousAttempt.
    const second = planArgs[1] as { previousAttempt?: { sql?: string; error: string } };
    expect(second.previousAttempt?.sql).toBe("DROP TABLE users");
    expect(second.previousAttempt?.error).toContain("drop_statement");
  });

  it("GLOBAL-022: plan exhausts 3 attempts then surfaces sql_rejected", async () => {
    let calls = 0;
    const llm = stubLLM();
    llm.plan = vi.fn(async () => {
      calls++;
      return { sql: "DROP TABLE users" };
    }) as unknown as typeof llm.plan;
    const out = await orchestrateAsk(makeDeps({ llm }), {
      goal: "x",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({
      ok: false,
      error: { status: "sql_rejected", reason: "drop_statement" },
    });
    expect(calls).toBe(3);
  });

  it("GLOBAL-022: exec retries on transient throw and succeeds on attempt 2", async () => {
    let calls = 0;
    const exec = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error("connection reset");
      return { rows: [{ x: 1 }], rowCount: 1 };
    });
    const out = await orchestrateAsk(makeDeps({ exec }), {
      goal: "x",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("GLOBAL-022: DbConfigError is non-recoverable — single attempt, no retry", async () => {
    let calls = 0;
    const exec = vi.fn(async () => {
      calls++;
      throw new DbConfigError('"DATABASE_URL" did not resolve');
    });
    const out = await orchestrateAsk(makeDeps({ exec }), {
      goal: "x",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out).toEqual({ ok: false, error: { status: "db_misconfigured" } });
    expect(calls).toBe(1);
  });

  // SK-TRUST-001 — render-before-commit gate. Write plans without
  // `confirm` return a preview (diff + requires_confirm) and skip
  // exec; `confirm: true` re-sends commit and exec runs as normal.

  it("SK-TRUST-001: write plan without confirm returns preview + diff and does NOT exec the write", async () => {
    const llm = stubLLM({ plan: { sql: "DELETE FROM orders WHERE id = 1" } });
    const exec = vi.fn(async (_db: DbRecord, sql: string) => {
      // Only the pre-flight COUNT runs on the preview hop. The write
      // itself MUST NOT execute until confirm lands.
      expect(sql).toMatch(/COUNT\(\*\)/i);
      return { rows: [{ c: 5 }], rowCount: 1 };
    });
    const out = await orchestrateAsk(makeDeps({ llm, exec }), {
      goal: "delete order 1",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result.requires_confirm).toBe(true);
    expect(out.result.diff).toEqual({
      verb: "DELETE",
      table: "orders",
      affectedRows: 5,
      summary: "This will delete 5 rows in orders.",
    });
    expect(out.result.rowCount).toBe(0);
    expect(out.result.rows).toEqual([]);
    // Single exec hop: the count query. The DELETE never ran.
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("SK-TRUST-001: write plan with confirm:true skips the preview and commits the write", async () => {
    const llm = stubLLM({ plan: { sql: "DELETE FROM orders WHERE id = 1" } });
    const exec = vi.fn(async (_db: DbRecord, sql: string) => {
      expect(sql.toUpperCase()).toContain("DELETE FROM ORDERS");
      return { rows: [], rowCount: 1 };
    });
    const out = await orchestrateAsk(makeDeps({ llm, exec }), {
      goal: "delete order 1",
      dbId: "db_1",
      userId: "user_1",
      confirm: true,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result.requires_confirm).toBeUndefined();
    expect(out.result.diff).toBeUndefined();
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("SK-TRUST-001: read plan bypasses the gate even without confirm", async () => {
    const llm = stubLLM({ plan: { sql: "SELECT * FROM orders" } });
    const exec = stubExec({ rows: [{ id: 1 }], rowCount: 1 });
    const out = await orchestrateAsk(makeDeps({ llm, exec }), {
      goal: "list orders",
      dbId: "db_1",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.result.requires_confirm).toBeUndefined();
    expect(out.result.rowCount).toBe(1);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("SK-TRUST-001: preview hop emits a confirm_required event with the diff", async () => {
    const llm = stubLLM({ plan: { sql: "UPDATE orders SET status = 'paid' WHERE id = 1" } });
    const exec = vi.fn(async () => ({ rows: [{ c: 3 }], rowCount: 1 }));
    const events: OrchestrateEvent[] = [];
    await orchestrateAsk(
      makeDeps({ llm, exec }),
      { goal: "mark order 1 paid", dbId: "db_1", userId: "user_1" },
      { onEvent: async (e) => void events.push(e) },
    );
    const confirmEvt = events.find((e) => e.type === "confirm_required");
    expect(confirmEvt).toBeDefined();
    if (confirmEvt?.type !== "confirm_required") throw new Error("unreachable");
    expect(confirmEvt.diff.verb).toBe("UPDATE");
    expect(confirmEvt.diff.affectedRows).toBe(3);
  });
});
