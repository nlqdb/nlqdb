import { type NlqClient, NlqdbApiError } from "@nlqdb/sdk";
import { describe, expect, it } from "vitest";
import {
  formatResult,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  mapSdkError,
} from "../src/index.ts";

// Minimal stub client — every method either resolves with the given
// value or rejects with the given error. Per-test wiring lets each
// case express exactly what the API would say.
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

  it("maps a 401 to auth_required with the slice-1 action", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("unauthorized", 401, "unauthorized", "/v1/ask", null);
      },
    });

    const result = await handleQuery(client, { db: "x", q: "y" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("auth_required");
      expect(result.err.action).toMatch(/sk_mcp_/);
    }
  });

  it("surfaces low_confidence with a clarification action", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("low confidence", 422, "low_confidence", "/v1/ask", {
          status: "low_confidence",
          message: "two tables match 'users'",
        });
      },
    });

    const result = await handleQuery(client, { db: "x", q: "users" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("low_confidence");
      expect(result.err.message).toContain("two tables match");
      expect(result.err.action).toMatch(/Rephrase/);
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

  it("surfaces 401 as auth_required (SK-MCP-010 slice-1 gap)", async () => {
    const client = stubClient({
      listDatabases: async () => {
        throw new NlqdbApiError("unauthorized", 401, "unauthorized", "/v1/databases", null);
      },
    });

    const result = await handleListDatabases(client);

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("auth_required");
    }
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

describe("mapSdkError", () => {
  it("collapses unknown errors to a generic recoverable shape", () => {
    const err = mapSdkError(new Error("boom"));
    expect(err.code).toBeTruthy();
    expect(err.action).toBeTruthy();
  });

  it("maps a 429 to rate_limited", () => {
    const apiErr = new NlqdbApiError("too many", 429, "rate_limited", "/v1/ask", null);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("rate_limited");
  });
});

describe("formatResult", () => {
  it("wraps a success payload as JSON text + structuredContent", () => {
    const formatted = formatResult({ ok: { rows: [], rowCount: 0 } });
    expect(formatted.isError).toBeUndefined();
    expect(formatted.content[0]?.type).toBe("text");
    expect(formatted.structuredContent).toEqual({ rows: [], rowCount: 0 });
  });

  it("wraps an error as isError + one-sentence + action", () => {
    const formatted = formatResult({
      err: { code: "auth_required", message: "Need a key.", action: "Run nlq mcp install." },
    });
    expect(formatted.isError).toBe(true);
    expect(formatted.content[0]?.text).toBe("Need a key. Run nlq mcp install.");
  });
});
