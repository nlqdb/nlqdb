-- Slice 10 — chat history (DESIGN §3.2 "Signed-in surface").
--
-- One row per turn (user prompt or assistant reply). The /app chat UI
-- replays this on load and appends new turns as the user sends them.
-- Per-user, no thread concept — Slice 10 ships a single rolling
-- conversation; multi-thread / per-DB scoping waits for Phase 1's
-- "anonymous DB → adopted DB" flow (DESIGN §4.1).
--
-- Snake-case + INTEGER unixepoch() — matches the convention for tables
-- this repo owns (databases, rate_limit_buckets, stripe_events). The
-- camelCase `user(id)` FK target is Better Auth's territory; SQLite
-- identifiers are case-insensitive when unquoted, so the cross-style
-- reference resolves cleanly.
--
-- Assistant rows store either the success columns (sql, rows_json,
-- row_count, cached, summary) OR the failure columns (error_status,
-- error_message). Both nullable — a row never fills both groups. The
-- check constraint on `role` keeps this enum honest at the DB layer.

CREATE TABLE chat_message (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  db_id TEXT,
  goal TEXT,
  sql TEXT,
  rows_json TEXT,
  row_count INTEGER,
  cached INTEGER,
  summary TEXT,
  error_status TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_chat_message_user_created ON chat_message (user_id, created_at);
