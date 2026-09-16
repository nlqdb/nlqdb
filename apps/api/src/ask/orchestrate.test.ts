// SK-ASK-009 write-intent enforcement + SK-ASK-005 summarize gate.
//
// The flagship correctness fix: a `kind=write` goal that the planner
// answers with a SELECT must not execute as a read (silently dropping the
// mutation). The orchestrator re-plans on the disagreement and, once the
// planner emits a write, routes it through the SK-TRUST-001 preview gate.

import type { LLMRouter, PlanRequest, PlanResponse } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import type { ExtendArgs, ExtendOutcome } from "./extend.ts";
import type { OrchestrateDeps } from "./orchestrate.ts";
import { orchestrateAsk } from "./orchestrate.ts";
import type { AskRequest, DbRecord, QueryResult } from "./types.ts";

// recordSchemaMismatch (via classifyColumnMissing) logs a structured line by
// design (SK-ASK-023); silence it so the widen-routing tests read clean.
vi.spyOn(console, "error").mockImplementation(() => {});

function pgError(message: string, code: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

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
    expect(out.error).toEqual({ code: "sql_rejected", reason: "expected_data_modification" });
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

describe("orchestrateAsk — widen-on-write, missing-column absorb (SK-SCHEMA-008)", () => {
  // An INSERT naming a field the observed schema lacks (`members` has no
  // `age`) fails exec with 42703. That is first-insert demand for an existing
  // table — the sibling of the missing-table (42P01) case — so it must route
  // to the Defense B absorb, not surface as `db_unreachable`.
  const AGE_INSERT = "INSERT INTO members (name, age) VALUES ('drogo', 30)";

  it("routes an INSERT's 42703 to extendWrite and lands the row (KPI-1 numerator)", async () => {
    const plan = vi.fn(async () => planOf(AGE_INSERT));
    // First (and only) exec attempt throws undefined_column; the absorb path
    // owns the retry decision (Nonrecoverable → no replay).
    const exec = vi.fn(async () => {
      throw pgError('column "age" does not exist', "42703");
    });
    const extendWrite = vi.fn<(a: ExtendArgs) => Promise<ExtendOutcome>>(async () => ({
      ok: true,
      result: { rows: [], rowCount: 1 },
      schemaRewritten: true,
      model: "test",
      confidence: 1,
      widenDdl: ["ALTER TABLE members ADD COLUMN age INTEGER NULL"],
    }));
    const d = { ...deps(plan, exec), extendWrite };

    const out = await orchestrateAsk(d, req({ intent: "write", confirm: true }));

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(extendWrite).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(1);
    // KPI-1 numerator flag rides the committed hop.
    expect(out.extendNeeded).toBe(true);
    // The DBA acted observably — trace names the widened table + the DDL it ran.
    expect(out.result.trace.widen).toEqual({
      tables: ["members"],
      ddl: ["ALTER TABLE members ADD COLUMN age INTEGER NULL"],
      schema_rewritten: true,
    });
  });

  it("surfaces schema_mismatch + extendNeeded when the absorb fails (KPI-1 denominator)", async () => {
    const plan = vi.fn(async () => planOf(AGE_INSERT));
    const exec = vi.fn(async () => {
      throw pgError('column "age" does not exist', "42703");
    });
    const extendWrite = vi.fn<(a: ExtendArgs) => Promise<ExtendOutcome>>(async () => ({
      ok: false,
      stage: "plan",
      reason: "plan_invalid",
    }));
    const d = { ...deps(plan, exec), extendWrite };

    const out = await orchestrateAsk(d, req({ intent: "write", confirm: true }));

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.code).toBe("schema_mismatch");
    expect(out.extendNeeded).toBe(true);
  });

  it("degrades a THROWING absorb to schema_mismatch, never a 500", async () => {
    // The 2026-09-15 incident: `extendWrite`'s lazy `import('./sql-validate-ddl.ts')`
    // rejected (libpg-query read `self.location.href` on workerd), and because the
    // call sat outside a try the rejection escaped `orchestrateAsk` as a 500. A
    // best-effort absorb that throws must land on the same envelope as one that
    // returns `ok: false` (GLOBAL-033).
    const plan = vi.fn(async () => planOf(AGE_INSERT));
    const exec = vi.fn(async () => {
      throw pgError('column "age" does not exist', "42703");
    });
    const extendWrite = vi.fn<(a: ExtendArgs) => Promise<ExtendOutcome>>(async () => {
      throw new TypeError("Cannot read properties of undefined (reading 'href')");
    });
    const d = { ...deps(plan, exec), extendWrite };

    const out = await orchestrateAsk(d, req({ intent: "write", confirm: true }));

    expect(extendWrite).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.code).toBe("schema_mismatch");
    expect(out.extendNeeded).toBe(true);
  });

  it("does NOT absorb a read's 42703 — it re-plans (extendWrite untouched)", async () => {
    // A SELECT naming a missing column is a planning miss, not widen demand:
    // it must take the SK-ASK-022 execution-guided repair, never the absorb.
    const plan = vi
      .fn<(r: PlanRequest) => Promise<PlanResponse>>()
      .mockResolvedValueOnce(planOf("SELECT age FROM members"))
      .mockResolvedValueOnce(planOf("SELECT id FROM members"));
    const exec = vi
      .fn<(sql: string) => Promise<QueryResult>>()
      .mockRejectedValueOnce(pgError('column "age" does not exist', "42703"))
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const extendWrite = vi.fn<(a: ExtendArgs) => Promise<ExtendOutcome>>();
    const d = { ...deps(plan, exec), extendWrite };

    const out = await orchestrateAsk(d, req({ goal: "member ages", intent: "query" }));

    expect(out.ok).toBe(true);
    expect(extendWrite).not.toHaveBeenCalled();
    // Re-planned once with the PG error fed back (SK-ASK-022).
    expect(plan).toHaveBeenCalledTimes(2);
    expect(plan.mock.calls[1]?.[0]?.previousAttempt?.error).toMatch(/column .* does not exist/i);
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
