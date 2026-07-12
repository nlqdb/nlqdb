import { describe, expect, test } from "bun:test";
import { assessHandshake, type Handshake } from "../src/flow-005-stdio.ts";

// The catalog an MCP host discovers on the stdio transport (SK-MCP-002).
// Drift here changes the contract every npm-fallback install depends on.
const GOOD: Handshake = {
  serverName: "@nlqdb/mcp",
  serverVersion: "0.0.0",
  toolsCapability: true,
  tools: [
    {
      name: "nlqdb_query",
      annotations: { destructiveHint: true },
      inputSchema: { properties: { db: {}, q: {}, confirm: {}, model: {} } },
    },
    {
      name: "nlqdb_list_databases",
      annotations: { readOnlyHint: true },
      inputSchema: { properties: {} },
    },
    {
      name: "nlqdb_describe",
      annotations: { readOnlyHint: true },
      inputSchema: { properties: { db: {} } },
    },
    {
      name: "nlqdb_remember",
      annotations: { destructiveHint: false },
      inputSchema: {
        properties: { db: {}, kind: {}, payload: {}, endUserId: {}, threadId: {}, ttlSeconds: {} },
      },
    },
    {
      name: "nlqdb_connect_database",
      annotations: { destructiveHint: false },
      inputSchema: { properties: { engine: {}, connection_url: {}, name: {} } },
    },
  ],
};

describe("assessHandshake (FLOW-005 stdio catalog contract)", () => {
  test("the real catalog passes every check", () => {
    const { protocolOk, catalogOk, checks } = assessHandshake(GOOD);
    expect(protocolOk).toBe(true);
    expect(catalogOk).toBe(true);
    expect(checks.every((c) => c.status === "ok")).toBe(true);
  });

  test("a stray create_database tool fails the catalog (pins the SK-MCP-002 coherence guard)", () => {
    const drift = {
      ...GOOD,
      tools: [...GOOD.tools, { name: "create_database", inputSchema: { properties: {} } }],
    };
    const { catalogOk, checks } = assessHandshake(drift);
    expect(catalogOk).toBe(false);
    expect(checks.find((c) => c.name.includes("create_database"))?.status).toBe("fail");
  });

  test("a wrong destructive hint on nlqdb_query fails (trust-UX regression)", () => {
    const drift = {
      ...GOOD,
      tools: GOOD.tools.map((t) =>
        t.name === "nlqdb_query" ? { ...t, annotations: { readOnlyHint: true } } : t,
      ),
    };
    expect(assessHandshake(drift).catalogOk).toBe(false);
  });

  test("a missing input-schema key on nlqdb_query fails", () => {
    const drift = {
      ...GOOD,
      tools: GOOD.tools.map((t) =>
        t.name === "nlqdb_query" ? { ...t, inputSchema: { properties: { db: {}, q: {} } } } : t,
      ),
    };
    expect(assessHandshake(drift).catalogOk).toBe(false);
  });

  test("a non-nlqdb server name fails the protocol axis", () => {
    expect(assessHandshake({ ...GOOD, serverName: "@evil/mcp" }).protocolOk).toBe(false);
  });

  test("a server without the tools capability fails the protocol axis", () => {
    expect(assessHandshake({ ...GOOD, toolsCapability: false }).protocolOk).toBe(false);
  });
});
