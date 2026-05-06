// `GET /v1/databases` — list the caller's databases for the chat
// surface's left-rail (LeftRail.tsx in apps/web). Tenant-scoped via
// the WHERE clause; matches db-registry.ts's resolveDb pattern so a
// leaked dbId from one tenant cannot surface under another.
//
// Response shape mirrors the SDK's `DatabaseSummary` (packages/sdk
// src/index.ts). The Phase-1 `databases` table (migration 0001_init)
// only stores `id / tenant_id / engine / connection_secret_ref /
// schema_hash / created_at / updated_at`, so a few fields the SDK
// type carries are returned as null / derived:
//
//   - `slug`: derived from the dbId. Orchestrator mints
//     `db_<slug_hint>_<6char>` (db-create/orchestrate.ts), so we
//     strip the `db_` prefix and replace `_` with `-` to get the
//     human-friendly form (`orders-tracker-a4fxyz`).
//   - `pkLive`: null. The provisioner v0 already returns null and
//     defers `pk_live_<dbId>` minting to the api-keys subsystem
//     (see neon-provision.ts:235-238). The chat surface's
//     CopySnippet.tsx falls through to the per-island fallback or
//     anon-device key when this is null.
//   - `lastQueriedAt`: null. We don't yet record per-DB last-query
//     timestamps; LeftRail falls back to `createdAt` for display.

export type DatabaseSummaryRow = {
  id: string;
  slug: string;
  pkLive: string | null;
  lastQueriedAt: number | null;
  createdAt: number;
};

type Row = {
  id: string;
  created_at: number;
};

export async function listDatabasesForTenant(
  d1: D1Database,
  tenantId: string,
): Promise<DatabaseSummaryRow[]> {
  const result = await d1
    .prepare("SELECT id, created_at FROM databases WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(tenantId)
    .all<Row>();
  return (result.results ?? []).map(toSummary);
}

export function toSummary(row: Row): DatabaseSummaryRow {
  return {
    id: row.id,
    slug: deriveSlug(row.id),
    pkLive: null,
    lastQueriedAt: null,
    createdAt: row.created_at,
  };
}

// `db_orders_tracker_a4fxyz` → `orders-tracker-a4fxyz`. dbIds the
// orchestrator didn't mint (legacy or hand-inserted rows) keep their
// raw form minus the prefix so the rail still shows something stable.
export function deriveSlug(dbId: string): string {
  const stripped = dbId.startsWith("db_") ? dbId.slice(3) : dbId;
  return stripped.replace(/_/g, "-");
}
