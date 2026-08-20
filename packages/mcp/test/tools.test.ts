import { readFileSync } from "node:fs";
import { type NlqClient, NlqdbApiError } from "@nlqdb/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  connectDatabaseInputShape,
  createListDatabasesCache,
  formatError,
  formatQueryResult,
  formatResult,
  GENERIC_ERROR_MESSAGE,
  handleConnectDatabase,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  handleRemember,
  mapSdkError,
  PACKAGE_VERSION,
  queryInputShape,
  queryOutputShape,
} from "../src/index.ts";

type ConnectFn = NlqClient["databases"]["connect"];

function stubClient(overrides: Partial<NlqClient> & { connect?: ConnectFn } = {}): NlqClient {
  const base: NlqClient = {
    ask: async () => {
      throw new Error("ask not stubbed");
    },
    askStream: async () => {
      throw new Error("askStream not stubbed");
    },
    runSql: async () => {
      // The MCP server doesn't expose raw SQL (SK-MCP-002 — three tools,
      // none of which call `/v1/run`); the stub satisfies the NlqClient
      // interface but throws if a future path accidentally wires it.
      throw new Error("runSql not stubbed");
    },
    getModels: async () => ({ presets: [], free: { label: "Free", note: "" }, providers: [] }),
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
    databases: {
      connect: async () => {
        throw new Error("databases.connect not stubbed");
      },
    },
    getKeyStatus: async () => ({ revoked: false }),
    redeemOAuthBridgeCode: async () => {
      throw new Error("redeemOAuthBridgeCode not stubbed");
    },
    listKeys: async () => ({ keys: [] }),
    revokeKey: async () => {
      throw new Error("revokeKey not stubbed");
    },
    mintKey: async () => {
      // MCP never mints keys through the SDK — sk_mcp_* keys come from
      // the OAuth-callback path (SK-APIKEYS-009 / SK-MCP-013). The stub
      // exists only to satisfy the NlqClient interface.
      throw new Error("mintKey not stubbed");
    },
    setByollm: async () => {
      // BYOLLM account-store verbs (SK-SDK-011) aren't an MCP tool yet
      // (tracked GLOBAL-003 gap); the stubs only satisfy the interface.
      throw new Error("setByollm not stubbed");
    },
    getByollmStatus: async () => {
      throw new Error("getByollmStatus not stubbed");
    },
    clearByollm: async () => {
      throw new Error("clearByollm not stubbed");
    },
    registerPremiumInterest: async () => {
      throw new Error("registerPremiumInterest not stubbed");
    },
    remember: async () => {
      throw new Error("remember not stubbed");
    },
    mintGrant: async () => {
      // Grant control-plane verbs (SK-EKP-008) are session-only and not an
      // MCP tool by design; the stubs only satisfy the NlqClient interface.
      throw new Error("mintGrant not stubbed");
    },
    listGrants: async () => {
      throw new Error("listGrants not stubbed");
    },
    revokeGrant: async () => {
      throw new Error("revokeGrant not stubbed");
    },
  };
  const { connect, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    ...(connect ? { databases: { connect } } : {}),
  };
}

function makeDbSummary(overrides: {
  id: string;
  engine: "postgres" | "clickhouse";
  slug?: string;
  displayName?: string;
}) {
  const slug = overrides.slug ?? overrides.id.replace(/^db_/, "").replace(/_/g, "-");
  return {
    id: overrides.id,
    slug,
    displayName: overrides.displayName ?? slug,
    engine: overrides.engine,
    pkLive: null,
    lastQueriedAt: null,
    createdAt: 0,
  };
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
        trace: {
          sql: "SELECT COUNT(*) FROM users",
          model: "stub",
          confidence: 0.92,
          cache_hit: false,
        },
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

  it("passes the model preset through to the SDK request (SK-PREMIUM-014)", async () => {
    const ask = vi.fn(async () => ({
      status: "ok" as const,
      rows: [],
      rowCount: 0,
      trace: { sql: "", plan_id: "", confidence: 0, model: "", cache_hit: false },
    }));
    const client = stubClient({ ask });

    await handleQuery(client, { db: "users", q: "count users", model: "fast" });

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ goal: "count users", dbId: "users", model: "fast" }),
      expect.any(Object),
    );
  });

  it("omits dbId when db is not provided (SK-ASK-009 goal-first auto-target)", async () => {
    const ask = vi.fn(async () => ({
      status: "ok" as const,
      rows: [],
      rowCount: 0,
      trace: { sql: "", plan_id: "", confidence: 0, model: "", cache_hit: false },
    }));
    const client = stubClient({ ask });

    await handleQuery(client, { q: "count users" });

    // Exact match (not objectContaining) so an accidental `dbId: undefined`
    // would fail — the request must carry only `goal`.
    expect(ask).toHaveBeenCalledWith({ goal: "count users" }, {});
  });

  it("surfaces ambiguous_db with candidate_dbs when db is omitted on a multi-DB key", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("ambiguous", 409, "ambiguous_db", "/v1/ask", {
          code: "ambiguous_db",
          message: "More than one of your databases could answer that.",
          action: "Say which one you mean (orders, inventory).",
          params: {
            candidate_dbs: [
              { id: "db_1", slug: "orders" },
              { id: "db_2", slug: "inventory" },
            ],
          },
        });
      },
    });

    const result = await handleQuery(client, { q: "revenue this year" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("ambiguous_db");
      // The host-facing action names the tool, and the ids ride `details`.
      expect(result.err.action).toContain("`db`");
      expect(result.err.details).toEqual({
        candidate_dbs: [
          { id: "db_1", slug: "orders" },
          { id: "db_2", slug: "inventory" },
        ],
      });
    }
  });

  it("SK-ASK-026: surfaces a destructive_ambiguous clarify with re-sendable options", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("clarify", 409, "clarify_required", "/v1/ask", {
          code: "clarify_required",
          message: "Clearing the whole database could mean a few things.",
          action: "Pick one of the offered interpretations, or ask again more specifically.",
          params: {
            clarification: "destructive_ambiguous",
            options: [
              { label: 'Empty the "facts" table', goal: "delete every row from the facts table" },
              {
                label: "Start fresh with a new, empty database",
                goal: "create a new empty database",
                forceNoPin: true,
              },
            ],
          },
        });
      },
    });

    const result = await handleQuery(client, { q: "clear db" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("clarify_required");
      expect(result.err.message).toContain("could mean a few things");
      expect(result.err.action).toContain("details.options");
      expect(result.err.details?.["options"]).toHaveLength(2);
      expect(result.err.details?.["options"]).toHaveLength(2);
    }
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
        trace: {
          sql: 'CREATE TABLE "tenant_42"."preferences" (id bigint PRIMARY KEY);',
          plan_id: "create:db_new",
          confidence: 1,
          model: "fake-model",
          cache_hit: false,
        },
      }),
    });

    const result = await handleQuery(client, { db: "preferences", q: "remember: vegetarian" });

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.db_created).toBe(true);
      expect(result.ok.dbId).toBe("db_new");
      expect(result.ok.displayName).toBe("Preferences");
      expect(result.ok.rows).toEqual([]);
      // SK-TRUST-002 — the create trace (compiled DDL) passes through
      // instead of the pre-2026-07-12 fabricated empty trace.
      expect(result.ok.trace.sql).toContain("CREATE TABLE");
      expect(result.ok.trace.model).toBe("fake-model");
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

  it("maps a 401 to unauthorized pointing at the dashboard mint flow", async () => {
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("unauthorized", 401, "unauthorized", "/v1/ask", null);
      },
    });

    const result = await handleQuery(client, { db: "x", q: "y" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("unauthorized");
      expect(result.err.action).toMatch(/app\.nlqdb\.com\/app\/keys/);
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
      // SK-APIKEYS-015: the fix a host is told to apply is the MCP key.
      expect(result.err.action).toMatch(/sk_mcp_/);
    }
  });

  // GLOBAL-040 — a below-floor plan is a `clarify_required` guided turn, not a
  // standalone `low_confidence` code; its options lift to `details.options`.
  it("surfaces a low_confidence clarify with its options in details", async () => {
    const options = [{ label: "The users table", goal: "count rows in users" }];
    const client = stubClient({
      ask: async () => {
        throw new NlqdbApiError("low confidence", 409, "clarify_required", "/v1/ask", {
          code: "clarify_required",
          message: "A couple of readings fit — which did you mean?",
          action: "Re-call `q` with one of the goals in `details.options`.",
          params: { clarification: "low_confidence", options },
        });
      },
    });

    const result = await handleQuery(client, { db: "x", q: "users" });

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("clarify_required");
      expect(result.err.message).toContain("which did you mean");
      expect(result.err.details).toEqual({ options });
      expect(result.err.action).toMatch(/details\.options/);
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

  it("surfaces 401 as unauthorized pointing at the dashboard mint flow", async () => {
    const client = stubClient({
      listDatabases: async () => {
        throw new NlqdbApiError("unauthorized", 401, "unauthorized", "/v1/databases", null);
      },
    });

    const result = await handleListDatabases(client);

    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("unauthorized");
      expect(result.err.action).toMatch(/app\.nlqdb\.com\/app\/keys/);
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

describe("handleRemember", () => {
  it("forwards the typed payload and returns the materialised row", async () => {
    const client = stubClient({
      remember: async (req) => {
        expect(req.db).toBe("db_agent_memory_v1_abc123");
        expect(req.kind).toBe("fact");
        return {
          status: "ok",
          id: "42",
          kind: "fact",
          materialised_at: "2026-06-20T00:00:00Z",
        };
      },
    });
    const result = await handleRemember(client, {
      db: "db_agent_memory_v1_abc123",
      kind: "fact",
      payload: { content: "prefers dark mode" },
    });
    expect(result).toEqual({
      ok: { id: "42", kind: "fact", materialised_at: "2026-06-20T00:00:00Z" },
    });
  });

  it("maps wrong_preset to an actionable tool error when the input db was not a memory DB", async () => {
    // Non-memory-shaped db id → self-provision path is not tried; the
    // server's wrong_preset surfaces to the caller with the recovery
    // that actually works from MCP (omit `db`, we auto-adopt).
    const client = stubClient({
      remember: async () => {
        throw new NlqdbApiError("wrong preset", 409, "wrong_preset", "/v1/memory/remember", null);
      },
      listDatabases: async () => ({ databases: [] }),
      createDatabase: async () => {
        throw new NlqdbApiError("wrong preset", 409, "wrong_preset", "/v1/memory/remember", null);
      },
    });
    const result = await handleRemember(client, {
      db: "db_orders_x",
      kind: "fact",
      payload: { content: "x" },
    });
    expect("err" in result && result.err.code).toBe("wrong_preset");
    expect("err" in result && result.err.action).toMatch(/without `db`|nlqdb_remember/);
  });

  // Founder dogfood 2026-08-18: a cold agent called nlqdb_remember on
  // an account that had non-memory DBs and no memory DB. The tool must
  // find or create the memory DB itself and complete the write in the
  // same call, echoing dbId (+ db_created on a fresh provision) so the
  // agent can pin it next time — the wrong_preset dead-end goes away.
  it("adopts an existing agent_memory_v1 DB when the caller omits `db`", async () => {
    let rememberedAgainst: string | undefined;
    const client = stubClient({
      listDatabases: async () => ({
        databases: [
          makeDbSummary({ id: "db_orders_x", engine: "postgres" }),
          makeDbSummary({ id: "db_agent_memory_v1_abc123", engine: "postgres" }),
        ],
      }),
      remember: async (req) => {
        rememberedAgainst = req.db;
        return {
          status: "ok",
          id: "77",
          kind: "fact",
          materialised_at: "2026-08-18T00:00:00Z",
        };
      },
      createDatabase: async () => {
        throw new Error("must not create when a memory DB already exists");
      },
    });
    const result = await handleRemember(client, {
      kind: "fact",
      payload: { content: "prefers dark mode" },
    });
    expect(rememberedAgainst).toBe("db_agent_memory_v1_abc123");
    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.dbId).toBe("db_agent_memory_v1_abc123");
      expect(result.ok.db_created).toBeUndefined();
    }
  });

  it("provisions an agent_memory_v1 DB when the account has none, then completes the write", async () => {
    let createdCount = 0;
    let rememberedAgainst: string | undefined;
    const client = stubClient({
      listDatabases: async () => ({
        databases: [makeDbSummary({ id: "db_orders_x", engine: "postgres" })],
      }),
      createDatabase: async (req) => {
        createdCount++;
        expect(req.preset).toBe("agent_memory_v1");
        return {
          dbId: "db_agent_memory_v1_new999",
          slug: "agent-memory-new999",
          engine: "postgres",
          pkLive: "pk_live_xxx",
        };
      },
      remember: async (req) => {
        rememberedAgainst = req.db;
        return {
          status: "ok",
          id: "1",
          kind: "fact",
          materialised_at: "2026-08-18T00:00:01Z",
        };
      },
    });
    const result = await handleRemember(client, {
      kind: "fact",
      payload: { content: "my agent's first memory" },
    });
    expect(createdCount).toBe(1);
    expect(rememberedAgainst).toBe("db_agent_memory_v1_new999");
    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.dbId).toBe("db_agent_memory_v1_new999");
      expect(result.ok.db_created).toBe(true);
    }
  });

  it("recovers a wrong_preset on a caller-supplied non-memory `db` by self-provisioning", async () => {
    // Reproduces the exact founder dead-end: caller passes an existing
    // non-memory DB id, server returns wrong_preset. Instead of
    // surfacing that as an error, the tool should adopt (or create) the
    // memory DB and complete the write.
    let rememberCalls = 0;
    let lastRememberedAgainst: string | undefined;
    const client = stubClient({
      listDatabases: async () => ({
        databases: [
          makeDbSummary({ id: "db_agentic_memory_d3ddf8", engine: "postgres" }),
          makeDbSummary({ id: "db_agent_memory_v1_existing", engine: "postgres" }),
        ],
      }),
      remember: async (req) => {
        rememberCalls++;
        lastRememberedAgainst = req.db;
        if (req.db === "db_agentic_memory_d3ddf8") {
          throw new NlqdbApiError("wrong preset", 409, "wrong_preset", "/v1/memory/remember", null);
        }
        return {
          status: "ok",
          id: "9",
          kind: "fact",
          materialised_at: "2026-08-18T00:00:02Z",
        };
      },
    });
    const result = await handleRemember(client, {
      // Founder's real DB id from the 2026-08-18 dogfood — server returns
      // wrong_preset on the write, which the tool recovers by adopting
      // the existing memory DB and re-issuing.
      db: "db_agentic_memory_d3ddf8",
      kind: "fact",
      payload: { content: "founder-remembered fact" },
    });
    expect(rememberCalls).toBe(2);
    expect(lastRememberedAgainst).toBe("db_agent_memory_v1_existing");
    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.dbId).toBe("db_agent_memory_v1_existing");
    }
  });

  it("recovers when a caller-pinned memory-shaped `db` is wrong_preset (server disagrees)", async () => {
    // A memory-shaped id that the server rejects — hits the fast path,
    // fails with wrong_preset, then falls through to resolve.
    let rememberCalls = 0;
    const client = stubClient({
      listDatabases: async () => ({
        databases: [makeDbSummary({ id: "db_agent_memory_v1_real", engine: "postgres" })],
      }),
      remember: async (req) => {
        rememberCalls++;
        if (req.db === "db_agent_memory_v1_stale") {
          throw new NlqdbApiError("wrong preset", 409, "wrong_preset", "/v1/memory/remember", null);
        }
        return {
          status: "ok",
          id: "3",
          kind: "fact",
          materialised_at: "2026-08-18T00:00:03Z",
        };
      },
    });
    const result = await handleRemember(client, {
      db: "db_agent_memory_v1_stale",
      kind: "fact",
      payload: { content: "fact" },
    });
    expect(rememberCalls).toBe(2);
    expect("ok" in result).toBe(true);
    if ("ok" in result) expect(result.ok.dbId).toBe("db_agent_memory_v1_real");
  });

  it("maps a read-only forbidden to the user-scoped-key hint", async () => {
    const client = stubClient({
      remember: async () => {
        throw new NlqdbApiError("forbidden", 403, "forbidden", "/v1/memory/remember", null);
      },
    });
    const result = await handleRemember(client, {
      db: "db_agent_memory_v1_abc123",
      kind: "fact",
      payload: { content: "x" },
    });
    expect("err" in result && result.err.code).toBe("forbidden");
  });

  // The reported regression: remembering into a db that doesn't resolve
  // (e.g. no memory DB provisioned yet) returned db_not_found (404), which
  // had no branch in mapSdkError and surfaced as the opaque generic bucket.
  // With self-provision, this now falls through to resolve — but when
  // list+create both fail with db_not_found, the mapped error still tells
  // the agent how to self-serve (never the generic bucket).
  it("maps db_not_found to a create/list hint, not the generic bucket", async () => {
    const client = stubClient({
      listDatabases: async () => ({ databases: [] }),
      createDatabase: async () => {
        throw new NlqdbApiError("nope", 404, "db_not_found", "/v1/databases", {
          code: "db_not_found",
        });
      },
      remember: async () => {
        throw new NlqdbApiError("nope", 404, "db_not_found", "/v1/memory/remember", {
          code: "db_not_found",
        });
      },
    });
    const result = await handleRemember(client, {
      db: "db_not_a_memory_db",
      kind: "fact",
      payload: { content: "user prefers dark mode" },
    });
    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("db_not_found");
      expect(result.err.message).not.toBe("An unexpected error occurred.");
      expect(result.err.action).toMatch(/agent_memory_v1|nlqdb_list_databases|nlqdb_remember/);
    }
  });

  // A mis-shaped payload comes back as invalid_body with a one-sentence
  // `reason` naming the field; surface it verbatim (GLOBAL-012) rather than
  // dropping it into the generic bucket.
  it("surfaces the server's invalid_body reason verbatim", async () => {
    const client = stubClient({
      remember: async () => {
        throw new NlqdbApiError("bad body", 400, "invalid_body", "/v1/memory/remember", {
          code: "invalid_body",
          params: { reason: "fact `payload.content` is required." },
        });
      },
    });
    const result = await handleRemember(client, {
      db: "db_agent_memory_v1_abc123",
      kind: "fact",
      payload: {},
    });
    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(result.err.code).toBe("invalid_body");
      expect(result.err.message).toBe("fact `payload.content` is required.");
    }
  });
});

describe("handleConnectDatabase", () => {
  it("connects and returns dbId + schema preview without echoing the secret", async () => {
    const client = stubClient({
      connect: async (req) => {
        expect(req.engine).toBe("postgres");
        expect(req.connectionUrl).toBe("postgres://u:secret@host:5432/db");
        expect(req.name).toBe("Prod orders");
        return {
          dbId: "db_conn_abc",
          name: "Prod orders",
          engine: "postgres",
          schemaPreview: "table orders(id, total)\ntable customers(id, name)",
          pkLive: "pk_live_should_not_leak",
        };
      },
    });

    const result = await handleConnectDatabase(client, {
      engine: "postgres",
      connection_url: "postgres://u:secret@host:5432/db",
      name: "Prod orders",
    });

    expect(result).toEqual({
      ok: {
        dbId: "db_conn_abc",
        name: "Prod orders",
        engine: "postgres",
        schemaPreview: "table orders(id, total)\ntable customers(id, name)",
        credential: "stored_sealed",
      },
    });

    // SECURITY — neither the URL/password nor the pkLive may appear anywhere
    // in the serialised result the host LLM sees.
    const formatted = formatResult(result);
    const blob = JSON.stringify(formatted);
    expect(blob).not.toContain("secret");
    expect(blob).not.toContain("postgres://");
    expect(blob).not.toContain("pk_live_should_not_leak");
  });

  it("passes the server's connect-failure message through verbatim", async () => {
    const client = stubClient({
      connect: async () => {
        throw new NlqdbApiError(
          "connect failed",
          502,
          "introspection_failed",
          "/v1/db/connect",
          // The server message must not contain the URL; it doesn't here.
          {
            code: "introspection_failed",
            message: "Could not reach the database host within 5s.",
          },
        );
      },
    });

    const result = await handleConnectDatabase(client, {
      engine: "clickhouse",
      connection_url: "https://u:secret@ch.example:8443",
    });

    expect("err" in result && result.err.code).toBe("introspection_failed");
    expect("err" in result && result.err.message).toBe(
      "Could not reach the database host within 5s.",
    );
    // Redaction holds on the error path too.
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("maps connect_requires_account to a sign-in hint", async () => {
    const client = stubClient({
      connect: async () => {
        throw new NlqdbApiError(
          "account required",
          403,
          "connect_requires_account",
          "/v1/db/connect",
          null,
        );
      },
    });
    const result = await handleConnectDatabase(client, {
      engine: "postgres",
      connection_url: "postgres://u:secret@host/db",
    });
    expect("err" in result && result.err.code).toBe("connect_requires_account");
    expect("err" in result && result.err.action).toMatch(/sk_live_|signed in/i);
    // An sk_mcp_ key can never connect (SK-APIKEYS-015), so naming it here
    // would send a headless host round the same 403 forever.
    expect("err" in result && result.err.action).not.toMatch(/sk_mcp_/);
    expect(JSON.stringify(result)).not.toContain("secret");
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
    expect(err.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(err.action).toBeTruthy();
  });

  it("maps a 429 to rate_limited with the documented window when no resetAt is present", () => {
    const apiErr = new NlqdbApiError("too many", 429, "rate_limited", "/v1/ask", null);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("rate_limited");
    // No invented number — falls back to the documented 60s fixed window (SK-RL-002).
    expect(err.action).toMatch(/60s/);
  });

  it("surfaces the real wait from resetAt on a 429 (SK-RL-004)", () => {
    const resetAt = Math.floor(Date.now() / 1000) + 42;
    const apiErr = new NlqdbApiError("too many", 429, "rate_limited", "/v1/ask", {
      code: "rate_limited",
      params: { limit: 60, count: 61, resetAt },
    });
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("rate_limited");
    // Within a second of 42 either way to absorb the clock read inside mapSdkError.
    expect(err.action).toMatch(/Wait 4[12]s before retrying/);
  });

  it("maps aborted to a recoverable typed error", () => {
    const apiErr = new NlqdbApiError("aborted", 0, "aborted", "/v1/ask", null);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("aborted");
  });

  it("maps model_unavailable to the two real doors, not generic retry advice (SK-PREMIUM-014)", () => {
    const apiErr = new NlqdbApiError("no frontier lane", 409, "model_unavailable", "/v1/ask", null);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("model_unavailable");
    expect(err.message).toMatch(/frontier model/);
    expect(err.action).toMatch(/app\.nlqdb\.com\/app\/keys/);
  });

  it("forwards candidate_dbs on ambiguous_db", () => {
    const apiErr = new NlqdbApiError("ambiguous", 409, "ambiguous_db", "/v1/ask", {
      code: "ambiguous_db",
      params: {
        candidate_dbs: [
          { id: "db_1", slug: "orders" },
          { id: "db_2", slug: "inventory" },
        ],
      },
    });
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("ambiguous_db");
    expect(err.details).toEqual({
      candidate_dbs: [
        { id: "db_1", slug: "orders" },
        { id: "db_2", slug: "inventory" },
      ],
    });
    expect(err.action).toContain("`db`");
    expect(err.details?.["candidate_dbs"]).toHaveLength(2);
  });

  // SK-ERR-001 — a streamed `/v1/ask` error frame arrives FLAT (fields at the
  // top level, no `params` wrapper) while a JSON error nests them under
  // `params`. `mapSdkError` must render copy + details from either shape; the
  // params-only fixtures above once masked a regression where the streamed
  // (flat) body rendered generic copy with no candidate list.
  it("reads cause fields from a flat (streamed) body, not only params", () => {
    const apiErr = new NlqdbApiError("ambiguous", 409, "ambiguous_db", "/v1/ask", {
      code: "ambiguous_db",
      candidate_dbs: [
        { id: "db_1", slug: "orders" },
        { id: "db_2", slug: "inventory" },
      ],
    } as unknown as NlqdbApiError["body"]);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("ambiguous_db");
    expect(err.details?.["candidate_dbs"]).toHaveLength(2);
  });

  it("renders write_constraint field names from a flat body", () => {
    const apiErr = new NlqdbApiError("constraint", 409, "write_constraint", "/v1/ask", {
      code: "write_constraint",
      kind: "foreign_key",
      table: "orders",
      column: "user_id",
    } as unknown as NlqdbApiError["body"]);
    const err = mapSdkError(apiErr);
    expect(err.code).toBe("write_constraint");
    // The field name must reach the message, not degrade to the generic branch.
    expect(err.message).toContain("orders.user_id");
  });

  // These statuses previously had no branch and all collapsed to the
  // generic bucket. Each must now carry a specific message + a next action
  // and preserve its machine-readable code (GLOBAL-012).
  it.each([
    ["db_not_found", 404],
    ["db_unreachable", 502],
    ["db_misconfigured", 502],
    ["schema_unavailable", 422],
    ["sql_rejected", 400],
    ["llm_failed", 502],
    ["clarify_required", 409],
  ] as const)("maps %s to an actionable, non-generic error", (code, status) => {
    const err = mapSdkError(new NlqdbApiError(code, status, code, "/v1/ask", { code }));
    expect(err.code).toBe(code);
    expect(err.message).not.toBe("An unexpected error occurred.");
    expect(err.message.length).toBeGreaterThan(0);
    expect(err.action.length).toBeGreaterThan(0);
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
          trace: { sql: "SELECT …", model: "stub", confidence: 1, cache_hit: false },
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
          trace: { sql: "SELECT …", model: "stub", confidence: 1, cache_hit: false },
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

// WS04-T1 — the four contract facts must live in the tool/param descriptions
// (the agent's only manual at call time), not be learned by trial.
describe("tool descriptions carry the contract (WS04-T1)", () => {
  it("q gives an example and steers away from pronouns", () => {
    expect(queryInputShape.q.description).toMatch(/example/i);
    expect(queryInputShape.q.description).toMatch(/pronoun/i);
  });

  it("db is optional and documents the pk_live_ + ambiguous_db behaviour", () => {
    expect(queryInputShape.db.isOptional()).toBe(true);
    expect(queryInputShape.db.description).toMatch(/pk_live_/);
    expect(queryInputShape.db.description).toMatch(/ambiguous_db/);
  });

  it("confirm describes the two-call destructive state machine", () => {
    expect(queryInputShape.confirm.description).toMatch(/requires_confirm/);
    expect(queryInputShape.confirm.description).toMatch(/confirm: true/);
  });

  it("rows documents the 200-row cap and the recovery", () => {
    expect(queryOutputShape.rows.description).toMatch(/200/);
    expect(queryOutputShape.rows.description).toMatch(/rowsTruncated/);
  });

  it("connect_database describes the engines and the sealed-credential handling", () => {
    expect(connectDatabaseInputShape.engine.description).toMatch(/clickhouse/i);
    expect(connectDatabaseInputShape.engine.description).toMatch(/postgres/i);
    expect(connectDatabaseInputShape.connection_url.description).toMatch(/sealed|never echoed/i);
  });
});

// WS04-T2 — name which key is for which purpose. `sk_mcp_` ⊂ `sk_live_`
// (SK-APIKEYS-015): it reaches every tool here except `nlqdb_connect_database`,
// so it is named first — but neither is read-only, so don't imply that split.
describe("unauthorized names each key by purpose (WS04-T2)", () => {
  it("mentions sk_mcp_ and sk_live_ with their purpose", () => {
    const err = mapSdkError(
      new NlqdbApiError("unauthorized", 401, "unauthorized", "/v1/ask", null),
    );
    expect(err.message).toMatch(/sk_mcp_/);
    expect(err.message).toMatch(/sk_live_/);
    expect(err.message).toMatch(/MCP host/i);
  });
});

// Agent-memory convention (SK-PIVOT-011 lazy variant) — the tool
// descriptions are the ONLY place a cold agent learns how to use memory
// well. A cold agent that never reads FEATURE.md must still learn: use
// entities for current state, give transient facts a TTL, supersede
// rather than accumulate. Test the description text carries each move.
describe("nlqdb_remember description teaches the memory conventions", () => {
  // Late import so the test survives a re-order of the module.
  async function shape() {
    const mod = await import("../src/tools.ts");
    return mod.rememberInputShape;
  }

  it("teaches entity = current snapshot, refreshed in place", async () => {
    const s = await shape();
    expect(s.kind.description).toMatch(/current snapshot|current state/i);
    expect(s.kind.description).toMatch(/upsert/i);
    expect(s.payload.description).toMatch(/current snapshot|refreshed in place|update.*in place/i);
  });

  it("teaches ttlSeconds as the way transient facts decay", async () => {
    const s = await shape();
    expect(s.ttlSeconds.description).toMatch(/expired.*not.*appear|stop appearing|fades|forgets/i);
    expect(s.ttlSeconds.description).toMatch(/time-bound|transient|status|observation/i);
  });

  it("teaches supersede rather than accumulate", async () => {
    const s = await shape();
    expect(s.payload.description).toMatch(/supersede|update.*in place|refreshed in place/i);
  });
});

// WS04-T4 — the advertised stdio version must track package.json so a host
// never sees a version that drifted from what it actually installed.
describe("PACKAGE_VERSION stays in sync with package.json (WS04-T4)", () => {
  it("equals package.json#version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(PACKAGE_VERSION).toBe(pkg.version);
  });
});
