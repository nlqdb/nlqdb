// Unit tests for the SK-MCP-010 slice-1 helpers: `sk_live_` /
// `sk_mcp_` minting + `lookupSkKey` dispatch. The pk_live_ helpers
// (mintPkLiveKey, lookupPkLiveKey) already ride on the db.create path
// which has its own integration coverage; this file exercises the new
// Phase-2 surface in isolation against a stub D1.
//
// Coverage shape mirrors anon-adopt.test.ts (pure-function tests
// against a vi.fn-driven D1 stub — no Miniflare needed).

import { describe, expect, it, vi } from "vitest";
import {
  bumpKeyLastUsed,
  listKeysByTenant,
  lookupPkLiveKey,
  lookupSkKey,
  mintPkLiveKey,
  mintSkLiveKey,
  mintSkMcpKey,
  PK_LIVE_PREFIX,
  revokeKeyById,
  SK_LIVE_PREFIX,
  SK_MCP_PREFIX,
} from "../src/api-keys.ts";

type InsertCall = { sql: string; params: unknown[] };
type SelectRow = Record<string, unknown> | null;
type AllRows = Record<string, unknown>[];

type StubOpts = {
  // Row returned by `.first()` on SELECT statements. Pass an array to
  // serve different rows on successive SELECT calls (used by the
  // mint-then-lookup round-trip tests).
  selectRow?: SelectRow | SelectRow[];
  // Rows returned by `.all()` on SELECT statements (used by listKeysByTenant).
  selectRows?: AllRows;
};

function stubDb(opts: StubOpts = {}): {
  db: D1Database;
  inserts: InsertCall[];
  updates: InsertCall[];
} {
  const inserts: InsertCall[] = [];
  const updates: InsertCall[] = [];
  const selectQueue: SelectRow[] = Array.isArray(opts.selectRow)
    ? [...opts.selectRow]
    : opts.selectRow === undefined
      ? []
      : [opts.selectRow];

  const prepare = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockImplementation((...params: unknown[]) => ({
      first: vi.fn().mockImplementation(async () => {
        if (!sql.startsWith("SELECT")) return null;
        if (selectQueue.length === 0) return null;
        return selectQueue.shift() ?? null;
      }),
      all: vi.fn().mockImplementation(async () => ({
        results: opts.selectRows ?? [],
        success: true,
        meta: {},
      })),
      run: vi.fn().mockImplementation(async () => {
        if (sql.startsWith("INSERT")) inserts.push({ sql, params: [...params] });
        if (sql.startsWith("UPDATE")) updates.push({ sql, params: [...params] });
        return { success: true, meta: { changes: 1 } };
      }),
    })),
  }));

  return { db: { prepare } as unknown as D1Database, inserts, updates };
}

const SECRET = "test-secret-do-not-use-in-prod";

describe("mintPkLiveKey", () => {
  // Bind order: (id, tenant_id, db_id, key_hash, last_4) — 5 params,
  // `'pk_live'` is a SQL literal in the VALUES clause.
  it("emits a pk_live_ plaintext and writes one INSERT row", async () => {
    const { db, inserts } = stubDb();
    const plaintext = await mintPkLiveKey(db, SECRET, "db_1", "tenant_1");
    expect(plaintext.startsWith(PK_LIVE_PREFIX)).toBe(true);
    expect(plaintext.length).toBe(PK_LIVE_PREFIX.length + 32);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.sql).toContain("INSERT INTO api_keys");
    const params = inserts[0]?.params ?? [];
    expect(params[1]).toBe("tenant_1");
    expect(params[2]).toBe("db_1");
    expect(params[3]).not.toBe(plaintext); // hash, not plaintext
    expect(params[4]).toBe(plaintext.slice(-4));
  });
});

describe("mintSkLiveKey", () => {
  // Bind order: (id, tenant_id, key_hash, last_4, name) — 5 params,
  // `db_id` is `NULL` and `key_type` is `'sk_live'` as SQL literals.
  it("emits an sk_live_ plaintext, persists name + last_4, no db_id", async () => {
    const { db, inserts } = stubDb();
    const { id, plaintext } = await mintSkLiveKey(db, SECRET, "u_alice", "CI on GitHub Actions");
    expect(plaintext.startsWith(SK_LIVE_PREFIX)).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const sql = inserts[0]?.sql ?? "";
    expect(sql).toContain("'sk_live'");
    expect(sql).toContain("NULL");
    const params = inserts[0]?.params ?? [];
    expect(params[1]).toBe("u_alice");
    expect(params[3]).toBe(plaintext.slice(-4));
    expect(params[4]).toBe("CI on GitHub Actions");
  });

  it("accepts a null name for unlabeled keys", async () => {
    const { db, inserts } = stubDb();
    await mintSkLiveKey(db, SECRET, "u_alice", null);
    expect(inserts[0]?.params[4]).toBeNull();
  });
});

describe("mintSkMcpKey", () => {
  // Bind order: (id, tenant_id, key_hash, last_4, mcp_host, device_id) — 6 params.
  it("emits sk_mcp_<host>_<device>_<rand> and persists the claims", async () => {
    const { db, inserts } = stubDb();
    const { plaintext } = await mintSkMcpKey(db, SECRET, "u_alice", "Cursor", "macbook-air");
    expect(plaintext.startsWith(`${SK_MCP_PREFIX}cursor_macbook-air_`)).toBe(true);
    const params = inserts[0]?.params ?? [];
    expect(params[1]).toBe("u_alice");
    expect(params[4]).toBe("Cursor"); // claim stored verbatim; the on-the-wire slug is normalised
    expect(params[5]).toBe("macbook-air");
  });

  it("normalises non-slug characters in the on-the-wire host/device segments", async () => {
    const { db } = stubDb();
    const { plaintext } = await mintSkMcpKey(
      db,
      SECRET,
      "u_alice",
      "Claude Desktop",
      "Mac Mini #1",
    );
    // Spaces, punctuation, capitals → lowercase a-z0-9 with `-`.
    expect(plaintext.startsWith(`${SK_MCP_PREFIX}claude-desktop_mac-mini-1_`)).toBe(true);
  });

  it("falls back to `x` for fully-non-slug host/device strings", async () => {
    const { db } = stubDb();
    const { plaintext } = await mintSkMcpKey(db, SECRET, "u_alice", "!!!", "***");
    expect(plaintext.startsWith(`${SK_MCP_PREFIX}x_x_`)).toBe(true);
  });
});

describe("lookupPkLiveKey", () => {
  it("returns null on a non-pk_live prefix without hitting D1", async () => {
    const { db } = stubDb();
    const found = await lookupPkLiveKey(db, SECRET, "sk_live_xxx");
    expect(found).toBeNull();
  });

  it("returns {dbId, tenantId} on a hash match", async () => {
    const { db } = stubDb({ selectRow: { db_id: "db_1", tenant_id: "u_alice" } });
    const found = await lookupPkLiveKey(db, SECRET, "pk_live_abc");
    expect(found).toEqual({ dbId: "db_1", tenantId: "u_alice" });
  });

  it("returns null on a hash miss", async () => {
    const { db } = stubDb({ selectRow: null });
    const found = await lookupPkLiveKey(db, SECRET, "pk_live_unknown");
    expect(found).toBeNull();
  });
});

describe("lookupSkKey", () => {
  it("returns null on prefixes other than sk_live_ / sk_mcp_", async () => {
    const { db } = stubDb();
    expect(await lookupSkKey(db, SECRET, "pk_live_xxx")).toBeNull();
    expect(await lookupSkKey(db, SECRET, "anon_xxx")).toBeNull();
  });

  it("returns an sk_live record on a hash match", async () => {
    const { db } = stubDb({
      selectRow: {
        id: "k_1",
        tenant_id: "u_alice",
        key_type: "sk_live",
        mcp_host: null,
        device_id: null,
      },
    });
    const found = await lookupSkKey(db, SECRET, "sk_live_abc");
    expect(found).toEqual({ kind: "sk_live", tenantId: "u_alice", keyId: "k_1" });
  });

  it("returns an sk_mcp record carrying the host + device claims", async () => {
    const { db } = stubDb({
      selectRow: {
        id: "k_2",
        tenant_id: "u_alice",
        key_type: "sk_mcp",
        mcp_host: "cursor",
        device_id: "macbook-air",
      },
    });
    const found = await lookupSkKey(db, SECRET, "sk_mcp_cursor_macbook-air_xxx");
    expect(found).toEqual({
      kind: "sk_mcp",
      tenantId: "u_alice",
      keyId: "k_2",
      mcpHost: "cursor",
      deviceId: "macbook-air",
    });
  });

  it("rejects a mis-migrated sk_mcp row missing its host claim", async () => {
    const { db } = stubDb({
      selectRow: {
        id: "k_3",
        tenant_id: "u_alice",
        key_type: "sk_mcp",
        mcp_host: null,
        device_id: "macbook-air",
      },
    });
    const found = await lookupSkKey(db, SECRET, "sk_mcp_cursor_macbook-air_xxx");
    expect(found).toBeNull();
  });

  it("returns null on a hash miss", async () => {
    const { db } = stubDb({ selectRow: null });
    expect(await lookupSkKey(db, SECRET, "sk_live_unknown")).toBeNull();
  });
});

describe("mint → lookup round trip (sk_live)", () => {
  it("returns the freshly-minted sk_live row when the same key is looked up", async () => {
    // First call (mint) ignores the SELECT queue; second call (lookup)
    // serves a row matching what we just stored.
    const { db } = stubDb({
      selectRow: {
        id: "k_1",
        tenant_id: "u_alice",
        key_type: "sk_live",
        mcp_host: null,
        device_id: null,
      },
    });
    const { plaintext } = await mintSkLiveKey(db, SECRET, "u_alice", null);
    const found = await lookupSkKey(db, SECRET, plaintext);
    expect(found?.kind).toBe("sk_live");
    expect(found?.tenantId).toBe("u_alice");
  });
});

describe("bumpKeyLastUsed", () => {
  it("issues one throttled UPDATE; the WHERE skips writes inside the 60s window", async () => {
    const { db, updates } = stubDb();
    await bumpKeyLastUsed(db, "k_1");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sql).toContain("UPDATE api_keys SET last_used_at");
    expect(updates[0]?.sql).toContain("last_used_at < unixepoch() -");
    expect(updates[0]?.params[0]).toBe("k_1");
    expect(updates[0]?.params[1]).toBe(60);
  });

  it("swallows D1 errors so a failed bump cannot surface as a waitUntil rejection", async () => {
    const throwingDb = {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            throw new Error("d1 down");
          },
        }),
      }),
    } as unknown as D1Database;
    await expect(bumpKeyLastUsed(throwingDb, "k_1")).resolves.toBeUndefined();
  });
});

describe("listKeysByTenant", () => {
  it("maps D1 columns to camelCase `KeyRecord` fields", async () => {
    const { db } = stubDb({
      selectRows: [
        {
          id: "k_1",
          key_type: "sk_live",
          last_4: "a4f7",
          name: "CI on GitHub",
          db_id: null,
          mcp_host: null,
          device_id: null,
          last_used_at: 1_700_000_000,
          created_at: 1_699_900_000,
          revoked_at: null,
        },
        {
          id: "k_2",
          key_type: "sk_mcp",
          last_4: "9c12",
          name: null,
          db_id: null,
          mcp_host: "cursor",
          device_id: "macbook-air",
          last_used_at: null,
          created_at: 1_699_800_000,
          revoked_at: 1_699_850_000,
        },
      ],
    });
    const keys = await listKeysByTenant(db, "u_alice");
    expect(keys).toEqual([
      {
        id: "k_1",
        keyType: "sk_live",
        last4: "a4f7",
        name: "CI on GitHub",
        dbId: null,
        mcpHost: null,
        deviceId: null,
        lastUsedAt: 1_700_000_000,
        createdAt: 1_699_900_000,
        revokedAt: null,
      },
      {
        id: "k_2",
        keyType: "sk_mcp",
        last4: "9c12",
        name: null,
        dbId: null,
        mcpHost: "cursor",
        deviceId: "macbook-air",
        lastUsedAt: null,
        createdAt: 1_699_800_000,
        revokedAt: 1_699_850_000,
      },
    ]);
  });

  it("returns an empty array when the tenant has no keys", async () => {
    const { db } = stubDb({ selectRows: [] });
    expect(await listKeysByTenant(db, "u_empty")).toEqual([]);
  });

  it("scopes the SELECT to the caller's tenant_id (no cross-tenant leak)", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => {
          calls.push({ sql, params });
          return {
            all: async () => ({ results: [], success: true, meta: {} }),
          };
        },
      }),
    } as unknown as D1Database;
    await listKeysByTenant(db, "u_alice");
    expect(calls[0]?.sql).toContain("WHERE tenant_id = ?");
    expect(calls[0]?.params).toEqual(["u_alice"]);
  });
});

describe("revokeKeyById", () => {
  // The new flow is a single conditional UPDATE plus a probe SELECT to
  // distinguish "already revoked" from "not found" only when the UPDATE
  // no-op'd. The stub returns `changes` from `.run()` and a row from
  // `.first()` when the SELECT runs.
  function revokeStub(opts: { updateChanges: number; existsAfter?: boolean }): {
    db: D1Database;
    updates: InsertCall[];
  } {
    const updates: InsertCall[] = [];
    const prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...params: unknown[]) => ({
        first: vi.fn().mockImplementation(async () => {
          if (sql.startsWith("SELECT")) return opts.existsAfter ? { hit: 1 } : null;
          return null;
        }),
        run: vi.fn().mockImplementation(async () => {
          if (sql.startsWith("UPDATE")) updates.push({ sql, params: [...params] });
          return { success: true, meta: { changes: opts.updateChanges } };
        }),
      })),
    }));
    return { db: { prepare } as unknown as D1Database, updates };
  }

  it("returns `revoked` when the conditional UPDATE wins (changes === 1)", async () => {
    const { db, updates } = revokeStub({ updateChanges: 1 });
    const outcome = await revokeKeyById(db, "u_alice", "k_1");
    expect(outcome).toBe("revoked");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sql).toContain("UPDATE api_keys SET revoked_at = unixepoch()");
    expect(updates[0]?.sql).toContain("WHERE id = ? AND tenant_id = ?");
    // BYOLLM rows are managed via /v1/keys/byollm, never this bearer surface.
    expect(updates[0]?.sql).toContain("key_type != 'byollm'");
    expect(updates[0]?.sql).toContain("revoked_at IS NULL");
    expect(updates[0]?.params).toEqual(["k_1", "u_alice"]);
  });

  it("returns `already_revoked` when UPDATE no-ops AND the row still exists", async () => {
    // The conditional UPDATE's `revoked_at IS NULL` filter prevented the
    // write; the follow-up SELECT confirms the row is in the tenant — so
    // it must already be revoked. Idempotent re-DELETE per RFC 9110.
    const { db } = revokeStub({ updateChanges: 0, existsAfter: true });
    const outcome = await revokeKeyById(db, "u_alice", "k_1");
    expect(outcome).toBe("already_revoked");
  });

  it("returns `not_found` when UPDATE no-ops AND no row matches the tenant", async () => {
    // Same envelope whether the id is unknown or belongs to another tenant
    // — the SELECT's `tenant_id = ?` filter collapses both cases so the
    // caller cannot distinguish "wrong tenant" from "unknown" (no
    // existence leak across tenants).
    const { db } = revokeStub({ updateChanges: 0, existsAfter: false });
    const outcome = await revokeKeyById(db, "u_alice", "k_owned_by_bob");
    expect(outcome).toBe("not_found");
  });

  it("is race-safe: two concurrent revokes both observe a non-`not_found` outcome", async () => {
    // Simulates the TOCTOU: caller A's UPDATE wins (changes=1), caller B's
    // UPDATE finds the row already revoked (changes=0, follow-up SELECT
    // confirms the row exists). B sees `already_revoked` — never the
    // false `not_found` the previous (SELECT-then-UPDATE) shape risked.
    const a = revokeStub({ updateChanges: 1 });
    const b = revokeStub({ updateChanges: 0, existsAfter: true });
    const [outA, outB] = await Promise.all([
      revokeKeyById(a.db, "u_alice", "k_1"),
      revokeKeyById(b.db, "u_alice", "k_1"),
    ]);
    expect(outA).toBe("revoked");
    expect(outB).toBe("already_revoked");
  });
});
