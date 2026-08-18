// SK-ASK-009 write-intent enforcement + SK-ASK-005 summarize gate.
//
// The flagship correctness fix: a `kind=write` goal that the planner
// answers with a SELECT must not execute as a read (silently dropping the
// mutation). The orchestrator re-plans on the disagreement and, once the
// planner emits a write, routes it through the SK-TRUST-001 preview gate.

import type { LLMRouter, PlanRequest, PlanResponse } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import type { OrchestrateDeps } from "./orchestrate.ts";
import { orchestrateAsk } from "./orchestrate.ts";
import type { AskRequest, DbRecord, QueryResult } from "./types.ts";

const DB: DbRecord = {
  id: "db_members1",
  tenantId: "user_1",
  engine: "postgres",
  connectionSecretRef: "ref",
  schemaHash: "hash1",
  schemaText: "CREATE TABLE members (id INTEGER, name TEXT, join_date TEXT)",
  connectionBlob: null,
};

function deps(
  plan: (req: PlanRequest) => Promise<PlanResponse>,
  exec: (sql: string) => Promise<QueryResult>,
  summarize = vi.fn(async () => ({ summary: "…" })),
): OrchestrateDeps {
  const llm = {
    plan: vi.fn(plan),
    summarize,
    route: vi.fn(),
    schemaInfer: vi.fn(),
    engineClassify: vi.fn(),
  } as unknown as LLMRouter;
  return {
    resolveDb: async () => DB,
    planCache: { lookup: async () => null, write: async () => {} },
    llm,
    exec: async (_db, sql) => exec(sql),
    rateLimiter: { check: async () => ({ allowed: true, limit: 100, count: 1, resetAt: 0 }) },
    firstQuery: { notFiredYet: async () => false, commit: async () => {} },
    events: { emit: async () => {} } as unknown as OrchestrateDeps["events"],
  };
}

const req = (over: Partial<AskRequest> = {}): AskRequest => ({
  goal: "add a member drogo",
  dbId: "db_members1",
  userId: "user_1",
  ...over,
});

const planOf = (sql: string): PlanResponse => ({ sql, model: "test", confidence: 1 });
const EMPTY: QueryResult = { rows: [], rowCount: 0 };

describe("orchestrateAsk — write-intent enforcement (SK-ASK-009)", () => {
  it("re-plans when a write goal is answered with a SELECT, then previews the write", async () => {
    const plan = vi
      .fn<(r: PlanRequest) => Promise<PlanResponse>>()
      // First attempt: planner wrongly emits a read.
      .mockResolvedValueOnce(planOf("SELECT * FROM members"))
      // Retry (fed the disagreement) emits the write.
      .mockResolvedValueOnce(planOf("INSERT INTO members (name) VALUES ('drogo')"));
    const exec = vi.fn(async () => EMPTY);
    const d = deps(plan, exec);

    const out = await orchestrateAsk(d, req({ intent: "write" }));

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // Landed on the SK-TRUST-001 preview hop, not an executed read.
    expect(out.result.requires_confirm).toBe(true);
    expect(out.result.trace.sql).toMatch(/^INSERT INTO members/);
    expect(plan).toHaveBeenCalledTimes(2);
    // The retry carried the disagreement back to the planner.
    expect(plan.mock.calls[1]?.[0]?.previousAttempt?.error).toMatch(/expected_data_modification/);
    // No INSERT executed — preview hop returns before exec commits it.
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects with expected_data_modification when the planner never emits a write", async () => {
    const plan = vi.fn(async () => planOf("SELECT * FROM members"));
    const out = await orchestrateAsk(
      deps(plan, async () => EMPTY),
      req({ intent: "write" }),
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toEqual({ status: "sql_rejected", reason: "expected_data_modification" });
  });

  it("write intent passes through to the planner request", async () => {
    const plan = vi.fn<(r: PlanRequest) => Promise<PlanResponse>>(async () =>
      planOf("INSERT INTO members (name) VALUES ('drogo')"),
    );
    await orchestrateAsk(
      deps(plan, async () => EMPTY),
      req({ intent: "write" }),
    );
    expect(plan.mock.calls[0]?.[0]?.intent).toBe("write");
  });
});

describe("orchestrateAsk — summarize gate (SK-ASK-005)", () => {
  it("does not summarize an empty read result", async () => {
    const summarize = vi.fn(async () => ({ summary: "should not run" }));
    const plan = vi.fn(async () => planOf("SELECT * FROM members"));
    const out = await orchestrateAsk(
      deps(plan, async () => EMPTY, summarize),
      req({ goal: "members", intent: "query" }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(summarize).not.toHaveBeenCalled();
    expect(out.result.summary).toBeUndefined();
  });

  it("summarizes a non-empty read result", async () => {
    const summarize = vi.fn(async () => ({ summary: "4 members." }));
    const plan = vi.fn(async () => planOf("SELECT * FROM members"));
    const rows: QueryResult = { rows: [{ name: "Alice" }, { name: "Bob" }], rowCount: 2 };
    const out = await orchestrateAsk(
      deps(plan, async () => rows, summarize),
      req({ goal: "members", intent: "query" }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(out.result.summary).toBe("4 members.");
  });
});
