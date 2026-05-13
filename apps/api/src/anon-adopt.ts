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
//
// SK-ANON-014 — the UPDATE uses `RETURNING id` so we know the dbId
// that just migrated. We persist it on the `anon_adoptions` row
// (`database_id` column, migration 0012) and return it from this
// function on both first adoption and replay. `/auth/post-signin`
// reads it and pins the DB via `?db=<id>` so the chat lands on the
// adopted DB without waiting for the LeftRail's `/v1/databases` fetch.

import { adoptApiKeys } from "./api-keys.ts";
import { sha256Hex } from "./principal.ts";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type AdoptResult =
  | { ok: true; adopted: boolean; dbId: string | null }
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
    let existingDbId: string | null = null;
    if (!isFirstAdoption) {
      // Conflict — the token was already bound. Look up who owns it so
      // we can distinguish "same user, idempotent replay" from "different
      // user, hijack attempt". The TOCTOU window between INSERT and
      // SELECT is harmless: if the row vanishes (CASCADE delete on user
      // teardown), this collapses to `internal` and the client can retry.
      // SK-ANON-014 — also read `database_id` so a replay can surface
      // the dbId that the prior adoption recorded.
      const existing = await db
        .prepare("SELECT user_id, database_id FROM anon_adoptions WHERE token = ?")
        .bind(token)
        .first<{ user_id: string; database_id: string | null }>();
      if (!existing) return { ok: false, reason: "internal" };
      if (existing.user_id !== userId) return { ok: false, reason: "token_taken" };
      existingDbId = existing.database_id;
    }

    // Migrate every database and api_key the anon device provisioned
    // over to the freshly-authed user. Idempotent — WHERE clauses
    // naturally no-op on a replay. `RETURNING id` (SK-ANON-014) gives
    // us the migrated dbId(s) so we can pin the chat to the adopted DB
    // on first-adoption; on replay this returns no rows (the WHERE
    // clause no longer matches) and we fall back to `existingDbId`.
    const anonTenantId = `anon:${await sha256Hex(token, 16)}`;
    const migrated = await db
      .prepare(
        "UPDATE databases SET tenant_id = ?, updated_at = unixepoch() " +
          "WHERE tenant_id = ? RETURNING id",
      )
      .bind(userId, anonTenantId)
      .first<{ id: string }>();
    await adoptApiKeys(db, anonTenantId, userId);

    const migratedDbId = migrated?.id ?? null;
    const dbId = migratedDbId ?? existingDbId;
    // Persist the dbId on the adoption row on first-adoption (or
    // back-fill it when a legacy replay finally observes one — covers
    // rows written before migration 0012). Guarded by `database_id IS
    // NULL` so a later (different) migrated DB doesn't overwrite the
    // first one.
    if (migratedDbId !== null) {
      await db
        .prepare(
          "UPDATE anon_adoptions SET database_id = ? WHERE token = ? AND database_id IS NULL",
        )
        .bind(migratedDbId, token)
        .run();
    }

    return { ok: true, adopted: isFirstAdoption, dbId };
  } catch {
    return { ok: false, reason: "internal" };
  }
}
