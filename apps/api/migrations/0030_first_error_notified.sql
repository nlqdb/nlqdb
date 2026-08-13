-- First-server-error recovery email dedup (SK-ASK-027). One row per user,
-- written the first time a signed-in user hits a 5xx on POST /v1/ask. As with
-- premium_interest / pmf_survey, `INSERT ... ON CONFLICT DO NOTHING RETURNING
-- 1` is the SK-IDEMP-005 atomic primitive: a non-null result means "first
-- server error for this account" → send one apologetic recovery email
-- (dispatch-after-insert, SK-IDEMP-006). The table — not Resend's 24h window
-- — is the dedup source of truth, so a user is emailed at most once ever,
-- however many times they later hit an error.
--
-- Scoped to signed-in users by construction: only a `user` principal has a
-- stable account id + an email on file. Anonymous / API-key principals at the
-- error surface have no address, so they never get a row here.
CREATE TABLE first_error_notified (
  user_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
