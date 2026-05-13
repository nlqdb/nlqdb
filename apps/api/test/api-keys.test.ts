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
  lookupPkLiveKey,
  lookupSkKey,
  mintPkLiveKey,
  mintSkLiveKey,
  mintSkMcpKey,
  PK_LIVE_PREFIX,
  SK_LIVE_PREFIX,
  SK_MCP_PREFIX,
} from "../src/api-keys.ts";

type InsertCall = { sql: string; params: unknown[] };
type SelectRow = Record<string, unknown> | null;

type StubOpts = {
  // Row returned by `.first()` on SELECT statements. Pass an array to
  // serve different rows on successive SELECT calls (used by the
  // mint-then-lookup round-trip tests).
  selectRow?: SelectRow | SelectRow[];
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
  it("emits a pk_live_ plaintext and writes one INSERT row", async () => {
    const { db, inserts } = stubDb();
    const plaintext = await mintPkLiveKey(db, SECRET, "db_1", "tenant_1");
    expect(plaintext.startsWith(PK_LIVE_PREFIX)).toBe(true);
    // 16 random bytes → 32 hex chars after the prefix.
    expect(plaintext.length).toBe(PK_LIVE_PREFIX.length + 32);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.sql).toContain("INSERT INTO api_keys");
    const params = inserts[0]?.params ?? [];
    expect(params[1]).toBe("tenant_1");
    expect(params[2]).toBe("db_1");
    expect(params[4]).not.toBe(plaintext); // we store the hash, never the plaintext
    expect(params[5]).toBe(plaintext.slice(-4)); // last_4 for display
  });
});

describe("mintSkLiveKey", () => {
  it("emits an sk_live_ plaintext, persists name + last_4, no db_id", async () => {
    const { db, inserts } = stubDb();
    const { id, plaintext } = await mintSkLiveKey(db, SECRET, "u_alice", "CI on GitHub Actions");
    expect(plaintext.startsWith(SK_LIVE_PREFIX)).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserts).toHaveLength(1);
    const sql = inserts[0]?.sql ?? "";
    expect(sql).toContain("'sk_live'");
    expect(sql).toContain("db_id");
    expect(sql).toContain("NULL");
    const params = inserts[0]?.params ?? [];
    expect(params[1]).toBe("u_alice");
    expect(params[4]).toBe(plaintext.slice(-4));
    expect(params[5]).toBe("CI on GitHub Actions");
  });

  it("accepts a null name for unlabeled keys", async () => {
    const { db, inserts } = stubDb();
    await mintSkLiveKey(db, SECRET, "u_alice", null);
    expect(inserts[0]?.params[5]).toBeNull();
  });
});

describe("mintSkMcpKey", () => {
  it("emits sk_mcp_<host>_<device>_<rand> and persists the claims", async () => {
    const { db, inserts } = stubDb();
    const { plaintext } = await mintSkMcpKey(db, SECRET, "u_alice", "Cursor", "macbook-air");
    expect(plaintext.startsWith(`${SK_MCP_PREFIX}cursor_macbook-air_`)).toBe(true);
    const params = inserts[0]?.params ?? [];
    expect(params[1]).toBe("u_alice");
    expect(params[5]).toBe("Cursor"); // mcp_host stored verbatim, slug-form only in the on-the-wire token
    expect(params[6]).toBe("macbook-air");
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
  it("issues a single UPDATE on api_keys keyed by id", async () => {
    const { db, updates } = stubDb();
    await bumpKeyLastUsed(db, "k_1");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sql).toContain("UPDATE api_keys SET last_used_at");
    expect(updates[0]?.params).toEqual(["k_1"]);
  });
});
