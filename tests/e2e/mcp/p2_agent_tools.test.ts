// P2 — Agent Builder. The MCP server's three tools must:
//
//   • be discoverable in the canonical order (SK-MCP-002)
//   • return structured content alongside the text content
//   • carry the SQL `trace` block on every successful `nlqdb_query`
//     (GLOBAL-023 / SK-TRUST-002)
//   • surface API errors as `isError: true` with one-sentence
//     content + a `code` / `action` discriminant (GLOBAL-012)
//
// Hermetic — uses the SDK's `InMemoryTransport` to pair a Client and
// the nlqdb McpServer in-process. The server's NlqClient is stubbed
// per call rather than via cassette files; the surface is small
// enough that inline stubs are clearer than another JSON layer.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../../../packages/mcp/src/server.ts";
import type { NlqClient } from "../../../packages/sdk/src/index.ts";
import { NlqdbApiError } from "../../../packages/sdk/src/index.ts";

// Stub helper — accepts overrides for the methods a test exercises;
// every other NlqClient method throws "not stubbed" so an accidental
// extra call surfaces in the failing test. Mirrors the helper used
// in packages/mcp/test/index.test.ts.
function stubClient(overrides: Partial<NlqClient>): NlqClient {
  const notStubbed = (name: string) => () => {
    throw new Error(`stubClient: ${name} not stubbed`);
  };
  return {
    ask: notStubbed("ask"),
    askStream: notStubbed("askStream"),
    listChat: async () => ({ messages: [] }),
    postChat: notStubbed("postChat"),
    listDatabases: async () => ({ databases: [] }),
    createDatabase: notStubbed("createDatabase"),
    deleteDatabase: notStubbed("deleteDatabase"),
    getKeyStatus: async () => ({ revoked: false }),
    listKeys: async () => ({ keys: [] }),
    revokeKey: notStubbed("revokeKey"),
    redeemOAuthBridgeCode: notStubbed("redeemOAuthBridgeCode"),
    ...overrides,
  };
}

// Spin up a client+server pair connected by linked in-memory
// transports. Returns the client and a teardown the test can defer.
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
  it("exposes exactly three tools in the SK-MCP-002 order", async () => {
    const { mcpClient, teardown } = await connect(stubClient({}));
    try {
      const { tools } = await mcpClient.listTools();
      const names = tools.map((t) => t.name);
      // SK-MCP-002: three tools, one canonical shape. Order is part
      // of the contract — agents discover by index in some clients.
      expect(names).toEqual(["nlqdb_query", "nlqdb_list_databases", "nlqdb_describe"]);
      // Every tool ships a description (LLMs route on this).
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
      // Structured content carries the rows + a nested trace block
      // (SK-MCP-002 + GLOBAL-023). Shape mirrors `queryOutputShape`
      // in packages/mcp/src/tools.ts — never flatten the trace.
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
    // Use `unauthorized` because `mapSdkError` has an explicit mapping
    // for it (auth_required), so the assertion verifies the actual
    // GLOBAL-012 shape — one sentence + a concrete next action with a
    // URL the agent can quote back to the user.
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
      // Text content is the human-readable one-liner + next-action
      // (GLOBAL-012). Format is `${message}\n\n→ ${action}`.
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
