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
};

export async function resolveDb(
  d1: D1Database,
  id: string,
  tenantId: string,
): Promise<DbRecord | null> {
  const row = await d1
    .prepare(
      "SELECT id, tenant_id, engine, connection_secret_ref, schema_hash FROM databases WHERE id = ? AND tenant_id = ?",
    )
    .bind(id, tenantId)
    .first<DbRow>();
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    engine: row.engine as "postgres",
    connectionSecretRef: row.connection_secret_ref,
    schemaHash: row.schema_hash,
  };
}
