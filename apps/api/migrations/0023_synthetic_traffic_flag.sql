-- Migration number: 0023 	 2026-07-19T18:48:40.509Z
--
-- SK-GTM-005 — persist the synthetic-traffic flag on the `databases`
-- registry so the GTM/PMF read side (GLOBAL-038) can exclude nlqdb's
-- own robots from anon-DB and unique-device counts.
--
-- A row is stamped `synthetic = 1` at create time when the request
-- self-identifies as nlqdb-generated: the stranger-test walker's UA
-- token (SK-ONBOARD-007, `synthetic-ua.ts`) or a preview/mock deploy
-- (`NODE_ENV=preview` / `MOCK_IDP=1`, SK-AUTH-018 — previews share the
-- prod D1). Write-side complement of SK-ONBOARD-007's first-10 skip:
-- that decision keeps walker ASKS out of the KPI counters; this column
-- keeps walker/preview DBS out of the funnel counts.
--
-- Rows created before this migration are unattributable (default 0 —
-- counted as organic); the 90-day anon sweep (SK-ANON-002) ages the
-- pre-tagging backlog out naturally.

ALTER TABLE databases ADD COLUMN synthetic INTEGER NOT NULL DEFAULT 0;
