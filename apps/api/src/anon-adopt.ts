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

// SK-ANON-003 (amended 2026-07-11) — since least-privilege exec landed
// (`SET LOCAL ROLE tenant_<hash>` + a tenant-literal RLS predicate,
// db-create provision), the D1 tenant flip alone leaves an adopted DB
// permanently unqueryable: exec derives the role from the ADOPTING
// tenant, but the schema's grants, the `WITH SET` role membership, and
// the `tenant_isolation` USING literal all still name the anon creator.
// Adoption therefore also runs a constant-size Postgres ACL retarget
// per migrated hosted DB (`retargetAdoptedDbAcl`) — grants + policy
// rewrite only, still no data move.

import { trace } from "@opentelemetry/api";
import { adoptApiKeys } from "./api-keys.ts";
import {
  assertSafeIdentifier,
  escapeSqlLiteral,
  stripDbPrefix,
} from "./db-create/neon-provision.ts";
import type { PgClient, PgTransactionStatement } from "./db-create/types.ts";
import { sha256Hex } from "./principal.ts";
import { assertTenantRoleName, tenantRoleName } from "./tenant-role.ts";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type AdoptResult =
  | { ok: true; adopted: boolean; dbId: string | null }
  | { ok: false; reason: "invalid_token" | "token_taken" | "internal" };

// The Postgres side of adoption for one hosted DB. Injectable so unit
// tests stub it; production callers pass `makeAclRetarget(env)`.
export type AclRetarget = (dbId: string, newTenantId: string) => Promise<void>;

// Statement list that re-points a hosted schema's ACL at the adopting
// tenant: role-if-missing + USAGE/DML/sequence grants + the `WITH SET`
// membership exec needs for `SET LOCAL ROLE`, then an `ALTER POLICY`
// per table so the RLS USING literal names the new tenant (it was
// baked with the anon creator's id at provision time). Mirrors the
// provision batch in `db-create/neon-provision.ts` — same identifier
// guards, same role-name shape.
export function buildRetargetStatements(
  schemaName: string,
  newTenantId: string,
  roleName: string,
  policyTables: string[],
): PgTransactionStatement[] {
  assertSafeIdentifier(schemaName, "schemaName");
  assertTenantRoleName(roleName);
  const tenantLiteral = escapeSqlLiteral(newTenantId);
  const statements: PgTransactionStatement[] = [
    {
      sql: `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roleName}') THEN
              CREATE ROLE "${roleName}";
            END IF;
          END $$`,
    },
    { sql: `GRANT USAGE ON SCHEMA "${schemaName}" TO "${roleName}"` },
    {
      sql: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schemaName}" TO "${roleName}"`,
    },
    { sql: `GRANT USAGE ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO "${roleName}"` },
    { sql: `GRANT "${roleName}" TO CURRENT_USER WITH SET TRUE` },
  ];
  for (const table of policyTables) {
    assertSafeIdentifier(table, "policyTable");
    statements.push({
      sql:
        `ALTER POLICY tenant_isolation ON "${schemaName}"."${table}" ` +
        `USING (current_setting('app.tenant_id', true) = '${tenantLiteral}')`,
    });
  }
  return statements;
}

// Runs the retarget for one adopted hosted DB: one catalog read (which
// tables carry the `tenant_isolation` policy) + one transaction.
// Idempotent — every statement re-applies cleanly on a replay.
export async function retargetAdoptedDbAcl(
  pg: PgClient,
  dbId: string,
  newTenantId: string,
): Promise<void> {
  const schemaName = stripDbPrefix(dbId);
  const roleName = await tenantRoleName(newTenantId);
  const policyRows = await pg.query<{ tablename: string }>(
    "SELECT tablename FROM pg_policies WHERE schemaname = $1 AND policyname = 'tenant_isolation'",
    [schemaName],
  );
  const tables = policyRows.rows.map((r) => r.tablename);
  await pg.transaction(buildRetargetStatements(schemaName, newTenantId, roleName, tables));
}

export async function recordAnonAdoption(
  db: D1Database,
  userId: string,
  token: string,
  retargetAcl?: AclRetarget,
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
          "WHERE tenant_id = ? RETURNING id, engine, connection_blob",
      )
      .bind(userId, anonTenantId)
      .all<{ id: string; engine: string; connection_blob: string | null }>();
    await adoptApiKeys(db, anonTenantId, userId);

    // Re-point each migrated hosted schema's Postgres ACL at the new
    // tenant (see module header). Best-effort per DB: a failed retarget
    // leaves that DB unqueryable exactly as before this fix, so log it
    // structurally rather than failing the sign-in that triggered the
    // adoption.
    for (const row of migrated.results ?? []) {
      const isHosted = row.engine === "postgres" && row.connection_blob === null;
      if (!isHosted || !retargetAcl) continue;
      try {
        await retargetAcl(row.id, userId);
      } catch (err) {
        trace.getActiveSpan()?.setAttribute("nlqdb.anon.adopt.regrant_failed", row.id);
        console.error(
          JSON.stringify({
            event: "anon_adopt_regrant_failed",
            db_id: row.id,
            user_id: userId,
            message: (err instanceof Error ? err.message : String(err)).slice(0, 500),
          }),
        );
      }
    }

    const migratedDbId = migrated.results?.[0]?.id ?? null;
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
