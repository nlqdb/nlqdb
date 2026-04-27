// Chat surface types (Slice 10).
//
// `ChatMessage` is the row shape both directions of the wire — D1
// reads return it, the API responds with it, the UI renders it.
// Failure rows carry `errorStatus` + `errorMessage` instead of the
// success columns; one row never fills both groups (see migration
// 0005_chat_message.sql).

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  userId: string;
  role: ChatRole;
  dbId?: string;
  goal?: string;
  sql?: string;
  rows?: Record<string, unknown>[];
  rowCount?: number;
  cached?: boolean;
  summary?: string;
  errorStatus?: string;
  errorMessage?: string;
  createdAt: number;
};
