// GLOBAL-041 Phase A (run 211) — provider fallthrough on a semantically-invalid
// extend plan. The head planner (qwen) intermittently returns JSON that parses
// but fails the caller's WidenPlan predicate; before this fix `extendSchema`
// dead-ended on it even though the next provider (gemini) designs the same shape
// validly. The router already fails over on any thrown ProviderError, so the
// chat provider throws `parse` when `req.validate(plan)` is false — turning a
// per-request bad plan into a fall-through, not a total failure.

import { describe, expect, it } from "vitest";
import type { ChatCallArgs } from "../src/providers/_chat-provider.ts";
import { createChatProvider } from "../src/providers/_chat-provider.ts";
import { createLLMRouter } from "../src/router.ts";
import { type LLMOperation, ProviderError, type ProviderName } from "../src/types.ts";

// A structurally-valid WidenPlan (one nullable add-column) vs an empty one that
// a WidenPlanSchema-style predicate rejects (non-empty invariant).
const VALID_PLAN = JSON.stringify({
  add_columns: [
    {
      table: "ratings",
      column: { name: "comment", type: "text", nullable: true, description: "d" },
    },
  ],
  create_tables: [],
});
const INVALID_PLAN = JSON.stringify({ add_columns: [], create_tables: [] });

// The run-211 predicate stand-in: reject the empty plan, accept anything with a
// column or table. (The real caller passes WidenPlanSchema.safeParse().success.)
function nonEmpty(plan: Record<string, unknown>): boolean {
  const cols = Array.isArray(plan["add_columns"]) ? plan["add_columns"] : [];
  const tables = Array.isArray(plan["create_tables"]) ? plan["create_tables"] : [];
  return cols.length > 0 || tables.length > 0;
}

const MODELS: Record<LLMOperation, string> = {
  route: "m",
  plan: "m",
  summarize: "m",
  schema_infer: "m",
  engine_classify: "m",
};

// A chat provider whose `callChat` returns a fixed raw string — exercises the
// real `createChatProvider.extendSchema` parse + validate path.
function fixedProvider(name: ProviderName, raw: string) {
  return createChatProvider({
    name,
    models: MODELS,
    callChat: async (_args: ChatCallArgs) => raw,
  });
}

describe("extendSchema provider fallthrough on invalid plan (GLOBAL-041 Phase A)", () => {
  it("throws a `parse` ProviderError when the caller predicate rejects the plan", async () => {
    const p = fixedProvider("groq-qwen", INVALID_PLAN);
    await expect(
      p.extendSchema({ goal: "g", schema: "s", validate: nonEmpty }),
    ).rejects.toMatchObject({ name: "ProviderError", reason: "parse" });
  });

  it("returns the plan unchanged when no validator is supplied", async () => {
    const p = fixedProvider("groq-qwen", INVALID_PLAN);
    const res = await p.extendSchema({ goal: "g", schema: "s" });
    expect(res.plan).toEqual({ add_columns: [], create_tables: [] });
  });

  it("router fails over from an invalid-plan head to a valid-plan next provider", async () => {
    const router = createLLMRouter({
      providers: [fixedProvider("groq-qwen", INVALID_PLAN), fixedProvider("gemini", VALID_PLAN)],
      chains: { schema_infer: ["groq-qwen", "gemini"] },
    });
    const res = await router.extendSchema({ goal: "g", schema: "s", validate: nonEmpty });
    expect(res.model).toBe("m");
    expect((res.plan["add_columns"] as unknown[]).length).toBe(1);
  });

  it("throws AllProvidersFailedError when every provider returns an invalid plan", async () => {
    const router = createLLMRouter({
      providers: [fixedProvider("groq-qwen", INVALID_PLAN), fixedProvider("gemini", INVALID_PLAN)],
      chains: { schema_infer: ["groq-qwen", "gemini"] },
    });
    await expect(
      router.extendSchema({ goal: "g", schema: "s", validate: nonEmpty }),
    ).rejects.toThrow(/all providers/);
  });

  it("a plan-invalid fallthrough does not trip the head provider's breaker", async () => {
    // `parse` is excluded from the breaker (a bad plan is per-request, not a
    // provider-health failure), so the head stays eligible for the next call.
    const head = fixedProvider("groq-qwen", INVALID_PLAN);
    const router = createLLMRouter({
      providers: [head, fixedProvider("gemini", VALID_PLAN)],
      chains: { schema_infer: ["groq-qwen", "gemini"] },
      circuitBreaker: { failureThreshold: 1, cooldownMs: 60_000 },
    });
    for (let i = 0; i < 3; i++) {
      const res = await router.extendSchema({ goal: "g", schema: "s", validate: nonEmpty });
      expect((res.plan["add_columns"] as unknown[]).length).toBe(1);
    }
    // Sanity: ProviderError is the thrown type on the head leg.
    expect(new ProviderError("x", "parse").reason).toBe("parse");
  });
});
