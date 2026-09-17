-- Migration number: 0036 	 2026-09-17T21:58:00.780Z

-- Non-gating interest list for the Become AI marketplace. Email hash is
-- the natural idempotency key: repeat submissions return the same response
-- and never inflate the founder's demand signal.
CREATE TABLE pivot_interest (
  email_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  user_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('home', 'app')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_pivot_interest_created ON pivot_interest (created_at);
