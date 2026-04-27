// Anonymous-mode token adoption (Slice 11 — DESIGN §4.1, §1.2).
//
// `<nlq-data>` issues an anon token to localStorage; when the user
// eventually signs in, /app POSTs the token here so the pre-sign-in
// session is recorded against the now-real user. Idempotent — replays
// of the same token by the same user are no-ops.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type AdoptResult =
  | { ok: true; adopted: boolean }
  | { ok: false; reason: "invalid_token" | "internal" };

export async function recordAnonAdoption(
  db: D1Database,
  userId: string,
  token: string,
): Promise<AdoptResult> {
  if (!TOKEN_PATTERN.test(token)) {
    return { ok: false, reason: "invalid_token" };
  }
  try {
    const inserted = await db
      .prepare(
        "INSERT INTO anon_adoptions (token, user_id) VALUES (?, ?) " +
          "ON CONFLICT(token) DO NOTHING RETURNING 1 AS ok",
      )
      .bind(token, userId)
      .first<{ ok: number }>();
    return { ok: true, adopted: inserted !== null };
  } catch {
    return { ok: false, reason: "internal" };
  }
}
