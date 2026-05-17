import { type NlqClient, NlqdbApiError } from "@nlqdb/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  createListDatabasesCache,
  formatError,
  formatQueryResult,
  formatResult,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  mapSdkError,
} from "../src/index.ts";

function stubClient(overrides: Partial<NlqClient> = {}): NlqClient {
  const base: NlqClient = {
    ask: async () => {
      throw new Error("ask not stubbed");
    },
    askStream: async () => {
      throw new Error("askStream not stubbed");
    },
    listChat: async () => ({ messages: [] }),
    postChat: async () => {
      throw new Error("postChat not stubbed");
    },
    listDatabases: async () => ({ databases: [] }),
    createDatabase: async () => {
      throw new Error("createDatabase not stubbed");
    },
    deleteDatabase: async () => {
      // Destructive ops aren't exposed through MCP per SK-MCP-002;
      // the stub is here only so the mock satisfies the NlqClient
      // interface that the SDK now exports.
      throw new Error("deleteDatabase not stubbed");
    },
    getKeyStatus: async () => ({ revoked: false }),
    redeemOAuthBridgeCode: async () => {
      throw new Error("redeemOAuthBridgeCode not stubbed");
    },
    listKeys: async () => ({ keys: [] }),
    revokeKey: async () => {
      throw new Error("revokeKey not stubbed");
    },
  };
  return { ...base, ...overrides };
}

describe("handleQuery", () => {
  it("returns rows + trace on success", async () => {
    const client = stubClient({
      ask: async (req) => {
        expect(req.goal).toBe("count users");
        expect(req.dbId).toBe("orders");
        return {
          status: "ok",
          rows: [{ count: 42 }],
          rowCount: 1,
          trace: {
            sql: "SELECT COUNT(*) FROM users",
            plan_id: "h:q",
            confidence: 0.92,
            model: "stub",
            cache_hit: false,
          },
        };
      },
    });

    const result = await handleQuery(client, { db: "orders", q: "count users" });

    expect(result).toEqual({
      ok: {
        rows: [{ count: 42 }],
        rowCount: 1,
        trace: { sql: "SELECT COUNT(*) FROM users", confidence: 0.92, cache_hit: false },
      },
    });
  });

  it("surfaces requires_confirm + diff for destructive plans (SK-TRUST-001)", async () => {
    const client = stubClient({
      ask: async (req) => {
        expect(req.confirm).toBeUndefined();
        return {
          status: "ok",
          rows: [],
          rowCount: 0,
          requires_confirm: true,
          diff: {
            verb: "DELETE",
            table: "users",
            affectedRows: 3,
            summary: "Delete 3 inactive users.",
          },
          trace: {
            sql: "DELETE FROM users WHERE last_seen < '2020-01-01'",
            plan_id: "h:d",
            confidence: 0.95,
            model: "stub",
            cache_hit: false,
          },
        };
      },
    });

    const result = await handleQuery(client, { db: "users", q: "delete inactive users" });

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.requires_confirm).toBe(true);
      expect(result.ok.rows).toEqual([]);
      expect(result.ok.diff).toEqual({
        verb: "DELETE",
        table: "users",
        affectedRows: 3,
        summary: "Delete 3 inactive users.",
      });
      expect(result.ok.trace.sql).toContain("DELETE FROM users");
    }
  });

  it("forwards confirm: true to the SDK", async () => {
    const ask = vi.fn(async () => ({
      status: "ok" as const,
      rows: [],
      rowCount: 3,
      trace: {
        sql: "DELETE …",
        plan_id: "h:d",
        confidence: 0.95,
        model: "stub",
        cache_hit: false,
      },
    }));
    const client = stubClient({ ask });

    await handleQuery(client, { db: "users", q: "delete inactive users", confirm: true });

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: true, dbId: "users", goal: "delete inactive users" }),
      expect.any(Object),
    );
  });

  it("returns db_created as ok with the new dbId", async () => {
    const client = stubClient({
      ask: async () => ({
        kind: "create",
        db: "db_new",
        displayName: "Preferences",
        schemaName: "tenant_42",
        engine: "postgres",
        pkLive: null,
        plan: {},
        sampleRows: [],
      }),
    });

    const result = await handleQuery(client, { db: "preferences", q: "remember: vegetarian" });

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.db_created).toBe(true);
      expect(result.ok.dbId).toBe("db_new");
      expect(result.ok.displayName).toBe("Preferences");
      expect(result.ok.rows).toEqual([]);
    }
  });

  it("forwards AbortSignal to the SDK", async () => {
    const ask = vi.fn(async () => ({
      status: "ok" as const,
      rows: [],
      rowCount: 0,
      trace: { sql: "", plan_id: "", confidence: 0, model: "", cache_hit: false },
    }));
    const client = stubClient({ ask });
    const controller = new AbortController();

    await handleQuery(client, { db: "x", q: "y" }, { signal: controller.signal });

    expect(ask).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("maps a 401 to auth_required pointing at the dashboard mint flow", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("unauthorized", 401, "unauthorized", "/v1/ask", null);
      },
    });

    const result = await handleQuery(client, { db: "x", q: "y" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("auth_required");
      expect(result.err.action).toMatch(/app\.nlqdb\.com\/keys/);
    }
  });

  it("maps a 403 account_required to account_required (pk_live_ on an account route)", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("forbidden", 403, "account_required", "/v1/ask", null);
      },
    });

    const result = await handleQuery(client, { db: "x", q: "y" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("account_required");
      expect(result.err.action).toMatch(/sk_live_/);
    }
  });

  it("surfaces low_confidence with alternatives in details when present", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("low confidence", 422, "low_confidence", "/v1/ask", {
          status: "low_confidence",
          message: "two tables match 'users'",
          ...({ alternatives: ["users", "user_profiles"] } as Record<string, unknown>),
        });
      },
    });

    const result = await handleQuery(client, { db: "x", q: "users" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("low_confidence");
      expect(result.err.message).toContain("two tables match");
      expect(result.err.details).toEqual({ alternatives: ["users", "user_profiles"] });
      expect(result.err.action).toMatch(/alternatives/);
    }
  });
});

describe("handleListDatabases", () => {
  it("returns engine per row (SK-DB-010 + SK-MCP-002)", async () => {
    const client = stubClient({
      listDatabases: async () => ({
        databases: [
          {
            id: "db_1",
            slug: "orders",
            displayName: "Orders",
            engine: "postgres",
            pkLive: null,
            lastQueriedAt: null,
            createdAt: 1700000000,
          },
          {
            id: "db_2",
            slug: "metrics",
            displayName: "Metrics",
            engine: "clickhouse",
            pkLive: null,
            lastQueriedAt: 1700001000,
            createdAt: 1700000500,
          },
        ],
      }),
    });

    const result = await handleListDatabases(client);

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.databases).toHaveLength(2);
      expect(result.ok.databases[0]?.engine).toBe("postgres");
      expect(result.ok.databases[1]?.engine).toBe("clickhouse");
    }
  });

  it("surfaces 401 as auth_required pointing at the dashboard mint flow", async () => {
    const client = stubClient({
      listDatabases: async () => {
        throw new NlqdbApiError("unauthorized", 401, "unauthorized", "/v1/databases", null);
      },
    });

    const result = await handleListDatabases(client);

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("auth_required");
      expect(result.err.action).toMatch(/app\.nlqdb\.com\/keys/);
    }
  });

  it("forwards AbortSignal", async () => {
    const listDatabases = vi.fn(async () => ({ databases: [] }));
    const client = stubClient({ listDatabases });
    const controller = new AbortController();

    await handleListDatabases(client, { signal: controller.signal });

    expect(listDatabases).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe("handleDescribe", () => {
  it("finds a DB by slug", async () => {
    const client = stubClient({
      listDatabases: async () => ({
        databases: [
          {
            id: "db_1",
            slug: "orders",
            displayName: "Orders",
            schemaName: "tenant_42",
            engine: "postgres",
            pkLive: null,
            lastQueriedAt: null,
            createdAt: 1700000000,
          },
        ],
      }),
    });

    const result = await handleDescribe(client, { db: "orders" });

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.id).toBe("db_1");
      expect(result.ok.engine).toBe("postgres");
      expect(result.ok.schemaName).toBe("tenant_42");
    }
  });

  it("uses the listDatabasesCached fn when provided", async () => {
    const inlineList = vi.fn(async () => ({
      databases: [
        {
          id: "db_1",
          slug: "orders",
          displayName: "Orders",
          engine: "postgres",
          pkLive: null,
          lastQueriedAt: null,
          createdAt: 1,
        },
      ],
    }));
    const directListDatabases = vi.fn();
    const client = stubClient({ listDatabases: directListDatabases });

    await handleDescribe(client, { db: "orders" }, { listDatabasesCached: inlineList });

    expect(inlineList).toHaveBeenCalledTimes(1);
    expect(directListDatabases).not.toHaveBeenCalled();
  });

  it("returns db_not_found for an unknown slug", async () => {
    const client = stubClient({
      listDatabases: async () => ({ databases: [] }),
    });

    const result = await handleDescribe(client, { db: "missing" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("db_not_found");
      expect(result.err.action).toMatch(/nlqdb_list_databases/);
    }
  });
});

describe("createListDatabasesCache", () => {
  it("hits the SDK once within TTL", async () => {
    const listDatabases = vi.fn(async () => ({ databases: [] }));
    const client = stubClient({ listDatabases });
    const cache = createListDatabasesCache(client, 5000);

    await cache.get();
    await cache.get();
    await cache.get();

    expect(listDatabases).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after invalidate()", async () => {
    const listDatabases = vi.fn(async () => ({ databases: [] }));
    const client = stubClient({ listDatabases });
    const cache = createListDatabasesCache(client, 5000);

    await cache.get();
    cache.invalidate();
    await cache.get();

    expect(listDatabases).toHaveBeenCalledTimes(2);
  });
});

describe("mapSdkError", () => {
  it("returns a safe generic shape for unknown errors", () => {
    const err = mapSdkError(new Error("internal: hostname 'pg-pool-3.us-east-1.internal' refused"));
    expect(err.code).toBeTruthy();
    expect(err.message).toBe("An unexpected error occurred.");
    expect(err.action).toBeTruthy();
  });

  it("maps a 429 to rate_limited", () => {
    const apiErr = new NlqdbApiError("too many", 429, "rate_limited", "/v1/ask", null);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("rate_limited");
  });

  it("maps aborted to a recoverable typed error", () => {
    const apiErr = new NlqdbApiError("aborted", 0, "aborted", "/v1/ask", null);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("aborted");
  });

  it("forwards candidate_dbs on ambiguous_db", () => {
    const apiErr = new NlqdbApiError("ambiguous", 409, "ambiguous_db", "/v1/ask", {
      status: "ambiguous_db",
      candidate_dbs: [
        { id: "db_1", slug: "orders" },
        { id: "db_2", slug: "inventory" },
      ],
    });
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("ambiguous_db");
    expect(err.details).toEqual({
      candidate_dbs: [
        { id: "db_1", slug: "orders" },
        { id: "db_2", slug: "inventory" },
      ],
    });
    expect(err.action).toContain("orders");
  });
});

describe("formatResult / formatQueryResult / formatError", () => {
  it("wraps a success payload as compact JSON + structuredContent", () => {
    const formatted = formatResult({ ok: { databases: [] } });
    expect(formatted.isError).toBeUndefined();
    expect(formatted.content[0]?.type).toBe("text");
    expect(formatted.content[0]?.text).toBe('{"databases":[]}');
    expect(formatted.structuredContent).toEqual({ databases: [] });
  });

  it("caps rows at maxRows and adds rowsTruncated + totalRowCount", () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({ i }));
    const formatted = formatQueryResult(
      {
        ok: {
          rows,
          rowCount: 300,
          trace: { sql: "SELECT …", confidence: 1, cache_hit: false },
        },
      },
      200,
    );

    expect(formatted.structuredContent).toMatchObject({
      rowCount: 200,
      totalRowCount: 300,
      rowsTruncated: true,
    });
    const sc = formatted.structuredContent as { rows: unknown[] };
    expect(sc.rows).toHaveLength(200);
  });

  it("does not truncate when rows fit under the cap", () => {
    const formatted = formatQueryResult(
      {
        ok: {
          rows: [{ a: 1 }],
          rowCount: 1,
          trace: { sql: "SELECT …", confidence: 1, cache_hit: false },
        },
      },
      200,
    );
    const sc = formatted.structuredContent as { rowsTruncated?: boolean };
    expect(sc.rowsTruncated).toBeUndefined();
  });

  it("wraps an error as isError + message + arrow-prefixed action", () => {
    const formatted = formatError({
      code: "auth_required",
      message: "Need a key.",
      action: "Run nlq mcp install.",
    });
    expect(formatted.isError).toBe(true);
    expect(formatted.content[0]?.text).toBe("Need a key.\n\n→ Run nlq mcp install.");
  });
});
