// Unit tests for the chat-turn orchestrator (Slice 10). Stubbed
// store + ask, so failures point at the persistence/wrapping logic
// rather than the underlying /v1/ask pipeline.
//
// Persist-vs-reject policy is the core invariant under test: a
// `rate_limited` or `db_not_found` outcome must NOT write to the
// store; everything else must. See PR #45 review (E1).

import { describe, expect, it, vi } from "vitest";
import type { OrchestrateOutcome } from "../src/ask/orchestrate.ts";
import type { AskRequest } from "../src/ask/types.ts";
import { type ChatDeps, MAX_PERSIST_ROWS, postChatMessage } from "../src/chat/orchestrate.ts";
import type { ChatStore } from "../src/chat/store.ts";
import type { ChatMessage } from "../src/chat/types.ts";

function makeStore(): ChatStore & { rows: ChatMessage[] } {
  const rows: ChatMessage[] = [];
  return {
    rows,
    append: vi.fn(async (msg: ChatMessage) => {
      rows.push(msg);
    }),
    list: vi.fn(async () => rows),
  };
}

type Deps = ChatDeps & { store: ChatStore & { rows: ChatMessage[] } };

function makeDeps(ask: (req: AskRequest) => Promise<OrchestrateOutcome>): Deps {
  const store = makeStore();
  let n = 0;
  return {
    store,
    ask,
    now: () => 1700000000000 + n * 1000,
    newId: () => `id_${++n}`,
  };
}

const successOutcome = () =>
  ({
    ok: true,
    result: {
      status: "ok" as const,
      cached: false,
      sql: "SELECT 1",
      rows: [{ x: 1 }],
      rowCount: 1,
      summary: "one row",
    },
  }) satisfies OrchestrateOutcome;

describe("postChatMessage — persist path", () => {
  it("persists user + assistant rows on success and returns both", async () => {
    const ask = vi.fn(async () => successOutcome());
    const deps = makeDeps(ask);

    const out = await postChatMessage(deps, {
      userId: "u_1",
      goal: "show me one",
      dbId: "db_a",
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(deps.store.rows).toHaveLength(2);
    expect(deps.store.rows[0]).toMatchObject({
      role: "user",
      userId: "u_1",
      goal: "show me one",
      dbId: "db_a",
    });
    expect(deps.store.rows[1]).toMatchObject({
      role: "assistant",
      userId: "u_1",
      dbId: "db_a",
    });
    const assistant = deps.store.rows[1];
    if (assistant?.role !== "assistant") throw new Error("expected assistant row");
    expect(assistant.result.kind).toBe("ok");
    if (assistant.result.kind !== "ok") return;
    expect(assistant.result.sql).toBe("SELECT 1");
    expect(assistant.result.rowCount).toBe(1);
    expect(assistant.result.cached).toBe(false);
    expect(assistant.result.truncated).toBe(false);
    expect(assistant.result.summary).toBe("one row");
    expect(assistant.result.rows).toEqual([{ x: 1 }]);

    expect(out.user).toBe(deps.store.rows[0]);
    expect(out.assistant).toBe(deps.store.rows[1]);
    expect(ask).toHaveBeenCalledWith({
      userId: "u_1",
      goal: "show me one",
      dbId: "db_a",
    });
  });

  it("caps persisted rows at MAX_PERSIST_ROWS and sets truncated=true", async () => {
    const big = Array.from({ length: MAX_PERSIST_ROWS + 25 }, (_, i) => ({ i }));
    const ask = vi.fn(
      async () =>
        ({
          ok: true,
          result: {
            status: "ok" as const,
            cached: false,
            sql: "SELECT *",
            rows: big,
            rowCount: big.length,
          },
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);
    const out = await postChatMessage(deps, { userId: "u_1", goal: "x", dbId: "db_a" });
    if (!out.ok || out.assistant.result.kind !== "ok") {
      throw new Error("expected persisted success");
    }
    expect(out.assistant.result.rows).toHaveLength(MAX_PERSIST_ROWS);
    expect(out.assistant.result.rowCount).toBe(big.length);
    expect(out.assistant.result.truncated).toBe(true);
  });

  it("persists an assistant error row on post-execute failures (e.g. db_unreachable)", async () => {
    const ask = vi.fn(
      async () =>
        ({
          ok: false,
          error: { status: "db_unreachable", message: "connection refused" },
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);
    const out = await postChatMessage(deps, { userId: "u_1", goal: "x", dbId: "db_a" });
    if (!out.ok || out.assistant.result.kind !== "error") {
      throw new Error("expected persisted error");
    }
    expect(deps.store.rows).toHaveLength(2);
    expect(out.assistant.result.status).toBe("db_unreachable");
    expect(out.assistant.result.message).toBe("connection refused");
  });

  it("persists with no summary when ask omitted one (skipSummary path)", async () => {
    const ask = vi.fn(
      async () =>
        ({
          ok: true,
          result: {
            status: "ok" as const,
            cached: true,
            sql: "SELECT 1",
            rows: [],
            rowCount: 0,
          },
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);
    const out = await postChatMessage(deps, { userId: "u_1", goal: "x", dbId: "db_a" });
    if (!out.ok || out.assistant.result.kind !== "ok") {
      throw new Error("expected persisted success");
    }
    expect(out.assistant.result.summary).toBeUndefined();
    expect(out.assistant.result.cached).toBe(true);
  });

  it("persists a synthetic error row when the ask call throws (defense in depth)", async () => {
    const ask = vi.fn(async () => {
      throw new Error("planet on fire");
    });
    const deps = makeDeps(ask);
    const out = await postChatMessage(deps, { userId: "u_1", goal: "x", dbId: "db_a" });
    if (!out.ok || out.assistant.result.kind !== "error") {
      throw new Error("expected persisted error");
    }
    // Synthetic error uses `llm_failed` so it routes to the existing
    // `errorStatus()` mapper without a new variant.
    expect(out.assistant.result.status).toBe("llm_failed");
    expect(out.assistant.result.message).toMatch(/planet on fire/);
  });
});

describe("postChatMessage — reject path (no persist)", () => {
  it("returns Rejected without writing anything when rate_limited", async () => {
    const ask = vi.fn(
      async () =>
        ({
          ok: false,
          error: { status: "rate_limited" as const, limit: 60, count: 61 },
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);
    const out = await postChatMessage(deps, { userId: "u_1", goal: "x", dbId: "db_a" });

    expect(out.ok).toBe(false);
    expect(deps.store.rows).toHaveLength(0); // critical: no DB write
    expect(deps.store.append).not.toHaveBeenCalled();
    if (out.ok) return;
    expect(out.error.status).toBe("rate_limited");
  });

  it("returns Rejected without writing anything when db_not_found", async () => {
    const ask = vi.fn(
      async () =>
        ({
          ok: false,
          error: { status: "db_not_found" as const },
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);
    const out = await postChatMessage(deps, {
      userId: "u_1",
      goal: "x",
      dbId: "db_typo",
    });
    expect(out.ok).toBe(false);
    expect(deps.store.rows).toHaveLength(0);
  });

  it("does NOT reject for sql_rejected, db_unreachable, llm_failed, schema_unavailable, db_misconfigured", async () => {
    const persistableErrors = [
      { status: "sql_rejected" as const, reason: "DELETE without WHERE" },
      { status: "db_unreachable" as const, message: "neon down" },
      { status: "llm_failed" as const, message: "groq timeout" },
      { status: "schema_unavailable" as const },
      { status: "db_misconfigured" as const, message: "secret_ref unbound" },
    ];
    for (const error of persistableErrors) {
      const deps = makeDeps(async () => ({ ok: false, error }) satisfies OrchestrateOutcome);
      const out = await postChatMessage(deps, {
        userId: "u_1",
        goal: "x",
        dbId: "db_a",
      });
      expect(out.ok).toBe(true);
      expect(deps.store.rows).toHaveLength(2);
    }
  });
});
