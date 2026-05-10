// SK-ASK-009 — routeAsk merged classifier. Stubs the LLM router; the
// table-aware short-circuits (0-dbs / recent-table+verb / slug match)
// must hit before the LLM is invoked.

import type { LLMRouter, RouteRequest, RouteResponse } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import type { RecentTable } from "./recent-tables.ts";
import { routeAsk } from "./route-ask.ts";

function llmStub(overrides?: Partial<LLMRouter>): LLMRouter {
  return {
    route: vi.fn(),
    plan: vi.fn(),
    summarize: vi.fn(),
    schemaInfer: vi.fn(),
    engineClassify: vi.fn(),
    ...overrides,
  } as unknown as LLMRouter;
}

function rt(dbId: string, table: string, slug = `${dbId}-slug`): RecentTable {
  return { dbId, slug, table, touchedAt: 0 };
}

describe("routeAsk — deterministic short-circuits (no LLM)", () => {
  it("0 dbs → kind=create, no LLM call", async () => {
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      { goal: "an orders tracker", dbs: [], recentTables: [] },
    );
    expect(out).toEqual({
      kind: "create",
      targetDbId: null,
      referencedTables: [],
      confidence: 1,
      reason: "no_dbs",
    });
    expect(route).not.toHaveBeenCalled();
  });

  it("recent-table substring + write verb → kind=write, no LLM call", async () => {
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "insert a new order into orders",
        dbs: [{ id: "db1", slug: "orders-tracker-a4f" }],
        recentTables: [rt("db1", "orders")],
      },
    );
    expect(out.kind).toBe("write");
    expect(out.targetDbId).toBe("db1");
    expect(out.referencedTables).toEqual(["orders"]);
    expect(out.reason).toBe("recent_table_match");
    expect(route).not.toHaveBeenCalled();
  });

  it("recent-table substring + query verb → kind=query, no LLM call", async () => {
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "show me recent orders",
        dbs: [{ id: "db1", slug: "orders-tracker-a4f" }],
        recentTables: [rt("db1", "orders")],
      },
    );
    expect(out.kind).toBe("query");
    expect(out.targetDbId).toBe("db1");
    expect(out.reason).toBe("recent_table_match");
    expect(route).not.toHaveBeenCalled();
  });

  it("recent-table substring without verb → falls through to LLM", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "query",
        targetDbId: "db1",
        referencedTables: ["orders"],
        confidence: 0.9,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "orders please",
        dbs: [{ id: "db1", slug: "orders-tracker-a4f" }],
        recentTables: [rt("db1", "orders")],
      },
    );
    expect(route).toHaveBeenCalledTimes(1);
    expect(out.kind).toBe("query");
  });
});

describe("routeAsk — slug fast-path", () => {
  it("slug match pins targetDbId; LLM still decides kind", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "query",
        targetDbId: "WRONG_LLM_PICK",
        referencedTables: [],
        confidence: 0.5,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "what's in tracker today",
        dbs: [
          { id: "db1", slug: "orders-tracker-a4f" },
          { id: "db2", slug: "support-tickets-9xy" },
        ],
        recentTables: [],
      },
    );
    expect(route).toHaveBeenCalledTimes(1);
    // Slug pick wins over LLM's pick.
    expect(out.targetDbId).toBe("db1");
    expect(out.confidence).toBe(1);
    expect(out.reason).toBe("slug_match");
    // Kind comes from the LLM.
    expect(out.kind).toBe("query");
  });

  it("ambiguous slug match (multiple hits) → no override, LLM pick used", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "query",
        targetDbId: "db2",
        referencedTables: [],
        confidence: 0.85,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        // Both slugs share "tracker".
        goal: "what's in tracker",
        dbs: [
          { id: "db1", slug: "orders-tracker-a4f" },
          { id: "db2", slug: "leads-tracker-9xy" },
        ],
        recentTables: [],
      },
    );
    expect(out.targetDbId).toBe("db2");
    expect(out.reason).toBe("llm");
    expect(out.confidence).toBe(0.85);
  });

  it("slug match + LLM kind=create → no slug override (create has no targetDbId)", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "create",
        targetDbId: null,
        referencedTables: [],
        confidence: 0.9,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "make a new tracker for events",
        dbs: [{ id: "db1", slug: "orders-tracker-a4f" }],
        recentTables: [],
      },
    );
    expect(out.kind).toBe("create");
    expect(out.targetDbId).toBeNull();
    expect(out.referencedTables).toEqual([]);
  });
});

describe("routeAsk — LLM call", () => {
  it("passes goal + dbs + recentTables (projected) to llm.route", async () => {
    let captured: RouteRequest | undefined;
    const route = vi.fn(async (req: RouteRequest): Promise<RouteResponse> => {
      captured = req;
      return {
        kind: "query",
        targetDbId: "db1",
        referencedTables: ["orders"],
        confidence: 0.9,
        reason: "ok",
      };
    });
    await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "show recent",
        dbs: [{ id: "db1", slug: "no-match-here" }],
        recentTables: [{ dbId: "db1", slug: "no-match-here", table: "orders", touchedAt: 1 }],
      },
    );
    expect(captured?.goal).toBe("show recent");
    expect(captured?.dbs).toEqual([{ id: "db1", slug: "no-match-here" }]);
    // Stripped to {dbId, table} for the prompt.
    expect(captured?.recentTables).toEqual([{ dbId: "db1", table: "orders" }]);
  });

  it("LLM picks an unknown db id → returns null targetDbId with reason llm_picked_unknown_id", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "query",
        targetDbId: "ghost",
        referencedTables: ["orders"],
        confidence: 0.9,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "what's the total",
        dbs: [{ id: "db1", slug: "no-slug-words-here" }],
        recentTables: [],
      },
    );
    expect(out.targetDbId).toBeNull();
    expect(out.reason).toBe("llm_picked_unknown_id");
  });

  it("LLM kind=create returns referencedTables=[] regardless of LLM output", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "create",
        targetDbId: null,
        // LLM (incorrectly) emits non-empty list — caller should ignore it.
        referencedTables: ["should", "be", "stripped"],
        confidence: 0.95,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "a new database for messages",
        dbs: [{ id: "db1", slug: "no-slug-words-here" }],
        recentTables: [],
      },
    );
    expect(out.kind).toBe("create");
    expect(out.referencedTables).toEqual([]);
  });

  it("propagates LLM router errors so the caller can surface 502", async () => {
    const route = vi.fn(async () => {
      throw new Error("all providers failed");
    });
    await expect(
      routeAsk(
        { llm: llmStub({ route }) },
        { goal: "show anything", dbs: [{ id: "db1", slug: "x" }], recentTables: [] },
      ),
    ).rejects.toThrow("all providers failed");
  });

  it("low-confidence LLM pick is returned verbatim — handler enforces the floor", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "query",
        targetDbId: "db1",
        referencedTables: [],
        confidence: 0.5,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "what is the count",
        dbs: [
          { id: "db1", slug: "no-slug-words-here" },
          { id: "db2", slug: "totally-unrelated" },
        ],
        recentTables: [],
      },
    );
    expect(out.confidence).toBe(0.5);
    expect(out.targetDbId).toBe("db1");
  });

  it("the load-bearing case: 'insert red and blue tables' with no recent matches → LLM gets to pick create", async () => {
    // The whole point of SK-ASK-009: the LLM sees no `red` / `blue` in
    // recentTables and applies the prompt rule "unknown table → create".
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "create",
        targetDbId: null,
        referencedTables: [],
        confidence: 0.9,
        reason: "unknown_tables_means_create",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "insert red and blue tables",
        dbs: [{ id: "db1", slug: "totally-unrelated-zzz" }],
        // 'orders' present so step 2 doesn't short-circuit on 'red'/'blue'.
        recentTables: [rt("db1", "orders")],
      },
    );
    expect(out.kind).toBe("create");
    expect(out.targetDbId).toBeNull();
  });
});
