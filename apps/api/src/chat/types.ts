// Chat surface types (Slice 10).
//
// Discriminated union: every row in `chat_message` is exactly one of
// three shapes. The compiler (and the renderer) can narrow on `role`
// + `result.kind` instead of dereferencing optionals everywhere.
//
//   user        — the prompt the user sent
//   assistant + result: success — orchestrator returned rows
//   assistant + result: error   — orchestrator returned an AskError
//
// Persistence (chat/store.ts) flattens these to nullable columns;
// reads inflate them back. The flat row shape is internal — every
// caller works with `ChatMessage` directly.

import type { AskError } from "../ask/types.ts";

type ChatMessageBase = {
  id: string;
  userId: string;
  dbId: string;
  // Milliseconds since epoch (Date.now()). Display only — never use
  // for sequence ordering; rely on insertion order via rowid.
  createdAt: number;
};

export type UserChatMessage = ChatMessageBase & {
  role: "user";
  goal: string;
};

export type AssistantSuccess = {
  kind: "ok";
  sql: string;
  // Capped at MAX_PERSIST_ROWS (chat/orchestrate.ts); `truncated`
  // tells the renderer whether to caveat the row count.
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  cached: boolean;
  summary?: string;
};

export type AssistantError = {
  kind: "error";
  // Mirrored from AskError["status"]. Keeps the renderer narrowing
  // off this string instead of inferring from absence-of-fields.
  status: AskError["status"];
  message?: string;
};

export type AssistantChatMessage = ChatMessageBase & {
  role: "assistant";
  result: AssistantSuccess | AssistantError;
};

export type ChatMessage = UserChatMessage | AssistantChatMessage;
