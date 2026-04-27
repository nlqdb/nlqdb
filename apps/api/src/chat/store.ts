// D1-backed chat-history store (Slice 10). One row per turn — see
// migration 0005_chat_message.sql for the column shape.
//
// Pure CRUD on `chat_message`. Tenant scoping enforced via the WHERE
// clause on `user_id` everywhere — there is no path where one user's
// userId returns another user's row.

import type { ChatMessage } from "./types.ts";

export type ChatStore = {
  append(msg: ChatMessage): Promise<void>;
  list(userId: string, limit?: number): Promise<ChatMessage[]>;
};

type Row = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  db_id: string | null;
  goal: string | null;
  sql: string | null;
  rows_json: string | null;
  row_count: number | null;
  cached: number | null;
  summary: string | null;
  error_status: string | null;
  error_message: string | null;
  created_at: number;
};

export function makeChatStore(d1: D1Database): ChatStore {
  return {
    append: async (msg) => {
      await d1
        .prepare(
          `INSERT INTO chat_message
            (id, user_id, role, db_id, goal, sql, rows_json, row_count, cached, summary, error_status, error_message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          msg.id,
          msg.userId,
          msg.role,
          msg.dbId ?? null,
          msg.goal ?? null,
          msg.sql ?? null,
          msg.rows ? JSON.stringify(msg.rows) : null,
          msg.rowCount ?? null,
          msg.cached === undefined ? null : msg.cached ? 1 : 0,
          msg.summary ?? null,
          msg.errorStatus ?? null,
          msg.errorMessage ?? null,
          msg.createdAt,
        )
        .run();
    },
    list: async (userId, limit = 100) => {
      const result = await d1
        .prepare(
          `SELECT id, user_id, role, db_id, goal, sql, rows_json, row_count, cached, summary, error_status, error_message, created_at
           FROM chat_message
           WHERE user_id = ?
           ORDER BY created_at ASC, id ASC
           LIMIT ?`,
        )
        .bind(userId, limit)
        .all<Row>();
      return (result.results ?? []).map(rowToMessage);
    },
  };
}

function rowToMessage(row: Row): ChatMessage {
  const msg: ChatMessage = {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
  };
  if (row.db_id !== null) msg.dbId = row.db_id;
  if (row.goal !== null) msg.goal = row.goal;
  if (row.sql !== null) msg.sql = row.sql;
  if (row.rows_json !== null) msg.rows = safeParseRows(row.rows_json);
  if (row.row_count !== null) msg.rowCount = row.row_count;
  if (row.cached !== null) msg.cached = row.cached === 1;
  if (row.summary !== null) msg.summary = row.summary;
  if (row.error_status !== null) msg.errorStatus = row.error_status;
  if (row.error_message !== null) msg.errorMessage = row.error_message;
  return msg;
}

// Defensive: a malformed `rows_json` (truncated write, manual edit)
// shouldn't make the entire history endpoint 500. Returns [] and lets
// the UI render an empty result for that one assistant turn.
function safeParseRows(json: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}
