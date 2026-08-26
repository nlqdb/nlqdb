// EK-06 box 2 sub-piece (h) — the granted-read production I/O wiring
// (`grant-ask-io.ts`). Proves the composition a reviewer audits once: the
// active-grant lookup rides the ≤30 s status cache keyed per (buyer, owner-DB),
// the owner DB resolves off the injected D1, usage meters on that same handle,
// and the idempotency-key source defaults to a real generator. Node-safe: the
// module under test never imports `cloudflare:workers`/`neon`.

import { describe, expect, it, vi } from "vitest";
import type { HostedExecStep } from "./ask/exec-steps.ts";
import type { DbRecord, QueryResult } from "./ask/types.ts";
import { buildGrantedReadIo, type GrantStatusCache, grantStatusCacheKey } from "./grant-ask-io.ts";
import type { GrantLookup } from "./grant-status.ts";
import type { GrantRecord } from "./grants.ts";

const GRANT: GrantRecord = {
  id: "grant_1",
  ownerTenantId: "owner",
  ownerDbId: "db_owner",
  granteeTenantId: "buyer",
  scope: ["episodes"],
  priceModel: null,
  createdAt: 1,
  revokedAt: null,
};

// Minimal D1 fake: one prepared-statement shape whose `first`/`run` return
// canned values, so `resolveDb` and `recordGrantUsage` run for real over it.
function fakeD1(opts: { first?: unknown; changes?: number }): D1Database {
  const stmt = {
    bind: () => stmt,
    first: async () => opts.first ?? null,
    run: async () => ({ meta: { changes: opts.changes ?? 0 } }),
  };
  return { prepare: () => stmt } as unknown as D1Database;
}

const noRun = (): Promise<QueryResult> => Promise.reject(new Error("runExecSteps not expected"));

describe("grantStatusCacheKey", () => {
  it("space-joins (buyer, owner-DB) so distinct pairs never collide", () => {
    expect(grantStatusCacheKey("buyer", "db_owner")).toBe("buyer db_owner");
    expect(grantStatusCacheKey("buyer", "db_owner")).not.toBe(
      grantStatusCacheKey("buyerdb_owner", ""),
    );
  });
});

describe("buildGrantedReadIo — resolveActiveGrant rides the status cache", () => {
  it("calls the cache with the per-pair key and returns its verdict", async () => {
    let seenKey: string | undefined;
    let seenLookup: GrantLookup | undefined;
    const statusCache: GrantStatusCache = {
      status: async (key, lookup) => {
        seenKey = key;
        seenLookup = lookup;
        return GRANT;
      },
    };
    const io = buildGrantedReadIo({ d1: fakeD1({}), statusCache, runExecSteps: noRun });

    const got = await io.resolveActiveGrant("buyer", "db_owner");

    expect(got).toBe(GRANT);
    expect(seenKey).toBe("buyer db_owner");
    // The injected lookup is the fail-closed D1 read — invoking it hits
    // `getActiveGrant` on the wired handle (row present ⇒ a record back).
    const row = {
      id: "grant_1",
      owner_tenant_id: "owner",
      owner_db_id: "db_owner",
      grantee_tenant_id: "buyer",
      scope: JSON.stringify(["episodes"]),
      price_model: null,
      created_at: 1,
      revoked_at: null,
    };
    const ioWithRow = buildGrantedReadIo({
      d1: fakeD1({ first: row }),
      statusCache,
      runExecSteps: noRun,
    });
    await ioWithRow.resolveActiveGrant("buyer", "db_owner");
    const looked = await seenLookup?.();
    expect(looked?.id).toBe("grant_1");
  });

  it("passes a null cache verdict straight through (fail-closed)", async () => {
    const statusCache: GrantStatusCache = { status: async () => null };
    const io = buildGrantedReadIo({ d1: fakeD1({}), statusCache, runExecSteps: noRun });
    expect(await io.resolveActiveGrant("buyer", "db_owner")).toBeNull();
  });
});

describe("buildGrantedReadIo — owner-DB resolve + metering ride the wired D1", () => {
  const statusCache: GrantStatusCache = { status: async () => null };

  it("resolveOwnerDb maps the D1 row to a DbRecord", async () => {
    const dbRow = {
      id: "db_owner",
      tenant_id: "owner",
      engine: "postgres",
      connection_secret_ref: "NEON_URL",
      schema_hash: "h",
      schema_text: "t",
      connection_blob: null,
    };
    const io = buildGrantedReadIo({
      d1: fakeD1({ first: dbRow }),
      statusCache,
      runExecSteps: noRun,
    });
    const got = (await io.resolveOwnerDb("db_owner", "owner")) as DbRecord;
    expect(got.id).toBe("db_owner");
    expect(got.tenantId).toBe("owner");
    expect(got.connectionSecretRef).toBe("NEON_URL");
    expect(got.connectionBlob).toBeNull();
  });

  it("recordUsage reports recorded=true on insert, false on replay", async () => {
    const usage = {
      grantId: "grant_1",
      ownerTenantId: "owner",
      ownerDbId: "db_owner",
      granteeTenantId: "buyer",
      idempotencyKey: "key_1",
    };
    const inserted = buildGrantedReadIo({
      d1: fakeD1({ changes: 1 }),
      statusCache,
      runExecSteps: noRun,
    });
    expect(await inserted.recordUsage(usage)).toEqual({ recorded: true });

    const replayed = buildGrantedReadIo({
      d1: fakeD1({ changes: 0 }),
      statusCache,
      runExecSteps: noRun,
    });
    expect(await replayed.recordUsage(usage)).toEqual({ recorded: false });
  });
});

describe("buildGrantedReadIo — injected pieces are passed through", () => {
  const statusCache: GrantStatusCache = { status: async () => null };

  it("runExecSteps is the injected runner verbatim", async () => {
    const steps: HostedExecStep[] = [{ text: "SELECT 1", params: [] }];
    const result: QueryResult = { rows: [{ n: 1 }], rowCount: 1 };
    const runExecSteps = vi.fn(async () => result);
    const ownerDb = { id: "db_owner" } as DbRecord;
    const io = buildGrantedReadIo({ d1: fakeD1({}), statusCache, runExecSteps });
    expect(await io.runExecSteps(ownerDb, steps)).toBe(result);
    expect(runExecSteps).toHaveBeenCalledWith(ownerDb, steps);
  });

  it("newIdempotencyKey defaults to a real generator, override wins", () => {
    const dflt = buildGrantedReadIo({ d1: fakeD1({}), statusCache, runExecSteps: noRun });
    expect(typeof dflt.newIdempotencyKey()).toBe("string");
    expect(dflt.newIdempotencyKey().length).toBeGreaterThan(0);

    const fixed = buildGrantedReadIo({
      d1: fakeD1({}),
      statusCache,
      runExecSteps: noRun,
      newIdempotencyKey: () => "fixed-key",
    });
    expect(fixed.newIdempotencyKey()).toBe("fixed-key");
  });
});
