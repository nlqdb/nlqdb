// SK-HDC-024 — tenant roles no `databases` row needs are revoked + dropped;
// live roles, the batch cap and the empty-D1 guard hold.

import { describe, expect, it } from "vitest";
import type { PgClient, PgTransactionStatement } from "../db-create/types.ts";
import { tenantRoleName } from "../tenant-role.ts";
import { buildReapStatements, reapTenantRoles } from "./role-reap.ts";

function stubD1(tenantIds: string[]): D1Database {
  return {
    prepare: () => ({
      all: async () => ({ results: tenantIds.map((tenant_id) => ({ tenant_id })) }),
    }),
  } as unknown as D1Database;
}

function stubPg(
  catalog: { rolname: string; nspname: string | null }[],
  failRole?: string,
): PgClient & { batches: PgTransactionStatement[][] } {
  const batches: PgTransactionStatement[][] = [];
  return {
    batches,
    query: async <T>() => ({ rows: catalog as T[], rowCount: catalog.length }),
    transaction: async (stmts) => {
      if (failRole && stmts.some((s) => s.sql.includes(failRole))) {
        throw new Error(`role "${failRole}" cannot be dropped because some objects depend on it`);
      }
      batches.push(stmts);
      return [];
    },
  };
}

describe("buildReapStatements", () => {
  it("revokes per schema, then drops the role", () => {
    const sql = buildReapStatements("tenant_0123456789abcdef", ["s1"]).map((s) => s.sql);
    expect(sql).toEqual([
      'REVOKE ALL ON ALL TABLES IN SCHEMA "s1" FROM "tenant_0123456789abcdef"',
      'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "s1" FROM "tenant_0123456789abcdef"',
      'REVOKE ALL ON SCHEMA "s1" FROM "tenant_0123456789abcdef"',
      'DROP ROLE "tenant_0123456789abcdef"',
    ]);
  });
  it("refuses a non-tenant role or an unsafe schema", () => {
    expect(() => buildReapStatements("neondb_owner", [])).toThrow();
    expect(() => buildReapStatements("tenant_0123456789abcdef", ['x"; DROP'])).toThrow();
  });
});

describe("reapTenantRoles", () => {
  it("drops only roles whose tenant has no databases row", async () => {
    const live = await tenantRoleName("user-1");
    const orphan = await tenantRoleName("anon:gone");
    const pg = stubPg([
      { rolname: live, nspname: "a1" },
      { rolname: orphan, nspname: "b1" },
      { rolname: orphan, nspname: "b2" },
    ]);
    const result = await reapTenantRoles(pg, stubD1(["user-1"]));
    expect(result).toEqual({ rolesTotal: 2, rolesLive: 1, reaped: 1, failed: 0 });
    expect(pg.batches).toHaveLength(1);
    expect(pg.batches[0]?.map((s) => s.sql).join("\n")).toContain(`DROP ROLE "${orphan}"`);
    expect(pg.batches[0]?.filter((s) => s.sql.startsWith("REVOKE"))).toHaveLength(6);
  });

  it("batch 0 counts without dropping (the founder gate)", async () => {
    const pg = stubPg([{ rolname: await tenantRoleName("anon:gone"), nspname: null }]);
    const result = await reapTenantRoles(pg, stubD1(["user-1"]), 0);
    expect(result).toEqual({ rolesTotal: 1, rolesLive: 0, reaped: 0, failed: 0 });
    expect(pg.batches).toHaveLength(0);
  });

  it("caps drops per run and isolates a failing role", async () => {
    const orphans = await Promise.all(["a", "b", "c"].map((t) => tenantRoleName(`anon:${t}`)));
    const pg = stubPg(
      orphans.map((rolname) => ({ rolname, nspname: null })),
      orphans[0],
    );
    const result = await reapTenantRoles(pg, stubD1(["user-1"]), 2);
    expect(result).toEqual({ rolesTotal: 3, rolesLive: 0, reaped: 1, failed: 1 });
  });

  it("never drops anything when D1 reports no tenants", async () => {
    const pg = stubPg([{ rolname: await tenantRoleName("user-1"), nspname: "a1" }]);
    const result = await reapTenantRoles(pg, stubD1([]));
    expect(result.reaped).toBe(0);
    expect(pg.batches).toHaveLength(0);
  });
});
