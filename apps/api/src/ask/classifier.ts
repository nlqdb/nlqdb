// Goal-kind classifier for the `/v1/ask` entrypoint. Decides
// `kind ∈ { "create", "query", "write" }` so the route handler can
// fan out: kind=create → typed-plan pipeline (apps/api/src/db-create/),
// kind=query/write → existing read/write orchestrator (./orchestrate.ts).
//
// Owners by skill: `.claude/skills/hosted-db-create/SKILL.md`
// SK-HDC-001 (one classifier-routed endpoint) and SK-ASK-001
// (`/v1/ask` is the single create-or-query endpoint).
//
// Uses the LLM router's `classify` operation (cheap tier — Groq 8B
// with Gemini/Workers-AI/OpenRouter fallback). The router handles
// retries across the provider chain; if all providers fail it throws
// and the route handler returns 502. This replaces the v0 keyword
// heuristic per SK-HDC-001's "cheap classifier-tier LLM call" spec.
//
// Design choice: when a request supplies an explicit `dbId`, the
// classifier is NOT called — the dbId pins the target db, and the only
// open question is query-vs-write. That branch lets the read/write
// orchestrator's existing intent classifier (LLMOperation `classify`)
// handle the destructive-vs-data triage. This classifier only runs on
// dbId-absent requests — see SK-HDC-005 for why dbId resolution is
// deterministic-per-surface, not LLM-guess.

import type { LLMRouter } from "@nlqdb/llm";

export type GoalKind = "create" | "query" | "write";

export type ClassifyKindResult = {
  kind: GoalKind;
  confidence: number;
  reason: string;
};

export async function classifyKind(llm: LLMRouter, goal: string): Promise<ClassifyKindResult> {
  const { intent, confidence } = await llm.classify({ utterance: goal });
  switch (intent) {
    case "create":
      return { kind: "create", confidence, reason: "llm_classify" };
    case "destructive":
      return { kind: "write", confidence, reason: "llm_classify" };
    default:
      return { kind: "query", confidence, reason: "llm_classify" };
  }
}
