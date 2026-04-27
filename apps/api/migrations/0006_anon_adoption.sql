-- Slice 11 — anonymous-mode token adoption (DESIGN §4.1, §1.2).
--
-- The homepage `<nlq-data>` demo issues an anon token to localStorage
-- so visitors can run queries without signing up. When they later
-- sign in, the chat surface POSTs the anon token to /v1/anon/adopt
-- so the prior session's history (and any anon-bound databases when
-- that flow lands) folds into the user account.
--
-- Phase 1 ships only the recording table. Adoption-time semantics
-- (rebinding databases, replaying chat) land alongside the
-- `<nlq-action>` write surface.

CREATE TABLE anon_adoptions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_anon_adoptions_user ON anon_adoptions (user_id);
