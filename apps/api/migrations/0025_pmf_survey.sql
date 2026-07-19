-- SK-GTM-006 — in-product Sean-Ellis Q1 PMF survey responses.
--
-- One row per account (`user_id` PK): the survey is asked once per
-- principal, ever, so `INSERT ... ON CONFLICT DO NOTHING` is the whole
-- write path (the premium_interest / SK-IDEMP-005 pattern). `response`
-- is the verbatim Sean-Ellis Q1 answer key (very_disappointed /
-- somewhat_disappointed / not_disappointed / na); `query_count` and
-- `days_since_first` snapshot the respondent's usage context at answer
-- time so the read side can hold the PMFsurvey.com population rule
-- (only count respondents who actually used the product) even for rows
-- posted outside the eligibility window.
--
-- Numbered 0025 (not 0023/0024): two in-flight PRs (#744, #745) each
-- carry a 0023_* migration; this leaves both slots free.
CREATE TABLE pmf_survey (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  response TEXT NOT NULL,
  query_count INTEGER NOT NULL DEFAULT 0,
  days_since_first INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
