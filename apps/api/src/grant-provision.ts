// Grant-role provisioning DDL (SK-EKP-008, EK-06 box 2 — the DB-role
// half, sub-piece (a)). One source for the exact statement batch that
// stands up the per-grant, non-owner, SELECT-only Postgres role a
// cross-tenant granted `/v1/ask` assumes with `SET LOCAL ROLE`
// (`grant-role.ts`). Pure string builder — no DB access — so the batch
// is unit-testable and the mint / re-scope callers can never disagree on
// what they provision (the `neon-provision.ts` posture applied to the
// grant primitive).
//
// The batch is the grant analogue of `neon-provision.ts`'s tenant-role
// block, with two deliberate differences SK-EKP-008 requires:
//   1. **SELECT-only, per-scope-table** — never `GRANT SELECT ON ALL
//      TABLES`. Scope is authoritative (`grants.ts` `validateScope`): a
//      table the owner adds later is NOT auto-included, so the role gets
//      SELECT on exactly the scoped tables and nothing else (schema
//      widening never widens a grant; deny-by-default).
//   2. **FORCE ROW LEVEL SECURITY** on each scoped table (guardrail #3):
//      the connecting Neon user owns the tables and would otherwise
//      bypass RLS, so a mis-fire of the `SET LOCAL ROLE` switch (layer 2)
//      still can't leak un-policied rows.
//
// Re-scope safe: the batch first REVOKEs all table privileges the role
// holds in the schema, then re-GRANTs SELECT on the current scope, so a
// re-scope that *drops* a table actually removes that table's SELECT.
// The idempotent DO-block role create means mint and every re-scope run
// the identical batch.
//
// Identifier safety (SK-HDC-009 / `grant-role.ts` posture): the role name
// is a SHA-256 hex prefix (`assertGrantRoleName`), and the schema + every
// scope table pass `assertSafeIdentifier` before double-quote
// interpolation — `CREATE ROLE` / `GRANT` / `ALTER TABLE` identifiers
// cannot be parameterised. Callers still pass `scope` straight from a
// mint-validated `grants` row; the re-check here is defense in depth.

import { assertSafeIdentifier } from "./db-create/neon-provision.ts";
import { assertGrantRoleName, grantRoleName } from "./grant-role.ts";

// Build the ordered DDL batch that provisions (or re-provisions) the role
// for `grantId` on the owner's schema, scoped to `scope` tables. The
// caller wraps these in its own transaction (mirroring the mint batch's
// `SET LOCAL statement_timeout` / BEGIN…COMMIT), so this returns only the
// privilege statements — no transaction control, no timeout.
export async function buildGrantRoleDdl(input: {
  grantId: string;
  schemaName: string;
  scope: string[];
}): Promise<string[]> {
  const { grantId, schemaName, scope } = input;
  if (scope.length === 0) {
    // A scopeless grant role would be a login-less no-op that FORCE-RLSes
    // nothing and SELECTs nothing — never legitimate. Mint rejects an
    // empty scope (`validateScope` → `scope_required`); fail closed here
    // too rather than emit a role with no product surface.
    throw new Error("buildGrantRoleDdl: empty scope");
  }

  const role = await grantRoleName(grantId);
  assertGrantRoleName(role);
  assertSafeIdentifier(schemaName, "grant.schemaName");
  for (const table of scope) assertSafeIdentifier(table, "grant.scopeTable");

  const stmts: string[] = [];

  // Idempotent role create — Postgres has no `CREATE ROLE IF NOT EXISTS`
  // (same DO-block shape as the tenant role). NOLOGIN by default: the role
  // is only ever assumed via `SET LOCAL ROLE`, never connected to.
  stmts.push(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
         CREATE ROLE "${role}";
       END IF;
     END $$`,
  );

  // Re-scope hygiene: clear any table privileges a prior scope granted so
  // a dropped table loses SELECT. Runs after the role exists; no-ops on a
  // first mint (the role holds nothing yet).
  stmts.push(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schemaName}" FROM "${role}"`);

  // USAGE on the schema is required to reach any table inside it.
  stmts.push(`GRANT USAGE ON SCHEMA "${schemaName}" TO "${role}"`);

  // SELECT on exactly the scoped tables — never ALL TABLES (see header).
  for (const table of scope) {
    stmts.push(`GRANT SELECT ON "${schemaName}"."${table}" TO "${role}"`);
  }

  // Membership WITH SET so the connecting owner may `SET LOCAL ROLE` into
  // it (PG16+ split SET from ADMIN; the CREATEROLE auto-grant gives ADMIN
  // but not SET — same reason `neon-provision.ts` grants the tenant role).
  stmts.push(`GRANT "${role}" TO CURRENT_USER WITH SET TRUE`);

  // FORCE RLS so the table owner (the connecting user) is subject to the
  // per-tenant / per-agent policies even if the role switch mis-fires.
  for (const table of scope) {
    stmts.push(`ALTER TABLE "${schemaName}"."${table}" FORCE ROW LEVEL SECURITY`);
  }

  return stmts;
}
