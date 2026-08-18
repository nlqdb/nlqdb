// MCP tool error contract — the end-to-end guard that stops the
// "An unexpected error occurred → email support" class of bug from ever
// coming back (the one an agent hit calling nlqdb_remember before it had a
// memory DB). Unlike tools.test.ts, which spot-checks individual mappings,
// this drives the *whole* host-visible path — real handler → mapSdkError →
// formatError — and sweeps EVERY known error code so a future gap fails CI
// here instead of in a user's transcript.
//
// The compile-time guard in tools.ts (AssertNever<UnmappedErrorCodes>)
// proves every ApiErrorCode literal *has* a branch; this file proves each
// branch produces something an agent can act on (GLOBAL-012) and never
// leaks internals.

import { type ApiErrorBody, type NlqClient, NlqdbApiError } from "@nlqdb/sdk";
import { describe, expect, it } from "vitest";
import {
  formatError,
  formatResult,
  GENERIC_ERROR_MESSAGE,
  handleConnectDatabase,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  handleRemember,
  KNOWN_ERROR_CODES,
  mapSdkError,
} from "../src/index.ts";

// Codes for which "we genuinely don't know what happened" is the honest
// answer — the only ones allowed to reuse GENERIC_ERROR_MESSAGE. Every
// other known code must say something specific.
const RESIDUAL_CODES = new Set(["unknown_error", "non_json_response"]);

// Minimal client whose one relevant method rejects. The handlers under
// test each call exactly one SDK method (plus databases.connect), so a
// partial cast keeps the reproduction readable without the full stub.
function clientThatThrows(on: {
  ask?: NlqdbApiError;
  listDatabases?: NlqdbApiError;
  remember?: NlqdbApiError;
  connect?: NlqdbApiError;
}): NlqClient {
  return {
    ask: async () => {
      throw on.ask;
    },
    listDatabases: async () => {
      if (on.listDatabases) throw on.listDatabases;
      return { databases: [] };
    },
    remember: async () => {
      throw on.remember;
    },
    databases: {
      connect: async () => {
        throw on.connect;
      },
    },
  } as unknown as NlqClient;
}

function apiError(code: string, status = 500, extra: Record<string, unknown> = {}) {
  const body = { status: code, ...extra } as ApiErrorBody;
  return new NlqdbApiError(`stub ${code}`, status, code, "/v1/ask", body);
}

// The text an MCP host actually shows the model, from a ToolError.
function renderedText(err: Parameters<typeof formatError>[0]): string {
  return formatError(err).content[0]?.text ?? "";
}

describe("every known error code maps to an actionable, non-leaky ToolError", () => {
  it("KNOWN_ERROR_CODES has no duplicate (table vs branch overlap)", () => {
    expect(new Set(KNOWN_ERROR_CODES).size).toBe(KNOWN_ERROR_CODES.length);
    expect(KNOWN_ERROR_CODES.length).toBeGreaterThan(20);
  });

  // `unauthorized` is intentionally re-labelled to the agent-facing
  // `auth_required` (an MCP host should see what to *do*, not the raw HTTP
  // status); every other code keeps its identity.
  const CODE_REMAP: Record<string, string> = { unauthorized: "auth_required" };

  it.each(KNOWN_ERROR_CODES)("%s → actionable code, message + action present", (code) => {
    const err = mapSdkError(apiError(code));
    expect(err.code).toBe(CODE_REMAP[code] ?? code);
    expect(err.message.trim().length).toBeGreaterThan(0);
    expect(err.action.trim().length).toBeGreaterThan(0);
    // Renders cleanly as "message\n\n→ action" — never a dangling arrow.
    expect(renderedText(err)).toMatch(/\S\n\n→ \S/);
  });

  it.each(KNOWN_ERROR_CODES.filter((c) => !RESIDUAL_CODES.has(c)))(
    "%s does not fall back to the generic bucket",
    (code) => {
      expect(mapSdkError(apiError(code)).message).not.toBe(GENERIC_ERROR_MESSAGE);
    },
  );

  // Server-authored `message`/`reason` strings can name a DB host; make
  // sure no mapping echoes a raw internal string from the thrown error.
  it("never leaks the thrown error's raw internal message", () => {
    const leaky = "pg-pool-3.us-east-1.internal:5432 connection refused";
    for (const code of KNOWN_ERROR_CODES) {
      const err = mapSdkError(new NlqdbApiError(leaky, 500, code, "/v1/ask", { status: code }));
      expect(renderedText(err)).not.toContain("internal");
    }
  });

  // A non-API failure (plain Error) is the one legitimate generic case.
  it("still shows the generic bucket for a genuinely unknown error", () => {
    const err = mapSdkError(new Error("internal: hostname 'pg-pool-3.internal' refused"));
    expect(err.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(renderedText(err)).not.toContain("internal");
  });
});

describe("reported bug: nlqdb_remember with no resolvable memory DB", () => {
  // The original Glama-Inspector failure was an opaque db_not_found; the
  // 2026-08-18 founder dogfood extended it — the recovery instruction the
  // server returned ("db.create { preset: 'agent_memory_v1' }") named an
  // MCP tool that doesn't exist, so the agent dead-ended. The fix moved
  // recovery INTO nlqdb_remember: on wrong_preset / db_not_found it lists,
  // adopts, or provisions the memory DB itself and completes the write.
  // These tests pin that new happy path.
  it("provisions the memory DB and completes the write when the caller passes a non-memory `db`", async () => {
    let createCount = 0;
    let rememberedAgainst: string | undefined;
    const client = {
      listDatabases: async () => ({ databases: [] }),
      createDatabase: async () => {
        createCount++;
        return {
          dbId: "db_agent_memory_v1_fresh",
          slug: "agent-memory-fresh",
          engine: "postgres" as const,
          pkLive: "pk_live_x",
        };
      },
      remember: async (req: { db: string }) => {
        rememberedAgainst = req.db;
        if (req.db === "db_not_a_memory_db") {
          throw apiError("wrong_preset", 409);
        }
        return {
          status: "ok" as const,
          id: "1",
          kind: "fact" as const,
          materialised_at: "2026-08-18T00:00:00Z",
        };
      },
    } as unknown as NlqClient;
    const result = await handleRemember(client, {
      db: "db_not_a_memory_db",
      kind: "fact",
      payload: { content: "user prefers dark mode" },
    });
    expect(createCount).toBe(1);
    expect(rememberedAgainst).toBe("db_agent_memory_v1_fresh");
    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.dbId).toBe("db_agent_memory_v1_fresh");
      expect(result.ok.db_created).toBe(true);
    }
  });

  // If self-provision itself fails (the server can't create), the caller
  // still sees the actionable mapped error, never the generic bucket.
  it("keeps the recovery hint when self-provision fails", async () => {
    const client = clientThatThrows({
      remember: apiError("db_not_found", 404),
      // clientThatThrows returns { databases: [] } by default and does
      // not stub createDatabase; the missing method will surface as a
      // recovery failure that maps to the actionable bucket.
    });
    const result = await handleRemember(client, {
      db: "db_not_a_memory_db",
      kind: "fact",
      payload: { content: "user prefers dark mode" },
    });
    expect("err" in result).toBe(true);
    if (!("err" in result)) return;
    const text = renderedText(result.err);
    // Never falls back to "email support" — the mapped error still points
    // the agent at the tools that would help.
    expect(text).not.toContain(GENERIC_ERROR_MESSAGE);
  });

  // wrong_preset behaves the same on the modern surface: the tool recovers
  // by adopting the account's existing memory DB and completing the write.
  it("adopts an existing memory DB when the caller pinned a wrong_preset id", async () => {
    let rememberCalls = 0;
    const client = {
      listDatabases: async () => ({
        databases: [
          {
            id: "db_simple_greeting_563671",
            slug: "simple",
            displayName: "simple",
            engine: "postgres" as const,
            pkLive: null,
            lastQueriedAt: null,
            createdAt: 0,
          },
          {
            id: "db_agent_memory_v1_existing",
            slug: "mem",
            displayName: "mem",
            engine: "postgres" as const,
            pkLive: null,
            lastQueriedAt: null,
            createdAt: 0,
          },
        ],
      }),
      remember: async (req: { db: string }) => {
        rememberCalls++;
        if (req.db === "db_simple_greeting_563671") {
          throw apiError("wrong_preset", 409);
        }
        return {
          status: "ok" as const,
          id: "9",
          kind: "fact" as const,
          materialised_at: "2026-08-18T00:00:01Z",
        };
      },
    } as unknown as NlqClient;
    const result = await handleRemember(client, {
      db: "db_simple_greeting_563671",
      kind: "fact",
      payload: { content: "x" },
    });
    expect(rememberCalls).toBe(2);
    expect("ok" in result).toBe(true);
    if ("ok" in result) expect(result.ok.dbId).toBe("db_agent_memory_v1_existing");
  });

  // A mis-shaped payload → invalid_body carrying the field-level reason;
  // it must reach the agent verbatim, end to end.
  it("passes the server's field-level invalid_body reason through to the host", async () => {
    const client = clientThatThrows({
      remember: apiError("invalid_body", 400, {
        reason: "fact `payload.content` is required.",
      }),
    });
    const result = await handleRemember(client, {
      db: "db_agent_memory_v1_abc123",
      kind: "fact",
      payload: {},
    });
    expect("err" in result).toBe(true);
    if ("err" in result) {
      expect(renderedText(result.err)).toContain("fact `payload.content` is required.");
    }
  });
});

describe("anticipated tool failures render cleanly end-to-end", () => {
  // A memory/BYO DB that was reachable at create time but is now paused or
  // rotated — the transient-infra path. Must read as "retry / check it",
  // never as a dead-end.
  it("db_unreachable on nlqdb_query is a retry hint, not a dead end", async () => {
    const client = clientThatThrows({ ask: apiError("db_unreachable", 502) });
    const result = await handleQuery(client, { db: "db_x", q: "count rows" });
    expect("err" in result && result.err.code).toBe("db_unreachable");
    if ("err" in result) {
      const text = renderedText(result.err);
      expect(text).not.toContain(GENERIC_ERROR_MESSAGE);
      expect(text.toLowerCase()).toMatch(/retry|reach/);
    }
  });

  it("db_misconfigured points at reconnecting the database", async () => {
    const client = clientThatThrows({ ask: apiError("db_misconfigured", 502) });
    const result = await handleQuery(client, { db: "db_x", q: "count rows" });
    expect("err" in result && result.err.code).toBe("db_misconfigured");
    if ("err" in result) expect(renderedText(result.err).toLowerCase()).toContain("reconnect");
  });

  it("schema_unavailable is a transient retry, distinct from db_not_found", async () => {
    const client = clientThatThrows({ ask: apiError("schema_unavailable", 422) });
    const result = await handleQuery(client, { db: "db_x", q: "count rows" });
    expect("err" in result && result.err.code).toBe("schema_unavailable");
    if ("err" in result) expect(renderedText(result.err)).not.toContain(GENERIC_ERROR_MESSAGE);
  });

  it("rate_limited surfaces a concrete wait window on any tool", async () => {
    const client = clientThatThrows({ listDatabases: apiError("rate_limited", 429) });
    const result = await handleListDatabases(client);
    expect("err" in result && result.err.code).toBe("rate_limited");
    if ("err" in result) expect(renderedText(result.err)).toMatch(/\b\d+s\b/);
  });

  it("describe of an unknown DB stays a clean db_not_found, never generic", async () => {
    const client = clientThatThrows({}); // listDatabases returns []
    const result = await handleDescribe(client, { db: "nope" });
    expect("err" in result && result.err.code).toBe("db_not_found");
    if ("err" in result) expect(renderedText(result.err)).toMatch(/nlqdb_list_databases/);
  });

  // connect is sk_live_/account-only (SK-APIKEYS-015); an MCP host must be
  // steered away from re-launching with another sk_mcp_ key, and the
  // secret it just passed must never round-trip into the transcript.
  it("connect_requires_account guides without echoing the connection URL", async () => {
    const client = clientThatThrows({ connect: apiError("connect_requires_account", 403) });
    const result = await handleConnectDatabase(client, {
      engine: "postgres",
      connection_url: "postgres://u:supersecret@db.internal:5432/prod",
    });
    expect("err" in result && result.err.code).toBe("connect_requires_account");
    if ("err" in result) {
      const blob = JSON.stringify(formatResult(result));
      expect(blob).not.toContain("supersecret");
      expect(blob).not.toContain("postgres://");
    }
  });
});
