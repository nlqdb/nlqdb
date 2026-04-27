// D1-backed chat-history store (Slice 10). One row per turn — see
// migration 0005_chat_message.sql for the column shape.
//
// Pure CRUD on `chat_message`. Tenant scoping enforced via the WHERE
// clause on `user_id` everywhere — there is no path where one user's
// userId returns another user's row.
//
// Ordering: `list()` orders by SQLite's implicit `rowid DESC` so the
// caller sees newest-first (capped at `limit`); we reverse to
// chronological for return so the renderer can append in order.
// `created_at` is informational; rowid is the authoritative sequence
// (it's monotonic per INSERT and tie-free, unlike Date.now()).

import type { AskError } from "../ask/types.ts";
import type { AssistantChatMessage, ChatMessage } from "./types.ts";

export type ChatStore = {
  append(msg: ChatMessage): Promise<void>;
  // `limit` defaults to 100 — about a screen's worth at typical chat
  // density. Older turns scroll off; full pagination is deferred.
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
  rows_truncated: number | null;
  cached: number | null;
  summary: string | null;
  error_status: string | null;
  error_message: string | null;
  created_at: number;
};

const DEFAULT_LIST_LIMIT = 100;

export function makeChatStore(d1: D1Database): ChatStore {
  return {
    append: async (msg) => {
      const flat = flattenMessage(msg);
      await d1
        .prepare(
          `INSERT INTO chat_message
            (id, user_id, role, db_id, goal, sql, rows_json, row_count, rows_truncated, cached, summary, error_status, error_message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          flat.id,
          flat.user_id,
          flat.role,
          flat.db_id,
          flat.goal,
          flat.sql,
          flat.rows_json,
          flat.row_count,
          flat.rows_truncated,
          flat.cached,
          flat.summary,
          flat.error_status,
          flat.error_message,
          flat.created_at,
        )
        .run();
    },
    list: async (userId, limit = DEFAULT_LIST_LIMIT) => {
      // ORDER BY rowid DESC: newest-first, tie-free (vs created_at
      // which can collide on same-millisecond pairs). Reverse client-
      // side so the renderer iterates oldest-to-newest.
      const result = await d1
        .prepare(
          `SELECT id, user_id, role, db_id, goal, sql, rows_json, row_count, rows_truncated, cached, summary, error_status, error_message, created_at
           FROM chat_message
           WHERE user_id = ?
           ORDER BY rowid DESC
           LIMIT ?`,
        )
        .bind(userId, limit)
        .all<Row>();
      const newestFirst = (result.results ?? []).map(rowToMessage);
      return newestFirst.reverse();
    },
  };
}

type FlatRow = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  db_id: string | null;
  goal: string | null;
  sql: string | null;
  rows_json: string | null;
  row_count: number | null;
  rows_truncated: number | null;
  cached: number | null;
  summary: string | null;
  error_status: string | null;
  error_message: string | null;
  created_at: number;
};

// Discriminated union → flat columns. The "two row shapes never
// overlap" invariant from the migration is preserved here: a `user`
// row never sets sql/rows_json/etc; a success row never sets
// error_*; an error row never sets sql/rows_json. Encoding this in
// one switch-on-role keeps the invariant local + auditable.
function flattenMessage(msg: ChatMessage): FlatRow {
  const base = {
    id: msg.id,
    user_id: msg.userId,
    db_id: msg.dbId,
    created_at: msg.createdAt,
    role: msg.role,
  };
  if (msg.role === "user") {
    return {
      ...base,
      role: "user",
      goal: msg.goal,
      sql: null,
      rows_json: null,
      row_count: null,
      rows_truncated: null,
      cached: null,
      summary: null,
      error_status: null,
      error_message: null,
    };
  }
  // assistant — narrow on result.kind
  if (msg.result.kind === "ok") {
    return {
      ...base,
      role: "assistant",
      goal: null,
      sql: msg.result.sql,
      rows_json: JSON.stringify(msg.result.rows),
      row_count: msg.result.rowCount,
      rows_truncated: msg.result.truncated ? 1 : 0,
      cached: msg.result.cached ? 1 : 0,
      summary: msg.result.summary ?? null,
      error_status: null,
      error_message: null,
    };
  }
  return {
    ...base,
    role: "assistant",
    goal: null,
    sql: null,
    rows_json: null,
    row_count: null,
    rows_truncated: null,
    cached: null,
    summary: null,
    error_status: msg.result.status,
    error_message: msg.result.message ?? null,
  };
}

function rowToMessage(row: Row): ChatMessage {
  const base = {
    id: row.id,
    userId: row.user_id,
    // db_id is NOT NULL in the app's invariant (every chat turn is
    // scoped to a database) but the column allows NULL for forward
    // compatibility. Coerce here so consumers don't carry the
    // optional through the codepath.
    dbId: row.db_id ?? "",
    createdAt: row.created_at,
  };
  if (row.role === "user") {
    return { ...base, role: "user", goal: row.goal ?? "" };
  }
  // assistant. Discriminate by error_status presence — a malformed
  // row (somehow both error and success columns set) takes the
  // error branch, since the user is owed an explanation, not a
  // half-rendered success.
  if (row.error_status !== null) {
    const result: AssistantChatMessage["result"] = {
      kind: "error",
      status: row.error_status as AskError["status"],
      ...(row.error_message !== null ? { message: row.error_message } : {}),
    };
    return { ...base, role: "assistant", result };
  }
  const result: AssistantChatMessage["result"] = {
    kind: "ok",
    sql: row.sql ?? "",
    rows: row.rows_json !== null ? safeParseRows(row.rows_json) : [],
    rowCount: row.row_count ?? 0,
    truncated: row.rows_truncated === 1,
    cached: row.cached === 1,
    ...(row.summary !== null ? { summary: row.summary } : {}),
  };
  return { ...base, role: "assistant", result };
}

// Defensive: a malformed `rows_json` (truncated write, manual edit)
// shouldn't make the entire history endpoint 500. Returns [] and lets
// the UI render an empty result for that one assistant turn. Logged
// to console.warn so `wrangler tail` surfaces the corruption — silent
// recovery would hide a real data-integrity bug.
function safeParseRows(json: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch (err) {
    console.warn("chat_store: rows_json parse failed", {
      length: json.length,
      preview: json.slice(0, 80),
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
