// Unit tests for SK-ASK-024 — exec-time tenant-ACL self-heal.
// The adoption-time retarget (SK-ANON-003) is best-effort and one-shot;
// these prove the exec wrapper converts a missed retarget from a
// permanent brick into a one-query hiccup, and that the heal can never
// fire for BYO rows or unrelated errors.

import { describe, expect, it, vi } from "vitest";
import { isTenantRoleMissingError } from "../src/tenant-role.ts";
import { execWithTenantAclHeal } from "../src/ask/build-deps.ts";
import type { DbRecord, QueryResult } from "../src/ask/types.ts";

const OK: QueryResult = { rows: [{ n: 1 }], rowCount: 1 };
const ROLE_MISSING = Object.assign(
  new Error('role "tenant_9047fe6e4d69026b" does not exist'),
  { code: "22023" },
);

function db(overrides: Partial<DbRecord> = {}): DbRecord {
  return {
    id: "db_users_2b6bb8",
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "DATABASE_URL",
    schemaHash: null,
    schemaText: null,
    connectionBlob: null,
    ...overrides,
  };
}

describe("isTenantRoleMissingError", () => {
  it("matches the SET LOCAL ROLE 22023 shape", () => {
    expect(isTenantRoleMissingError(ROLE_MISSING)).toBe(true);
    // Neon HTTP responses sometimes drop `.code` — message alone suffices.
    expect(
      isTenantRoleMissingError(new Error('role "tenant_0123456789abcdef" does not exist')),
    ).toBe(true);
  });

  it("rejects non-tenant roles and unrelated errors", () => {
    expect(isTenantRoleMissingError(new Error('role "postgres" does not exist'))).toBe(false);
    expect(isTenantRoleMissingError(new Error('relation "users" does not exist'))).toBe(false);
    expect(isTenantRoleMissingError(new Error("connection refused"))).toBe(false);
    // Truncated / wrong-length hex must not match.
    expect(isTenantRoleMissingError(new Error('role "tenant_9047" does not exist'))).toBe(false);
  });
});

describe("execWithTenantAclHeal", () => {
  it("heals a hosted row once and re-runs the statement", async () => {
    const run = vi.fn().mockRejectedValueOnce(ROLE_MISSING).mockResolvedValueOnce(OK);
    const heal = vi.fn(async () => {});
    const result = await execWithTenantAclHeal(db(), "SELECT 1", run, heal);
    expect(result).toEqual(OK);
    expect(heal).toHaveBeenCalledExactlyOnceWith("db_users_2b6bb8", "user_1");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("surfaces the original exec error when the heal itself fails", async () => {
    const run = vi.fn().mockRejectedValue(ROLE_MISSING);
    const heal = vi.fn(async () => {
      throw new Error("neon unreachable");
    });
    await expect(execWithTenantAclHeal(db(), "SELECT 1", run, heal)).rejects.toBe(ROLE_MISSING);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("re-throws when the healed retry still fails (no second heal)", async () => {
    const run = vi.fn().mockRejectedValue(ROLE_MISSING);
    const heal = vi.fn(async () => {});
    await expect(execWithTenantAclHeal(db(), "SELECT 1", run, heal)).rejects.toBe(ROLE_MISSING);
    expect(heal).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never heals a BYO row — role-missing propagates untouched", async () => {
    const run = vi.fn().mockRejectedValue(ROLE_MISSING);
    const heal = vi.fn(async () => {});
    await expect(
      execWithTenantAclHeal(db({ connectionBlob: "sealed" }), "SELECT 1", run, heal),
    ).rejects.toBe(ROLE_MISSING);
    await expect(
      execWithTenantAclHeal(db({ engine: "clickhouse" }), "SELECT 1", run, heal),
    ).rejects.toBe(ROLE_MISSING);
    expect(heal).not.toHaveBeenCalled();
  });

  it("never heals on unrelated exec errors", async () => {
    const boom = new Error("connection refused");
    const run = vi.fn().mockRejectedValue(boom);
    const heal = vi.fn(async () => {});
    await expect(execWithTenantAclHeal(db(), "SELECT 1", run, heal)).rejects.toBe(boom);
    expect(heal).not.toHaveBeenCalled();
  });
});
