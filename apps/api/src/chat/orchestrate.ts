// Chat-turn orchestrator (Slice 10). Pure function, deps injected —
// same pattern as `/v1/ask`'s orchestrateAsk so unit tests stay
// stub-driven (memory: ask-orchestrator-pattern).
//
// Flow per turn:
//   1. Persist the user's prompt as a `role=user` row (so the UI can
//      replay even if the ask call dies mid-flight).
//   2. Hand the goal+dbId to the injected `ask` (production wires
//      `orchestrateAsk` from src/ask/orchestrate.ts; tests pass a stub).
//   3. Persist the assistant reply — success row OR failure row,
//      depending on the ask outcome. The two row shapes never overlap.
//   4. Return both rows so the HTTP handler can echo them in one
//      response (no second round-trip from the UI).

import type { OrchestrateOutcome } from "../ask/orchestrate.ts";
import type { AskRequest } from "../ask/types.ts";
import type { ChatStore } from "./store.ts";
import type { ChatMessage } from "./types.ts";

export type PostChatRequest = {
  userId: string;
  goal: string;
  dbId: string;
};

export type PostChatResult = {
  user: ChatMessage;
  assistant: ChatMessage;
};

export type ChatDeps = {
  store: ChatStore;
  ask: (req: AskRequest) => Promise<OrchestrateOutcome>;
  now: () => number;
  newId: () => string;
};

export async function postChatMessage(
  deps: ChatDeps,
  req: PostChatRequest,
): Promise<PostChatResult> {
  const userMsg: ChatMessage = {
    id: deps.newId(),
    userId: req.userId,
    role: "user",
    dbId: req.dbId,
    goal: req.goal,
    createdAt: deps.now(),
  };
  await deps.store.append(userMsg);

  const outcome = await deps.ask({
    userId: req.userId,
    goal: req.goal,
    dbId: req.dbId,
  });

  const base: ChatMessage = {
    id: deps.newId(),
    userId: req.userId,
    role: "assistant",
    dbId: req.dbId,
    createdAt: deps.now(),
  };

  let assistantMsg: ChatMessage;
  if (outcome.ok) {
    assistantMsg = {
      ...base,
      sql: outcome.result.sql,
      rows: outcome.result.rows,
      rowCount: outcome.result.rowCount,
      cached: outcome.result.cached,
      ...(outcome.result.summary !== undefined ? { summary: outcome.result.summary } : {}),
    };
  } else {
    const errMsg = "message" in outcome.error ? outcome.error.message : undefined;
    assistantMsg = {
      ...base,
      errorStatus: outcome.error.status,
      ...(errMsg ? { errorMessage: errMsg } : {}),
    };
  }
  await deps.store.append(assistantMsg);

  return { user: userMsg, assistant: assistantMsg };
}
