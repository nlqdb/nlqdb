// Unit tests for the goal-kind classifier. Uses a stub LLMRouter
// to verify the intent→kind mapping without live provider calls.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it } from "vitest";
import { classifyKind } from "./classifier.ts";

function stubLlm(intent: string, confidence = 0.9): LLMRouter {
  return {
    classify: async () => ({ intent: intent as never, confidence }),
    plan: async () => ({ sql: "" }),
    summarize: async () => ({ summary: "" }),
    schemaInfer: async () => ({ plan: {} }),
    disambiguate: async () => ({ chosenId: null, confidence: 0, reason: "stub" }),
  };
}

describe("classifyKind — LLM intent mapping", () => {
  it("maps 'create' intent → kind=create", async () => {
    const result = await classifyKind(stubLlm("create"), "a blog database");
    expect(result).toEqual({ kind: "create", confidence: 0.9, reason: "llm_classify" });
  });

  it("maps 'destructive' intent → kind=write", async () => {
    const result = await classifyKind(stubLlm("destructive"), "delete old records");
    expect(result).toEqual({ kind: "write", confidence: 0.9, reason: "llm_classify" });
  });

  it("maps 'data_query' intent → kind=query", async () => {
    const result = await classifyKind(stubLlm("data_query"), "how many orders today");
    expect(result).toEqual({ kind: "query", confidence: 0.9, reason: "llm_classify" });
  });

  it("maps 'meta' intent → kind=query", async () => {
    const result = await classifyKind(stubLlm("meta"), "what tables do I have");
    expect(result).toEqual({ kind: "query", confidence: 0.9, reason: "llm_classify" });
  });

  it("propagates LLM router errors so the caller can surface 502", async () => {
    const failing: LLMRouter = {
      classify: async () => {
        throw new Error("all providers failed");
      },
      plan: async () => ({ sql: "" }),
      summarize: async () => ({ summary: "" }),
      schemaInfer: async () => ({ plan: {} }),
      disambiguate: async () => ({ chosenId: null, confidence: 0, reason: "stub" }),
    };
    await expect(classifyKind(failing, "some goal")).rejects.toThrow("all providers failed");
  });
});
