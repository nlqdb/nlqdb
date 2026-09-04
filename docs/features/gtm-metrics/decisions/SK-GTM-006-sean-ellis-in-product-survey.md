# SK-GTM-006 — Sean-Ellis Q1 ships as an in-product one-click survey, asked once per account on an eligible return visit

- **Decision:** The canonical PMF question ("How would you feel if you
  could no longer use nlqdb?" — wording verbatim from founder-playbook §2
  / acquisition-tracker Phase D §4.1) is asked **in-product**, in the
  `/app` chat (`PmfSurveyCard.tsx`), never by call or email. Eligibility
  is server-decided (`apps/api/src/pmf-survey.ts`,
  `GET /v1/pmf-survey`): owned DBs carry ≥ 2 successful first-10 answers
  (`SUM(first10_ok) ≥ 2`, the `SK-ONBOARD-006` counters) AND latest
  activity is ≥ 24 h old (a return visit, per PMFsurvey.com's "never
  survey day-1 users" rule). One response per account, ever: `pmf_survey`
  D1 table (migration `0025`), `user_id` PK + `ON CONFLICT DO NOTHING`
  (the `premium_interest` / SK-IDEMP-005 pattern); a dismissal snoozes 7
  days client-side (localStorage) without spending the one answer.
  `POST /v1/pmf-survey` accepts any signed-in response and snapshots
  `query_count` / `days_since_first` per row, so the read side enforces
  the population rule instead of the write 403ing a stale-tab answer. The
  founder is emailed per response (dispatch-after-insert, at most one per
  account); the metric read lives in `computeGtmMetrics` per `SK-GTM-001`
  (`veryDisappointedShare` na-excluded), with additive snapshot keys
  (`SK-GTM-003`). Per
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  **deliberately web-only**: a feedback widget on the chat surface, not a
  user capability — no SDK/CLI/MCP/elements verb.
- **Core value:** Goal-first, Free, Honest latency
- **Why:** The Sean-Ellis 40%-very-disappointed rule is the repo's
  committed PMF gate (Phase D §4.4) yet had no capture instrument —
  recommended twice and never built, so PMF would stay unmeasurable
  exactly when launch traffic (launch-kit.md) starts producing eligible
  users. Instrument before the cohort arrives: surveys can't be
  retrofitted onto users who already churned.
- **Consequence in code:** Both routes are session-only (an anon /
  `sk_*` bearer 401s — a survey answer is an account opinion); the card
  renders nothing unless the server says eligible, so anon and day-1
  users never see it. New PMF metrics read `pmf_survey` only via
  `computeGtmMetrics`. The first stored response per account is immutable
  — reviewers reject an UPDATE path. Q2–Q5 of Phase D §4.2 are NOT in
  scope; add them only when Q1 volume proves the surface (each a new
  nullable column or its own SK).
- **Alternatives rejected:**
  - Email/interview surveys (founder-playbook calls) — the tracker's
    zero-1:1-calls operating model; response rates die off-product.
  - Events-pipeline emission (`feature.pmf.sean_ellis_q1`) — the D1 row
    IS the queryable record; GLOBAL-024 targets "not yet" denial paths,
    not feedback capture, and a LogSnag event would duplicate the founder
    email for no reader.
  - Gating POST on live eligibility — rejects honest answers from a tab
    opened while eligible; population filtering belongs at the read.
  - Ask on every Nth query (no 24 h rule) — day-1 enthusiasm corrupts
    the 40% read; PMFsurvey.com guidance is explicit.
