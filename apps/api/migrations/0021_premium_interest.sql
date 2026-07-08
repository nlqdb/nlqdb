-- Hosted-premium interest capture — the durable record behind the chat
-- model picker's "Count me in" button (SK-PREMIUM-013's subscribe door,
-- SK-PREMIUM-009 §6-dark). One row per account (`user_id` PK) dedups
-- repeat clicks by construction, so `INSERT ... ON CONFLICT DO NOTHING`
-- is the whole write path and a first insert is the signal to notify the
-- founder once (dispatch-after-insert, SK-IDEMP-006).
--
-- Not a waitlist / access gate (GLOBAL-027 removed those): the product
-- stays fully open. This is a premium-tier demand signal, queryable for
-- the §6 go/no-go — `SELECT COUNT(*) FROM premium_interest`.
CREATE TABLE premium_interest (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
