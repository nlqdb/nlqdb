import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../../../packages/mcp/src/server.ts";
import type { NlqClient } from "../../../packages/sdk/src/index.ts";
import { NlqdbApiError } from "../../../packages/sdk/src/index.ts";

function stubClient(overrides: Partial<NlqClient>): NlqClient {
  const notStubbed = (name: string) => () => {
    throw new Error(`stubClient: ${name} not stubbed`);
  };
  return {
    ask: notStubbed("ask"),
    askStream: notStubbed("askStream"),
    runSql: notStubbed("runSql"),
    listChat: async () => ({ messages: [] }),
    postChat: notStubbed("postChat"),
    listDatabases: async () => ({ databases: [] }),
    createDatabase: notStubbed("createDatabase"),
    deleteDatabase: notStubbed("deleteDatabase"),
    databases: { connect: notStubbed("databases.connect") },
    getKeyStatus: async () => ({ revoked: false }),
    listKeys: async () => ({ keys: [] }),
    mintKey: notStubbed("mintKey"),
    revokeKey: notStubbed("revokeKey"),
    redeemOAuthBridgeCode: notStubbed("redeemOAuthBridgeCode"),
    remember: notStubbed("remember"),
    setByollm: notStubbed("setByollm"),
    getByollmStatus: notStubbed("getByollmStatus"),
    clearByollm: notStubbed("clearByollm"),
    ...overrides,
  };
}

async function connect(client: NlqClient) {
  const server = createServer({ client });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcpClient = new Client({ name: "e2e-test", version: "0.0.0" });
  await mcpClient.connect(clientTransport);
  return {
    mcpClient,
    teardown: async () => {
      await mcpClient.close();
      await server.close();
    },
  };
}

describe("P2 — Agent Builder · MCP protocol contract", () => {
  it("exposes the SK-MCP-002 tools in order (+ additive nlqdb_remember, nlqdb_connect_database)", async () => {
    const { mcpClient, teardown } = await connect(stubClient({}));
    try {
      const { tools } = await mcpClient.listTools();
      const names = tools.map((t) => t.name);
      // Tool order is part of the contract — some agent clients discover by index.
      // New tools are appended (`nlqdb_remember` per SK-PIVOT-008,
      // `nlqdb_connect_database` per SK-DBCONN-001), never reordering the stable three.
      expect(names).toEqual([
        "nlqdb_query",
        "nlqdb_list_databases",
        "nlqdb_describe",
        "nlqdb_remember",
        "nlqdb_connect_database",
      ]);
      for (const t of tools) {
        expect(t.description).toBeTruthy();
        expect(t.description?.length ?? 0).toBeGreaterThan(20);
      }
    } finally {
      await teardown();
    }
  });

  it("nlqdb_query returns rows + trace block", async () => {
    const { mcpClient, teardown } = await connect(
      stubClient({
        ask: async () => ({
          status: "ok" as const,
          rows: [{ source: "google", n: 142 }],
          rowCount: 1,
          summary: "1 source.",
          trace: {
            sql: "SELECT source, COUNT(*) AS n FROM orders GROUP BY source",
            plan_id: "plan_p2_orders_v1",
            confidence: 0.94,
            model: "openai/gpt-oss-120b",
            cache_hit: false,
          },
        }),
      }),
    );
    try {
      const result = await mcpClient.callTool({
        name: "nlqdb_query",
        arguments: { db: "db_e2e_p2", q: "orders this week, by source" },
      });
      expect(result.isError).toBeFalsy();
      // Shape mirrors `queryOutputShape` in packages/mcp/src/tools.ts; `trace` must stay nested.
      const sc = result.structuredContent as {
        rows: unknown[];
        rowCount: number;
        trace: { sql: string; confidence: number; cache_hit: boolean };
      };
      expect(sc.rows).toHaveLength(1);
      expect(sc.rowCount).toBe(1);
      expect(sc.trace.sql).toMatch(/SELECT/i);
      expect(sc.trace.confidence).toBeGreaterThan(0.8);
    } finally {
      await teardown();
    }
  });

  it("nlqdb_list_databases enumerates the tenant", async () => {
    const { mcpClient, teardown } = await connect(
      stubClient({
        listDatabases: async () => ({
          databases: [
            {
              id: "db_e2e_p2",
              slug: "session-abc",
              displayName: "Session ABC",
              engine: "postgres",
              pkLive: null,
              lastQueriedAt: null,
              createdAt: 1700000000,
            },
          ],
        }),
      }),
    );
    try {
      const result = await mcpClient.callTool({
        name: "nlqdb_list_databases",
        arguments: {},
      });
      expect(result.isError).toBeFalsy();
      const sc = result.structuredContent as {
        databases: { slug: string; engine: string }[];
      };
      expect(sc.databases).toHaveLength(1);
      const [first] = sc.databases;
      if (!first) throw new Error("unreachable: structuredContent.databases.length is 1");
      expect(first.slug).toBe("session-abc");
      expect(first.engine).toBe("postgres");
    } finally {
      await teardown();
    }
  });

  it("API errors surface as isError + one-sentence content (GLOBAL-012)", async () => {
    // `unauthorized` has an explicit `mapSdkError` mapping so the assertion sees the real GLOBAL-012 shape.
    const { mcpClient, teardown } = await connect(
      stubClient({
        ask: async () => {
          throw new NlqdbApiError(
            "nlqdb: /v1/ask → 401 unauthorized",
            401,
            "unauthorized",
            "/v1/ask",
            { status: "unauthorized", message: "token missing or revoked" },
          );
        },
      }),
    );
    try {
      const result = await mcpClient.callTool({
        name: "nlqdb_query",
        arguments: { db: "db_e2e_p2", q: "anything" },
      });
      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      const text = content.find((c) => c.type === "text")?.text ?? "";
      expect(text).toMatch(/user-scoped key/i);
      expect(text).toMatch(/→/);
      expect(text).toMatch(/app\.nlqdb\.com/);
    } finally {
      await teardown();
    }
  });
});
