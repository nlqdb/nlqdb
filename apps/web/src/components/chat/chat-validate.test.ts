import { describe, expect, test } from "bun:test";

// `isValidMessage` is the shape gate at the boundary between persisted
// history (localStorage) and the live `Message[]` the chat panel
// renders. Schema drift across releases is permanent — older tabs
// hold older shapes — so any field a renderer dereferences must be
// validated here, or a render-time `.foo` access takes the island down.
//
// The "ok" branch was already covered by SK-WEB-001 (drop entries that
// lack `trace`). This file fills in the other persisted kinds.

import { matchesValidMessageShape as isValidMessage } from "./chat-validate.ts";

const baseAssistant = {
  id: "m1",
  role: "assistant" as const,
  reply: {
    id: "r1",
    goal: "show me sales",
    // `saveHistory` always writes `steps: []` — the gate requires an
    // array so older shapes (or hostile localStorage) get dropped.
    steps: [],
    state: {} as unknown,
  },
};

function withState(state: unknown): unknown {
  return { ...baseAssistant, reply: { ...baseAssistant.reply, state } };
}

describe("isValidMessage — user role", () => {
  test("accepts a well-formed user message", () => {
    expect(isValidMessage({ id: "u1", role: "user", goal: "show me sales" })).toBe(true);
  });

  test("rejects user message without goal", () => {
    expect(isValidMessage({ id: "u1", role: "user" })).toBe(false);
  });
});

describe("isValidMessage — created state", () => {
  test("accepts created with all required fields", () => {
    expect(
      isValidMessage(
        withState({
          kind: "created",
          displayName: "orders tracker",
          dbId: "db_1",
          tableCount: 3,
          sampleRowCount: 12,
        }),
      ),
    ).toBe(true);
  });

  test("rejects created missing displayName", () => {
    expect(
      isValidMessage(
        withState({ kind: "created", dbId: "db_1", tableCount: 3, sampleRowCount: 12 }),
      ),
    ).toBe(false);
  });

  test("rejects created with non-numeric tableCount", () => {
    expect(
      isValidMessage(
        withState({
          kind: "created",
          displayName: "orders",
          dbId: "db_1",
          tableCount: "3",
          sampleRowCount: 12,
        }),
      ),
    ).toBe(false);
  });

  test("rejects created missing sampleRowCount", () => {
    expect(
      isValidMessage(
        withState({ kind: "created", displayName: "orders", dbId: "db_1", tableCount: 3 }),
      ),
    ).toBe(false);
  });
});

describe("isValidMessage — ambiguous state", () => {
  test("accepts ambiguous with valid candidates", () => {
    expect(
      isValidMessage(
        withState({
          kind: "ambiguous",
          reason: "two databases matched",
          candidates: [
            { id: "db_1", slug: "orders" },
            { id: "db_2", slug: "billing" },
          ],
        }),
      ),
    ).toBe(true);
  });

  test("accepts ambiguous with empty candidates array", () => {
    expect(isValidMessage(withState({ kind: "ambiguous", reason: "", candidates: [] }))).toBe(true);
  });

  test("rejects ambiguous when candidates isn't an array", () => {
    expect(isValidMessage(withState({ kind: "ambiguous", reason: "x", candidates: null }))).toBe(
      false,
    );
  });

  test("rejects ambiguous when a candidate is missing slug", () => {
    expect(
      isValidMessage(withState({ kind: "ambiguous", reason: "x", candidates: [{ id: "db_1" }] })),
    ).toBe(false);
  });

  test("rejects ambiguous when reason isn't a string", () => {
    expect(
      isValidMessage(
        withState({ kind: "ambiguous", reason: null, candidates: [{ id: "db_1", slug: "x" }] }),
      ),
    ).toBe(false);
  });
});

describe("isValidMessage — clarify state", () => {
  test("accepts clarify with null pinnedDb", () => {
    expect(isValidMessage(withState({ kind: "clarify", pinnedDb: null }))).toBe(true);
  });

  test("accepts clarify with a well-formed pinnedDb", () => {
    expect(
      isValidMessage(withState({ kind: "clarify", pinnedDb: { id: "db_1", slug: "orders" } })),
    ).toBe(true);
  });

  test("rejects clarify with malformed pinnedDb (missing slug)", () => {
    expect(isValidMessage(withState({ kind: "clarify", pinnedDb: { id: "db_1" } }))).toBe(false);
  });

  test("rejects clarify when pinnedDb is an array", () => {
    expect(isValidMessage(withState({ kind: "clarify", pinnedDb: [] }))).toBe(false);
  });
});

describe("isValidMessage — other kinds", () => {
  test("accepts ok with a trace block carrying plan_id", () => {
    expect(
      isValidMessage(
        withState({ kind: "ok", ok: { trace: { sql: "SELECT 1", plan_id: "p_abc" } } }),
      ),
    ).toBe(true);
  });

  test("rejects ok without trace", () => {
    expect(isValidMessage(withState({ kind: "ok", ok: {} }))).toBe(false);
  });

  test("rejects ok whose trace block lacks plan_id", () => {
    expect(isValidMessage(withState({ kind: "ok", ok: { trace: { sql: "SELECT 1" } } }))).toBe(
      false,
    );
  });

  test("accepts pending", () => {
    expect(isValidMessage(withState({ kind: "pending" }))).toBe(true);
  });

  test("accepts error with a message", () => {
    expect(isValidMessage(withState({ kind: "error", message: "boom" }))).toBe(true);
  });

  test("rejects error without message", () => {
    expect(isValidMessage(withState({ kind: "error" }))).toBe(false);
  });

  test("accepts feature_gated with message, waitlistUrl and numeric gate targets", () => {
    expect(
      isValidMessage(
        withState({
          kind: "feature_gated",
          message: "pre-alpha",
          waitlistUrl: "https://nlqdb.com/#waitlist",
          gate: {
            bird_accuracy: 0.318,
            spider_accuracy: null,
            bird_target: 0.65,
            spider_target: 0.75,
            measured_at: "2026-05-18T22:42:29.917Z",
          },
        }),
      ),
    ).toBe(true);
  });

  test("rejects feature_gated missing gate targets", () => {
    expect(
      isValidMessage(
        withState({
          kind: "feature_gated",
          message: "x",
          waitlistUrl: "https://nlqdb.com/#waitlist",
          gate: { bird_accuracy: null, spider_accuracy: null },
        }),
      ),
    ).toBe(false);
  });

  test("rejects feature_gated with non-numeric accuracy that would crash .toFixed", () => {
    expect(
      isValidMessage(
        withState({
          kind: "feature_gated",
          message: "x",
          waitlistUrl: "https://nlqdb.com/#waitlist",
          gate: {
            bird_accuracy: "broken",
            spider_accuracy: null,
            bird_target: 0.65,
            spider_target: 0.75,
            measured_at: "2026-05-18T22:42:29.917Z",
          },
        }),
      ),
    ).toBe(false);
  });

  test("rejects unknown kind so a future state isn't silently kept", () => {
    expect(isValidMessage(withState({ kind: "future-state" }))).toBe(false);
  });
});

describe("isValidMessage — reply.steps", () => {
  // `saveHistory` writes `steps: []`. The validator's job is to drop
  // hostile / older-build shapes where `steps` is missing or not an
  // array — `Trace.tsx` would crash on `.length` / `.map` otherwise.
  const okState = { kind: "ok", ok: { trace: { sql: "SELECT 1", plan_id: "p_abc" } } };

  test("rejects assistant message whose reply.steps is missing", () => {
    expect(
      isValidMessage({
        id: "m1",
        role: "assistant",
        reply: { id: "r1", goal: "x", state: okState },
      }),
    ).toBe(false);
  });

  test("rejects assistant message whose reply.steps is not an array", () => {
    expect(
      isValidMessage({
        id: "m1",
        role: "assistant",
        reply: { id: "r1", goal: "x", steps: "not-array", state: okState },
      }),
    ).toBe(false);
  });

  test("accepts assistant message with reply.steps = []", () => {
    expect(
      isValidMessage({
        id: "m1",
        role: "assistant",
        reply: { id: "r1", goal: "x", steps: [], state: okState },
      }),
    ).toBe(true);
  });
});
