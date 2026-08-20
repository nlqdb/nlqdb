// Tenant → user-DB resolver. Reads the `databases` row from D1
// (migration 0001_init.sql) and returns the typed record. Tenant
// scoping enforced via the WHERE clause — a leaked `dbId` from one
// tenant cannot resolve under another tenant's `userId`.

import type { DbRecord } from "./ask/types.ts";

type DbRow = {
  id: string;
  tenant_id: string;
  engine: string;
  connection_secret_ref: string;
  schema_hash: string | null;
  schema_text: string | null;
  connection_blob: string | null;
};

// A `resolveDb` bound to a D1 handle: `(id, tenantId) => Promise<DbRecord|null>`.
export type BoundResolveDb = (id: string, tenantId: string) => Promise<DbRecord | null>;

// Per-request memoized resolver. A single `/v1/ask` resolves the pinned DB
// twice — once in the prelude (routeAsk table context, SK-ASK-018) and again
// in the orchestrator (exec, orchestrate.ts) — and both reads are identical
// within a request. Memoizing on `(id, tenantId)` collapses them to one D1
// point-read, and any other same-request resolve of the same DB is free.
// MUST be constructed per request so a cached row never leaks across tenants.
export function memoResolveDb(d1: D1Database): BoundResolveDb {
  const cache = new Map<string, Promise<DbRecord | null>>();
  return (id, tenantId) => {
    const key = `${id} ${tenantId}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const p = resolveDb(d1, id, tenantId);
    cache.set(key, p);
    return p;
  };
}

export async function resolveDb(
  d1: D1Database,
  id: string,
  tenantId: string,
): Promise<DbRecord | null> {
  const row = await d1
    .prepare(
      "SELECT id, tenant_id, engine, connection_secret_ref, schema_hash, schema_text, connection_blob FROM databases WHERE id = ? AND tenant_id = ?",
    )
    .bind(id, tenantId)
    .first<DbRow>();
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    engine: row.engine as "postgres" | "clickhouse",
    connectionSecretRef: row.connection_secret_ref,
    schemaHash: row.schema_hash,
    schemaText: row.schema_text,
    connectionBlob: row.connection_blob,
  };
}
