// E-02 unit tests — deterministic INSERT builder, input validation, and
// the orchestrator (stubbed exec; no Neon). The exec adapter itself
// (`build-deps.ts buildMemoryExec`) is exercised by the Neon-branch e2e
// smoke, same as `buildExec`.

import { describe, expect, it, vi } from "vitest";

import { DbConfigError, type DbRecord, type QueryResult } from "../ask/types.ts";
import {
  buildRememberInsert,
  isAgentMemoryV1Db,
  orchestrateRemember,
  type RememberDeps,
  validateRememberInput,
} from "./remember.ts";

const MEMORY_DB_ID = "db_agent_memory_v1_abc123";

function makeDb(overrides: Partial<DbRecord> = {}): DbRecord {
  return {
    id: MEMORY_DB_ID,
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "NEON_DB_MEM",
    schemaHash: "agent_memory_v1",
    schemaText: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<RememberDeps> = {}): RememberDeps {
  return {
    resolveDb: async () => makeDb(),
    execMemory: async () =>
      ({
        rows: [{ id: "7", materialised_at: "2026-06-20T00:00:00Z" }],
        rowCount: 1,
      }) satisfies QueryResult,
    rateLimiter: { check: async () => ({ allowed: true, count: 1, limit: 60, resetAt: 0 }) },
    ...overrides,
  };
}

describe("isAgentMemoryV1Db", () => {
  it("matches only the preset id prefix", () => {
    expect(isAgentMemoryV1Db("db_agent_memory_v1_abc123")).toBe(true);
    expect(isAgentMemoryV1Db("db_orders_xyz789")).toBe(false);
    expect(isAgentMemoryV1Db("db_agent_memory_v2_abc123")).toBe(false);
  });
});

describe("buildRememberInsert", () => {
  const ctx = { agentId: "user_1", nowMs: Date.parse("2026-06-20T00:00:00Z") };

  it("builds a parameterised facts INSERT with computed expires_at", () => {
    const plan = buildRememberInsert(
      {
        db: MEMORY_DB_ID,
        kind: "fact",
        endUserId: "u_9",
        ttlSeconds: 60,
        payload: { content: "prefers dark mode", kind: "preference", tags: ["ui"] },
      },
      ctx,
    );
    expect(plan.table).toBe("facts");
    expect(plan.text).toContain("INSERT INTO facts");
    expect(plan.text).toContain("$6::text[]");
    expect(plan.text).toContain("$7::jsonb");
    expect(plan.text).toContain("RETURNING id, created_at AS materialised_at, expires_at");
    expect(plan.params).toEqual([
      "user_1",
      "u_9",
      null,
      "preference",
      "prefers dark mode",
      ["ui"],
      null,
      "2026-06-20T00:01:00.000Z",
    ]);
  });

  it("defaults fact kind to 'fact' and leaves expires_at null without a ttl", () => {
    const plan = buildRememberInsert(
      { db: MEMORY_DB_ID, kind: "fact", payload: { content: "x" } },
      ctx,
    );
    expect(plan.params[3]).toBe("fact");
    expect(plan.params[7]).toBeNull();
  });

  it("serialises jsonb payloads as strings", () => {
    const plan = buildRememberInsert(
      {
        db: MEMORY_DB_ID,
        kind: "episode",
        payload: { role: "assistant", content: "hi", tool_calls: { a: 1 }, tokens: 12 },
      },
      ctx,
    );
    expect(plan.table).toBe("episodes");
    expect(plan.params[5]).toBe(JSON.stringify({ a: 1 }));
    expect(plan.params[6]).toBe(12);
  });

  it("upserts entities on the unique key", () => {
    const plan = buildRememberInsert(
      {
        db: MEMORY_DB_ID,
        kind: "entity",
        payload: { kind: "person", canonical_name: "Ada", properties: { role: "eng" } },
      },
      ctx,
    );
    expect(plan.table).toBe("entities");
    expect(plan.text).toContain("ON CONFLICT (agent_id, kind, canonical_name)");
    expect(plan.text).toContain("DO UPDATE SET last_seen_at = NOW()");
    expect(plan.params).toEqual(["user_1", "person", "Ada", JSON.stringify({ role: "eng" })]);
  });
});

describe("validateRememberInput", () => {
  it("accepts a minimal fact", () => {
    const r = validateRememberInput({ db: "d", kind: "fact", payload: { content: "hi" } });
    expect(r.ok).toBe(true);
  });
  it("rejects an unknown kind", () => {
    const r = validateRememberInput({ db: "d", kind: "note", payload: {} });
    expect(r.ok).toBe(false);
  });
  it("rejects a fact with no content", () => {
    const r = validateRememberInput({ db: "d", kind: "fact", payload: { tags: ["x"] } });
    expect(r.ok).toBe(false);
  });
  it("rejects an entity with no canonical_name", () => {
    const r = validateRememberInput({ db: "d", kind: "entity", payload: { kind: "person" } });
    expect(r.ok).toBe(false);
  });
  it("rejects a non-positive ttl", () => {
    const r = validateRememberInput({
      db: "d",
      kind: "fact",
      payload: { content: "x" },
      ttlSeconds: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe("orchestrateRemember", () => {
  const req = {
    args: { db: MEMORY_DB_ID, kind: "fact" as const, payload: { content: "hi" } },
    userId: "user_1",
    agentId: "user_1",
    nowMs: Date.parse("2026-06-20T00:00:00Z"),
  };

  it("returns the materialised row on the happy path", async () => {
    const out = await orchestrateRemember(makeDeps(), req);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result).toEqual({ id: "7", kind: "fact", materialised_at: "2026-06-20T00:00:00Z" });
  });

  it("surfaces expires_at when the row carries one", async () => {
    const out = await orchestrateRemember(
      makeDeps({
        execMemory: async () => ({
          rows: [{ id: "8", materialised_at: "t", expires_at: "2026-06-21T00:00:00Z" }],
          rowCount: 1,
        }),
      }),
      req,
    );
    expect(out.ok && out.result.expires_at).toBe("2026-06-21T00:00:00Z");
  });

  it("rejects a non-memory DB with wrong_preset and never execs", async () => {
    const execMemory = vi.fn();
    const out = await orchestrateRemember(
      makeDeps({ resolveDb: async () => makeDb({ id: "db_orders_x" }), execMemory }),
      req,
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("wrong_preset");
    expect(execMemory).not.toHaveBeenCalled();
  });

  it("returns db_not_found when the DB does not resolve", async () => {
    const out = await orchestrateRemember(makeDeps({ resolveDb: async () => null }), req);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("db_not_found");
  });

  it("returns rate_limited when the limiter denies", async () => {
    const out = await orchestrateRemember(
      makeDeps({
        rateLimiter: { check: async () => ({ allowed: false, count: 61, limit: 60, resetAt: 99 }) },
      }),
      req,
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("rate_limited");
  });

  it("maps a DbConfigError to db_misconfigured and other throws to db_unreachable", async () => {
    const misconfigured = await orchestrateRemember(
      makeDeps({
        execMemory: async () => {
          throw new DbConfigError("no url");
        },
      }),
      req,
    );
    expect(misconfigured.ok === false && misconfigured.error.status).toBe("db_misconfigured");

    const unreachable = await orchestrateRemember(
      makeDeps({
        execMemory: async () => {
          throw new Error("ECONNRESET");
        },
      }),
      req,
    );
    expect(unreachable.ok === false && unreachable.error.status).toBe("db_unreachable");
  });
});
