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

  it("recent-table substring without a verb → kind=query deterministically, no LLM call", async () => {
    // A bare reference to a table the user already has ("members", "orders")
    // is a read — it must not fall through to the LLM's "unknown table →
    // create" bias and dead-end on the create-a-new-DB clarify.
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "orders please",
        dbs: [{ id: "db1", slug: "orders-tracker-a4f" }],
        recentTables: [rt("db1", "orders")],
      },
    );
    expect(out.kind).toBe("query");
    expect(out.targetDbId).toBe("db1");
    expect(out.reason).toBe("recent_table_match");
    expect(route).not.toHaveBeenCalled();
  });

  it("singular goal matches a plural recent table (member → members) + verb → write, no LLM call", async () => {
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "add a member drogo",
        dbs: [{ id: "db1", slug: "members-a4f" }],
        recentTables: [rt("db1", "members")],
      },
    );
    expect(out.kind).toBe("write");
    expect(out.targetDbId).toBe("db1");
    expect(out.referencedTables).toEqual(["members"]);
    expect(out.reason).toBe("recent_table_match");
    expect(route).not.toHaveBeenCalled();
  });

  it("plural goal matches a singular recent table (categories → category)", async () => {
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "show me the categories",
        dbs: [{ id: "db1", slug: "catalog-a4f" }],
        recentTables: [rt("db1", "category")],
      },
    );
    expect(out.kind).toBe("query");
    expect(out.referencedTables).toEqual(["category"]);
    expect(route).not.toHaveBeenCalled();
  });
});

describe("routeAsk — pinned-DB write fast-path (GLOBAL-041 Phase A)", () => {
  it("pinned dbId + write verb + unobserved table → kind=write, no LLM, no clarify", async () => {
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        // `ratings` is not in recentTables — the schema hasn't observed it,
        // and the goal names no observed table, so step 2 misses.
        goal: "add a rating of 5 stars",
        dbs: [{ id: "db1", slug: "rateme12-a4f" }],
        recentTables: [rt("db1", "restaurants")],
        pinnedDbId: "db1",
      },
    );
    expect(out).toEqual({
      kind: "write",
      targetDbId: "db1",
      referencedTables: [],
      confidence: 1,
      reason: "pinned_write",
    });
    // The whole point: the create/query clarify never fires and no LLM hop
    // is burned — the pinned unobserved-table write auto-widens.
    expect(route).not.toHaveBeenCalled();
  });

  it("pinned dbId with NO write verb (create-shaped goal) falls through to the LLM → clarify preserved (SK-ASK-014)", async () => {
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
        goal: "a books tracker",
        dbs: [{ id: "db1", slug: "rateme12-a4f" }],
        recentTables: [rt("db1", "restaurants")],
        pinnedDbId: "db1",
      },
    );
    // Verb-gated: no write verb ⇒ still classified create, so index.ts keeps
    // the SK-ASK-014 create/query clarify for a genuine new-DB request.
    expect(out.kind).toBe("create");
    expect(route).toHaveBeenCalledTimes(1);
  });

  it("write verb but the pinned dbId is not a candidate → no fast-path (falls through to the LLM)", async () => {
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "write",
        targetDbId: "db1",
        referencedTables: [],
        confidence: 0.8,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      {
        goal: "add a rating for restaurant 12",
        dbs: [{ id: "db1", slug: "rateme12-a4f" }],
        recentTables: [],
        pinnedDbId: "not-a-real-db",
      },
    );
    expect(out.reason).not.toBe("pinned_write");
    expect(route).toHaveBeenCalledTimes(1);
  });
});

describe("routeAsk — natural insert verbs route pinned_write (GLOBAL-041 Phase A, KPI 1)", () => {
  // The live KPI-1 walk (tools/eval/src/kpi1-live-walk.ts WALK_SHAPES) read
  // 0/5 on prod (run 218): the 5 dogfood shapes lead with natural insert verbs
  // (Record/Store/Save/Register) that the engine's write-verb list excluded, so
  // pinned_write never fired and each dead-ended on the SK-ASK-014 clarify.
  // These cases prove the fix deterministically (the live call can't run from
  // this session). Kept in sync with WALK_SHAPES — a new shape adds a row here.

  // A pinned DB whose observed table is unrelated, so step 2 (recent-table)
  // misses and the unobserved-table write reaches the pinned_write fast-path.
  const pinnedInput = (goal: string) => ({
    goal,
    dbs: [{ id: "db1", slug: "rateme12-a4f" }],
    recentTables: [rt("db1", "restaurants")],
    pinnedDbId: "db1",
  });

  it.each([
    ["record", "Record a rating in the ratings table for a profile"],
    ["store", "Store a review body in the reviews table"],
    ["save", "Save a leaderboard snapshot in the leaderboard_snapshots table"],
    ["register", "Register an app end-user in the app_users table"],
    ["log", "Log a moderation event in the moderation_events table"],
  ])("natural insert verb %s → kind=write reason=pinned_write, no LLM", async (_verb, goal) => {
    const route = vi.fn();
    const out = await routeAsk({ llm: llmStub({ route }) }, pinnedInput(goal));
    expect(out.kind).toBe("write");
    expect(out.reason).toBe("pinned_write");
    expect(out.targetDbId).toBe("db1");
    expect(route).not.toHaveBeenCalled();
  });

  it("regression: a leading insert verb wins over incidental query nouns (star count / which profile)", async () => {
    // The exact WALK_SHAPES `new-table` goal — it contains "count" (twice) and
    // "which", both QUERY_VERBS, as ordinary nouns/pronouns. A naive
    // any-query-verb-wins precedence would misclassify this write as a read.
    const route = vi.fn();
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      pinnedInput(
        "Record a rating in the ratings table: a rater gives a profile a star count from 1 to 5. Store the rating id, which profile it targets, and the star count.",
      ),
    );
    expect(out.kind).toBe("write");
    expect(out.reason).toBe("pinned_write");
    expect(route).not.toHaveBeenCalled();
  });

  it("a leading query verb keeps a read a read even when a soft-write verb follows", async () => {
    // "show me the record" — `record` is a soft-write noun here; the leading
    // `show` must win so a read against the pin doesn't misroute to write.
    const route = vi.fn(
      async (): Promise<RouteResponse> => ({
        kind: "query",
        targetDbId: "db1",
        referencedTables: [],
        confidence: 0.9,
        reason: "ok",
      }),
    );
    const out = await routeAsk(
      { llm: llmStub({ route }) },
      pinnedInput("show me the record for profile 12"),
    );
    // Not the deterministic pinned_write fast-path — it falls through to the LLM.
    expect(out.reason).not.toBe("pinned_write");
    expect(route).toHaveBeenCalledTimes(1);
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
