// Hosted-premium interest capture — the durable half of the chat model
// picker's "Count me in" door (SK-PREMIUM-013's subscribe door). The
// `POST /v1/premium/interest` route in index.ts is the only caller; this
// module owns the one D1 write so the dedup contract lives in one tested
// place.
//
// One row per account (`user_id` PK): `INSERT ... ON CONFLICT DO NOTHING
// RETURNING 1` is the SK-IDEMP-005 atomic primitive — a non-null result
// means "first time" (notify the founder once, dispatch-after-insert per
// SK-IDEMP-006), null means "already interested" (skip). The table, not
// Resend's 24h window, is the dedup source of truth, so a repeat click
// weeks later still doesn't re-notify.

export type RecordInterestResult = { firstTime: boolean };

export async function recordPremiumInterest(
  d1: D1Database,
  userId: string,
  email: string | null,
): Promise<RecordInterestResult> {
  const row = await d1
    .prepare(
      "INSERT INTO premium_interest (user_id, email) VALUES (?, ?) " +
        "ON CONFLICT(user_id) DO NOTHING RETURNING 1 AS ok",
    )
    .bind(userId, email)
    .first<{ ok: number }>();
  return { firstTime: row !== null };
}
