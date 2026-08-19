// Unit tests for `connectSupabaseMgmt` — the Management-API connect
// orchestrator (`SK-DBCONN-003`, Option B). Deps are plain stubs (matching the
// `connectByoDb` test convention). The Management-API `query` is injected as a
// fake, so introspection runs with no network. Proves: the `databases` row is
// written with the mgmt sentinel + `postgres` engine, the grant row seals a
// token that round-trips under AAD `dboauth:<dbId>`, a missing KEK is a 503, and
// an introspection failure is one sentence that never leaks the token.

import type { PostgresQueryFn } from "@nlqdb/db";
import { describe, expect, it, vi } from "vitest";
import { openSecret } from "../secret-envelope.ts";
import {
  type ConnectSupabaseMgmtArgs,
  type ConnectSupabaseMgmtDeps,
  connectSupabaseMgmt,
  type SupabaseGrantSecret,
} from "./connect-supabase-mgmt.ts";
import { SUPABASE_MGMT_BLOB_SENTINEL } from "./constants.ts";

const KEK = "test-kek-0123456789abcdef0123456789abcdef";

// D1 stub: SELECT id collision probe reads from `existingIds`; the two INSERTs
// (databases, db_oauth_grants) are captured by table.
function stubD1(existingIds: Set<string> = new Set()) {
  const captured: { dbRow?: unknown[]; grantRow?: unknown[] } = {};
  const prepare = vi.fn((sql: string) => {
    if (sql.startsWith("SELECT id")) {
      return {
        bind: (id: string) => ({ first: async () => (existingIds.has(id) ? { id } : null) }),
      };
    }
    const table = sql.includes("INTO db_oauth_grants") ? "grantRow" : "dbRow";
    return {
      bind: (...params: unknown[]) => ({
        run: async () => {
          captured[table as "dbRow" | "grantRow"] = params;
          if (table === "dbRow") existingIds.add(params[0] as string);
          return { success: true };
        },
      }),
    };
  });
  return { d1: { prepare } as unknown as D1Database, captured };
}

// An introspection query that returns one table (a column row for COLUMNS_SQL,
// which is the only read carrying `format_type`; empty for PK/FK) — so the
// rendered schema is non-empty and connect proceeds.
function populatedQuery(): PostgresQueryFn {
  return vi.fn(async (sql: string) => {
    if (sql.includes("format_type")) {
      return {
        rows: [{ table_name: "users", column_name: "id", data_type: "uuid", not_null: true }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });
}

// An introspection query that returns empty rowsets for every read — yields a
// no-table (empty) schema.
function emptyQuery(): PostgresQueryFn {
  return vi.fn(async () => ({ rows: [], rowCount: 0 }));
}

function baseDeps(overrides: Partial<ConnectSupabaseMgmtDeps> = {}): ConnectSupabaseMgmtDeps {
  return {
    kek: KEK,
    d1: stubD1().d1,
    randomSuffix: () => "a1b2c3",
    buildMgmtQuery: () => ({ query: populatedQuery() }),
    ...overrides,
  };
}

const ARGS: ConnectSupabaseMgmtArgs = {
  projectRef: "gutbokjgulkqksgghusn",
  accessToken: "sbp_access_token_secret",
  refreshToken: "sbp_refresh_token_secret",
  expiresAt: 1_800_000_000,
  tenantId: "user_1",
};

describe("connectSupabaseMgmt", () => {
  it("introspects, registers a mgmt row, and seals the token round-trippably", async () => {
    const { d1, captured } = stubD1();
    const mint = vi.fn(async () => "pk_live_xyz");
    const res = await connectSupabaseMgmt(baseDeps({ d1, mintPkLive: mint }), ARGS);

    expect(res).toMatchObject({ ok: true, engine: "postgres", pkLive: "pk_live_xyz" });
    if (!res.ok) throw new Error("expected ok");
    expect(res.dbId).toBe("db_gutbokjgulkqksgghusn_a1b2c3");
    expect(typeof res.schemaPreview).toBe("string");

    // databases row: engine 'postgres' via SQL literal; connection_blob is the
    // mgmt sentinel (params: id, tenant, secret_ref, blob, hash, text, synthetic).
    expect(captured.dbRow?.[0]).toBe("db_gutbokjgulkqksgghusn_a1b2c3");
    expect(captured.dbRow?.[3]).toBe(SUPABASE_MGMT_BLOB_SENTINEL);

    // grant row: (db_id, token_blob, provider_project). The sealed blob opens
    // under AAD dboauth:<dbId> back to the full token secret.
    expect(captured.grantRow?.[0]).toBe(res.dbId);
    expect(captured.grantRow?.[2]).toBe("gutbokjgulkqksgghusn");
    const tokenBlob = captured.grantRow?.[1] as string;
    expect(tokenBlob).not.toContain("sbp_access_token_secret");
    const opened = JSON.parse(
      await openSecret(tokenBlob, { kek: KEK, context: `dboauth:${res.dbId}` }),
    ) as SupabaseGrantSecret;
    expect(opened).toEqual({
      accessToken: "sbp_access_token_secret",
      refreshToken: "sbp_refresh_token_secret",
      expiresAt: 1_800_000_000,
    });
  });

  it("returns a 422 when the public schema has no tables (nothing to query)", async () => {
    const res = await connectSupabaseMgmt(
      baseDeps({ buildMgmtQuery: () => ({ query: emptyQuery() }) }),
      ARGS,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.status).toBe(422);
    expect(res.message).toMatch(/no tables/i);
  });

  it("rejects a malformed project ref with a 400 before any I/O (SSRF guard)", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const res = await connectSupabaseMgmt(baseDeps({ buildMgmtQuery: () => ({ query }) }), {
      ...ARGS,
      projectRef: "../../v1/projects/other",
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
    // Guard fires before the ref can reach the Management-API URL.
    expect(query).not.toHaveBeenCalled();
  });

  it("returns 503 when the KEK is unset (cannot seal)", async () => {
    const res = await connectSupabaseMgmt(baseDeps({ kek: undefined }), ARGS);
    expect(res).toMatchObject({ ok: false, status: 503 });
  });

  it("returns a one-sentence 502 that never leaks the token when introspection fails", async () => {
    const boom: PostgresQueryFn = vi.fn(async () => {
      throw new Error("connection blew up with sbp_access_token_secret in it");
    });
    const res = await connectSupabaseMgmt(
      baseDeps({ buildMgmtQuery: () => ({ query: boom }) }),
      ARGS,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.status).toBe(502);
    expect(res.message).not.toContain("sbp_access_token_secret");
    expect(res.message.split(".").filter((s) => s.trim()).length).toBeLessThanOrEqual(2);
  });
});
