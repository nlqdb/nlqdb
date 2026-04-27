-- Slice 10 — chat history (DESIGN §3.2 "Signed-in surface").
--
-- One row per turn (user prompt or assistant reply). The /app chat UI
-- replays this on load and appends new turns as the user sends them.
-- Per-user, no thread concept — Slice 10 ships a single rolling
-- conversation; multi-thread / per-DB scoping waits for Phase 1's
-- "anonymous DB → adopted DB" flow (DESIGN §4.1).
--
-- Snake-case + INTEGER timestamps — matches the convention for tables
-- this repo owns (databases, rate_limit_buckets, stripe_events). The
-- camelCase `user(id)` FK target is Better Auth's territory; SQLite
-- identifiers are case-insensitive when unquoted, so the cross-style
-- reference resolves cleanly.
--
-- Timestamp unit = **milliseconds** (Date.now() output), unlike the
-- other tables in this repo which use seconds (`unixepoch()`). The
-- chat orchestrator can fire two INSERTs in the same wall-clock
-- second (user-row → assistant-row pair), so second-resolution would
-- create ordering ties. No DEFAULT — every row's `created_at` is set
-- by the app at insert; an ad-hoc INSERT without created_at fails
-- the NOT NULL, which is the right signal that you're inserting
-- outside the orchestrator.
--
-- Ordering: queries SHOULD use `rowid DESC` for "newest first"
-- replay, NOT `created_at DESC`. SQLite's rowid is monotonically
-- assigned at INSERT time and is tie-free; created_at is informational
-- (display, debugging) but not authoritative for sequence.
--
-- Assistant rows store either the success columns (sql, rows_json,
-- row_count, cached, summary, rows_truncated) OR the failure columns
-- (error_status, error_message). Both nullable — a row never fills
-- both groups. The check constraint on `role` keeps this enum honest
-- at the DB layer; the rest is enforced by the app's discriminated
-- union (apps/api/src/chat/types.ts).
--
-- `rows_json` is capped at MAX_PERSIST_ROWS (50; see chat/orchestrate.ts)
-- and `rows_truncated` flags whether the original result was longer.
-- Storing the full result set would scale chat history at
-- O(rows × turns) per user; the cap holds D1 row size + history-
-- replay payloads under control.

CREATE TABLE chat_message (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  db_id TEXT,
  goal TEXT,
  sql TEXT,
  rows_json TEXT,
  row_count INTEGER,
  rows_truncated INTEGER,
  cached INTEGER,
  summary TEXT,
  error_status TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

-- Index on user_id alone — D1/SQLite rejects `rowid` as an index
-- expression (rowid is the implicit primary key, not a regular
-- column). The query planner still picks `idx_chat_message_user`
-- for `WHERE user_id=? ORDER BY rowid DESC LIMIT N`: matching rows
-- come out of the index and the per-user subset is small enough
-- (<<10k turns per user in any realistic chat) that the rowid sort
-- step is cheap. Validated under @cloudflare/vitest-pool-workers.
CREATE INDEX idx_chat_message_user ON chat_message (user_id);
