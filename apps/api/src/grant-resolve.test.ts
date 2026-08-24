// Granted-read RESOLVE-leg tests (SK-EKP-008, EK-06 box 2). `resolveGrantedRead`
// owns the I/O that turns (buyer, requestedDbId) into the resolved (grant,
// ownerDb, schema) `planGrantedRead` consumes. These pin the fail-closed matrix
// without a live DB: no grant → no_grant; a grant whose identity does not match
// the request → no_grant; a live grant on a deleted owner DB → owner_db_missing;
// a live grant on a non-hosted (BYO / ClickHouse) DB → not_grantable; and the
// happy path yields the owner DB row plus the schema name the hosted convention
// derives. The live "owner rows, nothing else" proof stays the integration
// test's job (`grant-scoping.integration.test.ts`); this fixes what resolves.

import { describe, expect, it, vi } from "vitest";
import type { DbRecord } from "./ask/types.ts";
import { resolveGrantedRead } from "./grant-resolve.ts";
import type { GrantRecord } from "./grants.ts";

const BUYER = "user_buyer_2";
const OWNER = "user_owner_1";
const OWNER_DB_ID = "db_lang_tutor_1";

const GRANT: GrantRecord = {
  id: "11111111-2222-3333-4444-555555555555",
  ownerTenantId: OWNER,
  ownerDbId: OWNER_DB_ID,
  granteeTenantId: BUYER,
  scope: ["lessons", "students"],
  priceModel: null,
  createdAt: 1_700_000_000,
  revokedAt: null,
};

const HOSTED_OWNER_DB: DbRecord = {
  id: OWNER_DB_ID,
  tenantId: OWNER,
  engine: "postgres",
  connectionSecretRef: "NEON_URL",
  schemaHash: "hash_0",
  schemaText: "CREATE TABLE lessons (...)",
  connectionBlob: null,
};

// `resolveActiveGrant` returns `grant`; `resolveOwnerDb` returns `ownerDb`.
// Both are spies so a test can assert WHAT the resolve leg looked up.
function resolve(opts: {
  grant?: GrantRecord | null;
  ownerDb?: DbRecord | null;
  requestedDbId?: string;
}) {
  const resolveActiveGrant = vi.fn(async () => opts.grant ?? null);
  const resolveOwnerDb = vi.fn(async () => opts.ownerDb ?? null);
  const promise = resolveGrantedRead({
    buyerTenantId: BUYER,
    requestedDbId: opts.requestedDbId ?? OWNER_DB_ID,
    resolveActiveGrant,
    resolveOwnerDb,
  });
  return { promise, resolveActiveGrant, resolveOwnerDb };
}

describe("resolveGrantedRead — no live grant fails closed", () => {
  it("rejects no_grant when the buyer holds no active grant on the DB", async () => {
    const { promise, resolveOwnerDb } = resolve({ grant: null });
    expect(await promise).toEqual({ ok: false, reason: "no_grant" });
    // Never touches the owner DB without a grant.
    expect(resolveOwnerDb).not.toHaveBeenCalled();
  });

  it("rejects no_grant when a returned grant's grantee does not match the buyer", async () => {
    const wrongGrantee = { ...GRANT, granteeTenantId: "user_someone_else" };
    const { promise, resolveOwnerDb } = resolve({ grant: wrongGrantee });
    expect(await promise).toEqual({ ok: false, reason: "no_grant" });
    expect(resolveOwnerDb).not.toHaveBeenCalled();
  });

  it("rejects no_grant when a returned grant is for a different owner DB", async () => {
    const otherDb = { ...GRANT, ownerDbId: "db_other_9" };
    const { promise, resolveOwnerDb } = resolve({ grant: otherDb });
    expect(await promise).toEqual({ ok: false, reason: "no_grant" });
    expect(resolveOwnerDb).not.toHaveBeenCalled();
  });
});

describe("resolveGrantedRead — live grant, owner DB unusable", () => {
  it("rejects owner_db_missing when the owner deleted the DB after minting", async () => {
    const { promise } = resolve({ grant: GRANT, ownerDb: null });
    expect(await promise).toEqual({ ok: false, reason: "owner_db_missing" });
  });

  it("resolves the owner DB under the OWNER's tenant, not the buyer's", async () => {
    const { promise, resolveOwnerDb } = resolve({ grant: GRANT, ownerDb: HOSTED_OWNER_DB });
    await promise;
    expect(resolveOwnerDb).toHaveBeenCalledWith(OWNER_DB_ID, OWNER);
  });

  it("rejects not_grantable when the owner DB is a BYO Postgres (sealed blob)", async () => {
    const byo = { ...HOSTED_OWNER_DB, connectionBlob: "sealed_blob" };
    const { promise } = resolve({ grant: GRANT, ownerDb: byo });
    expect(await promise).toEqual({ ok: false, reason: "not_grantable" });
  });

  it("rejects not_grantable when the owner DB is a ClickHouse engine", async () => {
    const ch = { ...HOSTED_OWNER_DB, engine: "clickhouse" as const };
    const { promise } = resolve({ grant: GRANT, ownerDb: ch });
    expect(await promise).toEqual({ ok: false, reason: "not_grantable" });
  });
});

describe("resolveGrantedRead — an authorized granted read resolves", () => {
  it("returns the grant, the owner DB, and the db_-stripped schema name", async () => {
    const { promise } = resolve({ grant: GRANT, ownerDb: HOSTED_OWNER_DB });
    const res = await promise;
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.grant).toBe(GRANT);
    expect(res.ownerDb).toBe(HOSTED_OWNER_DB);
    // `db_lang_tutor_1` → `lang_tutor_1`, matching the hosted exec convention.
    expect(res.schemaName).toBe("lang_tutor_1");
  });

  it("uses the raw id as the schema name when there is no db_ prefix", async () => {
    const noPrefix = { ...HOSTED_OWNER_DB, id: "lang_tutor_legacy" };
    const grant = { ...GRANT, ownerDbId: "lang_tutor_legacy" };
    const { promise } = resolve({
      grant,
      ownerDb: noPrefix,
      requestedDbId: "lang_tutor_legacy",
    });
    const res = await promise;
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.schemaName).toBe("lang_tutor_legacy");
  });
});
