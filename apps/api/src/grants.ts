// Cross-tenant read-grant control plane (SK-EKP-008, EK-06 box 1).
//
// A grant lets tenant A ("owner") sell tenant B ("grantee") read-only
// query access to one named knowledge DB — revocable, fail-closed,
// metered. This module is the mint/revoke/list half; per-request
// authorization + scope enforcement on `/v1/ask` land with the
// enforcement slice (EK-06 box 2) via `getActiveGrant`.
//
// Posture (SK-EKP-008):
//   - v1 grants mint on platform-provisioned hosted DBs only — BYO rows
//     are rejected (`sql-validate-ddl.ts` cannot vouch for DDL it never
//     saw, so none of the role / FORCE-RLS assumptions hold there).
//   - `scope` enumerates bare table names and is authoritative: schema
//     widening never widens a grant; enforcement rejects reach outside
//     it at validation, before execution.
//   - Revocation is `revoked_at` on the row; every enforcement read
//     filters `revoked_at IS NULL` at the source so any cache built on
//     top inherits fail-closed behaviour (same idiom as `api_keys`).
//   - `price_model` is opaque to the public core: the private selling
//     surface (SK-EKP-003) writes and interprets it; no fee logic here
//     (SK-EKP-002).

export type GrantRecord = {
  id: string;
  ownerTenantId: string;
  ownerDbId: string;
  granteeTenantId: string;
  scope: string[];
  priceModel: string | null;
  createdAt: number;
  revokedAt: number | null;
};

// Postgres identifier limit; scope entries are bare lower-case table
// names — qualified, quoted, or function-shaped entries are rejected so
// a scope can never smuggle a definer view or function-backed surface
// past the mint check (SK-EKP-008: function-backed scope rejected at
// mint in v1).
const SCOPE_TABLE_RE = /^[a-z_][a-z0-9_]*$/;
const SCOPE_TABLE_MAX_LEN = 63;
const SCOPE_MAX_TABLES = 64;
export const PRICE_MODEL_MAX_LEN = 256;

export type ScopeValidation = { ok: true; scope: string[] } | { ok: false; reason: string };

// Normalises + validates a mint request's scope. Deduplicates, keeps
// order of first appearance.
export function validateScope(raw: unknown): ScopeValidation {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: "scope_required" };
  }
  if (raw.length > SCOPE_MAX_TABLES) {
    return { ok: false, reason: "scope_too_large" };
  }
  const seen = new Set<string>();
  const scope: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") return { ok: false, reason: "scope_invalid_table" };
    const table = entry.trim();
    if (table.length === 0 || table.length > SCOPE_TABLE_MAX_LEN || !SCOPE_TABLE_RE.test(table)) {
      return { ok: false, reason: "scope_invalid_table" };
    }
    if (!seen.has(table)) {
      seen.add(table);
      scope.push(table);
    }
  }
  return { ok: true, scope };
}

export async function mintGrant(
  d1: D1Database,
  input: {
    // Caller-supplied id so the mint route can provision the grant's
    // Postgres role (keyed on this id via `grant-role.ts`) BEFORE the D1
    // write, keeping the two-system order fail-closed (`grant-provision-exec.ts`).
    // Omitted ⇒ minted here (the data-layer tests take this path).
    id?: string;
    ownerTenantId: string;
    ownerDbId: string;
    granteeTenantId: string;
    scope: string[];
    priceModel: string | null;
  },
): Promise<GrantRecord> {
  const id = input.id ?? crypto.randomUUID();
  // DB clock for created_at (RETURNING) so it can never disagree with
  // the unixepoch() a later revoke stamps.
  const inserted = await d1
    .prepare(
      "INSERT INTO grants (id, owner_tenant_id, owner_db_id, grantee_tenant_id, scope, price_model) " +
        "VALUES (?, ?, ?, ?, ?, ?) RETURNING created_at",
    )
    .bind(
      id,
      input.ownerTenantId,
      input.ownerDbId,
      input.granteeTenantId,
      JSON.stringify(input.scope),
      input.priceModel,
    )
    .first<{ created_at: number }>();
  const createdAt = inserted?.created_at ?? Math.floor(Date.now() / 1000);
  return {
    id,
    ownerTenantId: input.ownerTenantId,
    ownerDbId: input.ownerDbId,
    granteeTenantId: input.granteeTenantId,
    scope: input.scope,
    priceModel: input.priceModel,
    createdAt,
    revokedAt: null,
  };
}

type GrantRow = {
  id: string;
  owner_tenant_id: string;
  owner_db_id: string;
  grantee_tenant_id: string;
  scope: string;
  price_model: string | null;
  created_at: number;
  revoked_at: number | null;
};

function toRecord(row: GrantRow): GrantRecord {
  return {
    id: row.id,
    ownerTenantId: row.owner_tenant_id,
    ownerDbId: row.owner_db_id,
    granteeTenantId: row.grantee_tenant_id,
    scope: JSON.parse(row.scope) as string[],
    priceModel: row.price_model,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

// Both sides of the marketplace in one list: grants the tenant sold
// (owner) and grants it holds (grantee). Active rows before revoked,
// newest first — same slice-into-two-sections contract as the keys list.
export async function listGrantsByTenant(d1: D1Database, tenantId: string): Promise<GrantRecord[]> {
  const res = await d1
    .prepare(
      "SELECT id, owner_tenant_id, owner_db_id, grantee_tenant_id, scope, price_model, created_at, revoked_at " +
        "FROM grants WHERE owner_tenant_id = ? OR grantee_tenant_id = ? " +
        "ORDER BY (revoked_at IS NOT NULL), created_at DESC",
    )
    .bind(tenantId, tenantId)
    .all<GrantRow>();
  return (res.results ?? []).map(toRecord);
}

export type RevokeGrantOutcome = "revoked" | "already_revoked" | "not_found";

// Owner-scoped revoke. A grantee cannot revoke (they walk away by not
// querying); an unknown id and another tenant's id are indistinguishable
// (no cross-tenant existence leak — same posture as `revokeKeyById`).
// Race-safe: the conditional UPDATE wins-or-no-ops atomically.
export async function revokeGrantById(
  d1: D1Database,
  ownerTenantId: string,
  grantId: string,
): Promise<RevokeGrantOutcome> {
  const upd = await d1
    .prepare(
      "UPDATE grants SET revoked_at = unixepoch() " +
        "WHERE id = ? AND owner_tenant_id = ? AND revoked_at IS NULL",
    )
    .bind(grantId, ownerTenantId)
    .run();
  if (upd.meta.changes === 1) return "revoked";
  const row = await d1
    .prepare("SELECT 1 AS hit FROM grants WHERE id = ? AND owner_tenant_id = ?")
    .bind(grantId, ownerTenantId)
    .first<{ hit: number }>();
  return row ? "already_revoked" : "not_found";
}

// The enforcement read (EK-06 box 2 consumes this): the active grant a
// grantee holds on a DB, or null. `revoked_at IS NULL` is filtered here
// at the source so the ≤ 30 s status cache SK-EKP-008 allows on top
// inherits fail-closed semantics; an unknown/errored read is a reject,
// never a serve.
export async function getActiveGrant(
  d1: D1Database,
  granteeTenantId: string,
  ownerDbId: string,
): Promise<GrantRecord | null> {
  const row = await d1
    .prepare(
      "SELECT id, owner_tenant_id, owner_db_id, grantee_tenant_id, scope, price_model, created_at, revoked_at " +
        "FROM grants WHERE grantee_tenant_id = ? AND owner_db_id = ? AND revoked_at IS NULL " +
        "ORDER BY created_at DESC LIMIT 1",
    )
    .bind(granteeTenantId, ownerDbId)
    .first<GrantRow>();
  return row ? toRecord(row) : null;
}
