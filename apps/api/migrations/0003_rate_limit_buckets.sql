-- Slice 6 follow-up — fixed-window rate-limit buckets in D1.
--
-- Originally implemented in KV (apps/api/src/ask/rate-limit.ts), but
-- KV's free-tier ceiling is 1k writes/day (DESIGN §7.1 line 566) and
-- a per-request rate-limit `put` blows that at ~1k requests TOTAL —
-- catastrophic for the documented "1k users / 10k queries/day" target
-- (DESIGN §7.2 line 589). D1's free tier is 100k writes/day (100×
-- headroom) and supports atomic UPSERT-with-RETURNING, removing the
-- read-then-write race the KV implementation had.
--
-- Bucket key: (user_id, window_start). One row per user-window.
-- Rows accumulate; periodic cleanup of windows older than ~1 day is
-- a future cron job (no infinite-growth in practice — at 1k users
-- with 60s windows that's ≤ 1.44M buckets/day, ≤ 50 MB on D1's 5 GB
-- free tier — but worth pruning for hygiene).

CREATE TABLE rate_limit_buckets (
  user_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

-- Used by the future cleanup job: `DELETE FROM rate_limit_buckets
-- WHERE window_start < unixepoch() - 86400`.
CREATE INDEX idx_rate_limit_buckets_window ON rate_limit_buckets (window_start);
