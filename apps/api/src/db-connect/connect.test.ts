// Unit tests for the BYO connect orchestrator. All deps are plain
// stubs (no `vi.mock`) — matching the db-create orchestrator test
// convention. D1 is stubbed at the prepared-statement level: the SELECT
// id collision probe and the INSERT are the only two statements the
// orchestrator issues, so the stub routes on the SQL prefix.

import type { ClickhouseConnSpec, ClickhouseQueryFn, DnsResolver } from "@nlqdb/db";
import { describe, expect, it, vi } from "vitest";
import { openSecret } from "../secret-envelope.ts";
import { type ConnectByoArgs, type ConnectByoDeps, connectByoDb } from "./connect.ts";
import { BYO_SECRET_REF_SENTINEL } from "./constants.ts";

const KEK = "test-kek-0123456789abcdef0123456789abcdef";

// A DnsResolver that always succeeds (resolves to a public-looking IP) so
// `validateByoConnection`'s egress guard passes. Tests that want a 400
// pass a resolver that rejects.
const okResolver: DnsResolver = async () => ["93.184.216.34"];

// D1 stub: tracks INSERTed rows in a Map keyed by id; the SELECT id probe
// reads from `existingIds` (seeded by the test to force a collision).
function stubD1(existingIds: Set<string> = new Set()) {
  const inserted: Record<string, unknown[]> = {};
  const prepare = vi.fn((sql: string) => {
    if (sql.startsWith("SELECT id")) {
      return {
        bind: (id: string) => ({
          first: async () => (existingIds.has(id) ? { id } : null),
        }),
      };
    }
    // INSERT
    return {
      bind: (...params: unknown[]) => ({
        run: async () => {
          inserted[params[0] as string] = params;
          // After a successful insert the id is now "taken".
          existingIds.add(params[0] as string);
          return { success: true };
        },
      }),
    };
  });
  return { d1: { prepare } as unknown as D1Database, inserted };
}

function chSchema(): Awaited<ReturnType<ClickhouseQueryFn>> {
  return { rows: [] };
}

function makeChQuery(): ClickhouseQueryFn {
  // introspectClickhouse issues several system.* queries; returning an
  // empty rowset for all of them yields a schema with no tables, which
  // renders to a short non-empty preview. Good enough for the connect
  // flow assertions (we're not testing the renderer here).
  return vi.fn(async () => chSchema());
}

function baseDeps(overrides: Partial<ConnectByoDeps> = {}): ConnectByoDeps {
  return {
    resolve: okResolver,
    kek: KEK,
    d1: stubD1().d1,
    randomSuffix: () => "a1b2c3",
    buildClickhouseQuery: (_spec: ClickhouseConnSpec) => makeChQuery(),
    buildPostgresQuery: () => async () => ({ rows: [], rowCount: 0 }),
    ...overrides,
  };
}

const CH_ARGS: ConnectByoArgs = {
  engine: "clickhouse",
  connectionUrl: "https://user:secret@ch.example.com:8443/?database=analytics",
  tenantId: "user_1",
};

const PG_ARGS: ConnectByoArgs = {
  engine: "postgres",
  connectionUrl: "postgres://user:secret@pg.example.com:5432/shop",
  tenantId: "user_1",
};

describe("connectByoDb", () => {
  it("happy path — ClickHouse: validates, introspects, seals, inserts a BYO row", async () => {
    const { d1, inserted } = stubD1();
    const result = await connectByoDb(baseDeps({ d1 }), CH_ARGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dbId).toBe("db_analytics_a1b2c3");
    expect(result.engine).toBe("clickhouse");
    // One row inserted, with the sentinel ref + a sealed blob.
    const row = inserted[result.dbId];
    if (!row) throw new Error("expected an inserted row");
    // params: id, tenant, engine, secret_ref, blob, schema_hash, schema_text
    expect(row[3]).toBe(BYO_SECRET_REF_SENTINEL);
    expect(typeof row[4]).toBe("string");
    // The blob is a sealed envelope, NOT the plaintext URL.
    expect(row[4]).not.toContain("secret");
    expect(row[4]).not.toContain("ch.example.com");
    // It opens back to the original URL under the dbId context.
    const opened = await openSecret(row[4] as string, {
      kek: KEK,
      context: `dbconn:${result.dbId}`,
    });
    expect(opened).toBe(CH_ARGS.connectionUrl);
  });

  it("happy path — Postgres: derives slug from the target database name", async () => {
    const { d1, inserted } = stubD1();
    const result = await connectByoDb(baseDeps({ d1 }), PG_ARGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dbId).toBe("db_shop_a1b2c3");
    expect(result.engine).toBe("postgres");
    expect(inserted[result.dbId]?.[2]).toBe("postgres");
  });

  it("uses the caller-supplied name for the slug when provided", async () => {
    const result = await connectByoDb(baseDeps(), { ...CH_ARGS, name: "My Prod CH!" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dbId).toBe("db_my_prod_ch_a1b2c3");
    expect(result.name).toBe("My Prod CH!");
  });

  it("returns 503 when the KEK is unset — before any network I/O", async () => {
    const resolve = vi.fn(okResolver);
    const result = await connectByoDb(baseDeps({ kek: undefined, resolve }), CH_ARGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
    // No validation / DNS resolution happened — the gate is first.
    expect(resolve).not.toHaveBeenCalled();
  });

  it("returns 400 when egress validation fails (resolver rejects)", async () => {
    const result = await connectByoDb(
      baseDeps({ resolve: async () => Promise.reject(new Error("nope")) }),
      CH_ARGS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    // The message never echoes the URL/secret.
    expect(result.message).not.toContain("secret");
  });

  it("returns 400 on a malformed connection URL", async () => {
    const result = await connectByoDb(baseDeps(), {
      ...CH_ARGS,
      connectionUrl: "not a url",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("returns 502 when introspection throws — never echoes the error", async () => {
    const result = await connectByoDb(
      baseDeps({
        buildClickhouseQuery: () => async () => {
          throw new Error("ECONNREFUSED ch.example.com");
        },
      }),
      CH_ARGS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.message).not.toContain("ch.example.com");
    expect(result.message).not.toContain("ECONNREFUSED");
  });

  it("re-mints the dbId on a collision, then succeeds", async () => {
    // Seed the first suffix's id as taken; the second mint wins.
    const taken = new Set<string>(["db_analytics_dup001"]);
    const { d1, inserted } = stubD1(taken);
    const suffixes = ["dup001", "fresh2"];
    let i = 0;
    const result = await connectByoDb(
      baseDeps({ d1, randomSuffix: () => suffixes[i++] ?? "zzzzzz" }),
      CH_ARGS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dbId).toBe("db_analytics_fresh2");
    expect(inserted["db_analytics_fresh2"]).toBeDefined();
  });

  it("mints a pk_live key via the injected hook on success", async () => {
    const mintPkLive = vi.fn(async () => "pk_live_abc123");
    const result = await connectByoDb(baseDeps({ mintPkLive }), CH_ARGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pkLive).toBe("pk_live_abc123");
    expect(mintPkLive).toHaveBeenCalledWith(result.dbId, "user_1");
  });

  it("swallows a pk_live mint failure (DB is already committed)", async () => {
    const result = await connectByoDb(
      baseDeps({
        mintPkLive: async () => {
          throw new Error("d1 down");
        },
      }),
      CH_ARGS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pkLive).toBeNull();
  });
});
