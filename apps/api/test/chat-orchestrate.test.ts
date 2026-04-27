// Unit tests for the chat-turn orchestrator (Slice 10). Stubbed
// store + ask, so failures point at the persistence/wrapping logic
// rather than the underlying /v1/ask pipeline.

import { describe, expect, it, vi } from "vitest";
import type { OrchestrateOutcome } from "../src/ask/orchestrate.ts";
import type { AskRequest } from "../src/ask/types.ts";
import { type ChatDeps, postChatMessage } from "../src/chat/orchestrate.ts";
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

describe("postChatMessage", () => {
  it("persists user row, calls ask, persists assistant success row, returns both", async () => {
    const ask = vi.fn(
      async () =>
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
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);

    const out = await postChatMessage(deps, {
      userId: "u_1",
      goal: "show me one",
      dbId: "db_a",
    });

    // Two rows persisted in order: user, assistant.
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
      sql: "SELECT 1",
      rowCount: 1,
      cached: false,
      summary: "one row",
    });
    expect(deps.store.rows[1]?.rows).toEqual([{ x: 1 }]);

    // Returned shape matches what was persisted.
    expect(out.user).toBe(deps.store.rows[0]);
    expect(out.assistant).toBe(deps.store.rows[1]);

    // Ask was called with the right user/db/goal triple.
    expect(ask).toHaveBeenCalledWith({
      userId: "u_1",
      goal: "show me one",
      dbId: "db_a",
    });
  });

  it("persists an assistant error row when ask fails", async () => {
    const ask = vi.fn(
      async () =>
        ({
          ok: false,
          error: { status: "rate_limited", limit: 60, count: 61 },
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);

    const out = await postChatMessage(deps, {
      userId: "u_1",
      goal: "anything",
      dbId: "db_a",
    });

    expect(deps.store.rows).toHaveLength(2);
    expect(out.assistant.errorStatus).toBe("rate_limited");
    expect(out.assistant.sql).toBeUndefined();
    expect(out.assistant.rows).toBeUndefined();
  });

  it("propagates the error message when the AskError carries one", async () => {
    const ask = vi.fn(
      async () =>
        ({
          ok: false,
          error: { status: "db_unreachable", message: "connection refused" },
        }) satisfies OrchestrateOutcome,
    );
    const deps = makeDeps(ask);
    const out = await postChatMessage(deps, {
      userId: "u_1",
      goal: "x",
      dbId: "db_a",
    });
    expect(out.assistant.errorStatus).toBe("db_unreachable");
    expect(out.assistant.errorMessage).toBe("connection refused");
  });

  it("omits summary on the assistant row when ask returned none (skipSummary path)", async () => {
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
    const out = await postChatMessage(deps, {
      userId: "u_1",
      goal: "x",
      dbId: "db_a",
    });
    expect(out.assistant.summary).toBeUndefined();
    expect(out.assistant.cached).toBe(true);
  });

  it("persists the user row before invoking ask (so a thrown ask still leaves history)", async () => {
    const order: string[] = [];
    const store: ChatStore = {
      append: vi.fn(async (msg) => {
        order.push(`append:${msg.role}`);
      }),
      list: vi.fn(async () => []),
    };
    const ask = vi.fn(async () => {
      order.push("ask");
      return {
        ok: true,
        result: {
          status: "ok" as const,
          cached: false,
          sql: "SELECT 1",
          rows: [],
          rowCount: 0,
        },
      } satisfies OrchestrateOutcome;
    });
    const deps: ChatDeps = {
      store,
      ask,
      now: () => 0,
      newId: () => "id",
    };
    await postChatMessage(deps, { userId: "u_1", goal: "x", dbId: "db_a" });
    expect(order).toEqual(["append:user", "ask", "append:assistant"]);
  });
});
