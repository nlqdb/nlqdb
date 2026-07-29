// Protocol-revision guards for the MCP 2026-07-28 audit (E-08).
//
// The 2026-07-28 revision is final, but `@modelcontextprotocol/sdk` v1 will
// never serve it — support landed only in the v2 packages
// (`@modelcontextprotocol/server`), which require Node >= 20 and Zod 4. So
// nlqdb serves 2025-11-25 and is compliant *via the spec's own fallback*
// (new clients probe `server/discover`, then fall back to `initialize`).
//
// These tests do not assert the new revision. They pin the reality so the
// migration in E-08 is a conscious act rather than a surprise, and they
// protect the migration path: the cheapest way to make the v2 jump
// expensive is to start depending on a primitive the new revision
// deprecated. Every assertion here is about *today's* served behaviour.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import type { NlqClient } from "@nlqdb/sdk";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/index.ts";

// The revision nlqdb's MCP surfaces actually negotiate today.
const SERVED_REVISION = "2025-11-25";
// The revision published 2026-07-28; reachable only from SDK v2.
const NEW_REVISION = "2026-07-28";

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));

function readSrc(): string {
  return readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(`${SRC_DIR}/${f}`, "utf8"))
    .join("\n");
}

// Minimal client stub — these tests only read the tool catalog, never invoke.
function catalogOnlyClient(): NlqClient {
  return new Proxy({} as NlqClient, {
    get(_t, prop) {
      throw new Error(`catalogOnlyClient: ${String(prop)} must not be called by a catalog test`);
    },
  });
}

async function connect() {
  const server = createServer({ client: catalogOnlyClient(), name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcpClient = new Client({ name: "protocol-revision-test", version: "0.0.0" });
  await mcpClient.connect(clientTransport);
  return { mcpClient, teardown: () => mcpClient.close() };
}

describe("served protocol revision", () => {
  // Fails the moment the SDK is bumped to a version that negotiates a
  // different revision — the E-08 migration must update this pin
  // deliberately, alongside the walkers and the directory payload.
  it("is pinned to the revision the installed SDK negotiates", () => {
    expect(LATEST_PROTOCOL_VERSION).toBe(SERVED_REVISION);
  });

  it("does not yet advertise 2026-07-28 — E-08 owns that migration", () => {
    expect(SUPPORTED_PROTOCOL_VERSIONS).not.toContain(NEW_REVISION);
  });
});

describe("deprecated 2026-07-28 primitives stay unused", () => {
  // Roots, Sampling and Logging are Deprecated as of 2026-07-28 (12-month
  // window). We use none of them today; adopting one now would add work to
  // the v2 migration for a primitive scheduled for removal.
  it.each([
    ["sampling/createMessage", /createMessage|sampling\//],
    ["roots", /listRoots|roots\/list|registerRoot/],
    ["logging", /sendLoggingMessage|logging\/setLevel|setLoggingLevel/],
    // `ping` and SSE resumability are removed outright in 2026-07-28.
    ["ping", /"ping"|'ping'|\bsendPing\b/],
    ["SSE resumability", /Last-Event-ID|SSEServerTransport/],
  ])("%s is absent from packages/mcp/src", (_label, pattern) => {
    expect(readSrc()).not.toMatch(pattern);
  });

  it("declares no logging or sampling server capability", async () => {
    const { mcpClient, teardown } = await connect();
    try {
      const caps = mcpClient.getServerCapabilities();
      expect(caps?.logging).toBeUndefined();
      // `sampling` is a client capability; a server must not claim it.
      expect((caps as Record<string, unknown> | undefined)?.["sampling"]).toBeUndefined();
    } finally {
      await teardown();
    }
  });
});

describe("tool catalog meets the 2026-07-28 + Connectors-Directory bar", () => {
  // 2026-07-28 minor change 3: servers SHOULD return tools in a
  // deterministic order so clients can cache and LLM prompt caches hit.
  const EXPECTED_ORDER = [
    "nlqdb_query",
    "nlqdb_list_databases",
    "nlqdb_describe",
    "nlqdb_remember",
    "nlqdb_connect_database",
  ];

  it("returns tools in a deterministic order", async () => {
    const { mcpClient, teardown } = await connect();
    try {
      const first = await mcpClient.listTools();
      const second = await mcpClient.listTools();
      expect(first.tools.map((t) => t.name)).toEqual(EXPECTED_ORDER);
      expect(second.tools.map((t) => t.name)).toEqual(EXPECTED_ORDER);
    } finally {
      await teardown();
    }
  });

  // Connectors-Directory submission requirement: every tool carries a
  // `title` plus the applicable `readOnlyHint`/`destructiveHint`. A tool
  // missing either is flagged in the portal's Tools step before review.
  it("gives every tool a title and an applicable annotation hint", async () => {
    const { mcpClient, teardown } = await connect();
    try {
      const { tools } = await mcpClient.listTools();
      expect(tools).toHaveLength(EXPECTED_ORDER.length);
      for (const tool of tools) {
        expect(tool.title ?? tool.annotations?.title, `${tool.name} title`).toBeTruthy();
        expect(tool.description, `${tool.name} description`).toBeTruthy();
        const hints = tool.annotations ?? {};
        const hasHint = "readOnlyHint" in hints || "destructiveHint" in hints;
        expect(hasHint, `${tool.name} annotation hint`).toBe(true);
      }
    } finally {
      await teardown();
    }
  });
});
