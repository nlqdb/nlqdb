-- Slice 11b — waitlist signups while the chat surface is tabled.
-- Rows are immutable post-insert; one INSERT per signup. Hashed email
-- in addition to the literal so we can audit re-signups without a
-- table scan over plaintext.

CREATE TABLE waitlist (
  email_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_waitlist_created ON waitlist (created_at);
