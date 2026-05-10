// Anonymous-mode token adoption (Slice 11 — docs/architecture.md §4.1, §1.2).
//
// `<nlq-data>` issues an anon token to localStorage; when the user
// eventually signs in, /app POSTs the token here so the pre-sign-in
// session is recorded against the now-real user. Idempotent — replays
// of the same token by the same user are no-ops.
//
// Producer contract (must hold for any client minting anon tokens):
//   • Format: 16–128 chars, [A-Za-z0-9_-] (base64url-safe).
//   • Entropy: ≥96 bits. The format alone allows guessable tokens —
//     adoption authentication is "I know this token, therefore it's
//     mine", so producer-side weakness becomes a server-side hijack
//     vector. Use `crypto.getRandomValues(new Uint8Array(16))` +
//     base64url-encode (= 128 bits) at minimum.
//   • One token per anon session; do not recycle across browsers.
//
// Server enforces first-adopter-wins: once a token is bound to a
// user_id, any subsequent attempt by a different user gets
// `token_taken` (not silent ok). Same user replaying their own token
// is the idempotent path.
//
// SK-ANON-003 — on adoption we also UPDATE `databases.tenant_id` from
// the anon principal id (`anon:<sha256(token)[:16]>`) to the user id
// so the user's `/v1/databases` rail surfaces every DB they created
// while anonymous, and so subsequent `/v1/ask` resolveDb lookups
// against those DBs match by tenant_id.

import { sha256Hex } from "./principal.ts";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type AdoptResult =
  | { ok: true; adopted: boolean }
  | { ok: false; reason: "invalid_token" | "token_taken" | "internal" };

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
    const isFirstAdoption = inserted !== null;
    if (!isFirstAdoption) {
      // Conflict — the token was already bound. Look up who owns it so
      // we can distinguish "same user, idempotent replay" from "different
      // user, hijack attempt". The TOCTOU window between INSERT and
      // SELECT is harmless: if the row vanishes (CASCADE delete on user
      // teardown), this collapses to `internal` and the client can retry.
      const existing = await db
        .prepare("SELECT user_id FROM anon_adoptions WHERE token = ?")
        .bind(token)
        .first<{ user_id: string }>();
      if (!existing) return { ok: false, reason: "internal" };
      if (existing.user_id !== userId) return { ok: false, reason: "token_taken" };
    }

    // Migrate every database the anon device provisioned over to the
    // freshly-authed user. Re-keys `tenant_id` on the registry row
    // so subsequent `listDatabasesForTenant(userId)` reads see them.
    // Idempotent — the WHERE clause naturally no-ops on a replay
    // (the rows were already migrated on the first call).
    const anonTenantId = `anon:${await sha256Hex(token, 16)}`;
    await db
      .prepare(
        "UPDATE databases SET tenant_id = ?, updated_at = unixepoch() " + "WHERE tenant_id = ?",
      )
      .bind(userId, anonTenantId)
      .run();

    return { ok: true, adopted: isFirstAdoption };
  } catch {
    return { ok: false, reason: "internal" };
  }
}
