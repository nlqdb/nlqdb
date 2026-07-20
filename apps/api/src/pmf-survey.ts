// Sean-Ellis Q1 PMF survey (SK-GTM-006) — the in-product replacement for
// the founder-playbook §2 interview call, per the acquisition tracker's
// Phase D §4.1. The `/v1/pmf-survey` routes in index.ts are the only
// callers; this module owns the eligibility predicate and the one D1
// write so both contracts live in one tested place.
//
// Eligibility (PMFsurvey.com population rule — only survey users who've
// completed the core loop ≥ 2 times, and never on day one): the session
// user's owned DBs carry ≥ 2 successful first-10 answers
// (SUM(first10_ok) ≥ 2, the SK-ONBOARD-006 counters) AND their most
// recent activity is ≥ 24 h old at page load — i.e. this is a return
// visit, not the first session. One response per account, ever
// (`user_id` PK; the premium_interest / SK-IDEMP-005 pattern).
//
// The POST accepts any signed-in response (a stale tab that answers
// after more queries is not rejected); the population rule is enforced
// at the read instead — `query_count` / `days_since_first` are stored
// per row so a reader can always filter to the surveyed population.

export const SEAN_ELLIS_RESPONSES = [
  "very_disappointed",
  "somewhat_disappointed",
  "not_disappointed",
  "na",
] as const;

export type SeanEllisResponse = (typeof SEAN_ELLIS_RESPONSES)[number];

export function parseSeanEllisResponse(value: unknown): SeanEllisResponse | null {
  return typeof value === "string" && (SEAN_ELLIS_RESPONSES as readonly string[]).includes(value)
    ? (value as SeanEllisResponse)
    : null;
}

const DAY_SECONDS = 86_400;

export type PmfSurveyStatus = { answered: boolean; eligible: boolean };

export async function getPmfSurveyStatus(
  d1: D1Database,
  userId: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<PmfSurveyStatus> {
  const row = await d1
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM pmf_survey WHERE user_id = ?1) AS answered,
         (SELECT SUM(first10_ok) FROM databases WHERE tenant_id = ?1) AS ok,
         (SELECT MAX(last_queried_at) FROM databases WHERE tenant_id = ?1) AS last`,
    )
    .bind(userId)
    .first<{ answered: number; ok: number | null; last: number | null }>();
  const answered = (row?.answered ?? 0) > 0;
  const eligible =
    !answered &&
    (row?.ok ?? 0) >= 2 &&
    typeof row?.last === "number" &&
    nowSec - row.last >= DAY_SECONDS;
  return { answered, eligible };
}

export type RecordPmfSurveyResult = { firstTime: boolean };

export async function recordPmfSurveyResponse(
  d1: D1Database,
  userId: string,
  email: string | null,
  response: SeanEllisResponse,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<RecordPmfSurveyResult> {
  // Usage context at answer time. `first10_asks` saturates at 10 per DB
  // (SK-ONBOARD-006), so query_count is a floor, not an exact count —
  // enough for the ≥ 2 population filter it exists to serve.
  const ctx = await d1
    .prepare(
      `SELECT COALESCE(SUM(first10_asks), 0) AS asks, MIN(created_at) AS first
       FROM databases WHERE tenant_id = ?`,
    )
    .bind(userId)
    .first<{ asks: number; first: number | null }>();
  const queryCount = ctx?.asks ?? 0;
  const daysSinceFirst =
    typeof ctx?.first === "number"
      ? Math.max(0, Math.floor((nowSec - ctx.first) / DAY_SECONDS))
      : 0;

  const row = await d1
    .prepare(
      `INSERT INTO pmf_survey (user_id, email, response, query_count, days_since_first)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO NOTHING RETURNING 1 AS ok`,
    )
    .bind(userId, email, response, queryCount, daysSinceFirst)
    .first<{ ok: number }>();
  return { firstTime: row !== null };
}
