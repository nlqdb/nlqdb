// E-04 unit tests — the deterministic TTL-sweep core (stubbed exec; no
// Neon). The exec adapter + the cron Worker that drives this are infra,
// exercised by the Neon-branch smoke once they land, same as
// `buildMemoryExec`.

import { describe, expect, it } from "vitest";

import { DbConfigError, type DbRecord, type QueryResult } from "../ask/types.ts";
import { buildExpirySweep, type MemorySweepPlan, orchestrateSweep } from "./expire.ts";

const NOW = Date.parse("2026-06-21T00:00:00Z");

function makeDb(id: string): DbRecord {
  return {
    id,
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "NEON_DB_MEM",
    schemaHash: "agent_memory_v1",
    schemaText: null,
    connectionBlob: null,
  };
}

function execDeleting(rowCount: number) {
  return async (): Promise<QueryResult> => ({
    rows: Array.from({ length: rowCount }, (_, i) => ({ id: String(i + 1) })),
    rowCount,
  });
}

describe("buildExpirySweep", () => {
  it("targets facts only, with the cutoff as a bound param", () => {
    const plan = buildExpirySweep(NOW);
    expect(plan.table).toBe("facts");
    expect(plan.text).toBe(
      "DELETE FROM facts WHERE expires_at IS NOT NULL AND expires_at < $1 RETURNING id",
    );
    expect(plan.params).toEqual(["2026-06-21T00:00:00.000Z"]);
  });

  it("never names episodes or entities (they have no expires_at)", () => {
    const plan = buildExpirySweep(NOW);
    expect(plan.text).not.toMatch(/episodes|entities/);
  });
});

describe("orchestrateSweep", () => {
  it("sweeps only memory-preset DBs and aggregates the deleted count", async () => {
    const dbs = [
      makeDb("db_agent_memory_v1_aaa"),
      makeDb("db_orders_bbb"), // non-memory — skipped
      makeDb("db_agent_memory_v1_ccc"),
    ];
    const summary = await orchestrateSweep({ execMemory: execDeleting(3), nowMs: NOW }, dbs);
    expect(summary.scanned).toBe(2);
    expect(summary.swept).toBe(2);
    expect(summary.expiredRows).toBe(6);
    expect(summary.failures).toBe(0);
  });

  it("passes the deterministic cutoff plan to the exec", async () => {
    let seen: MemorySweepPlan | null = null;
    const dbs = [makeDb("db_agent_memory_v1_aaa")];
    await orchestrateSweep(
      {
        execMemory: async (_db, plan) => {
          seen = plan;
          return { rows: [], rowCount: 0 };
        },
        nowMs: NOW,
      },
      dbs,
    );
    expect(seen).toEqual(buildExpirySweep(NOW));
  });

  it("isolates a per-DB failure — the other DBs still sweep", async () => {
    const dbs = [
      makeDb("db_agent_memory_v1_aaa"),
      makeDb("db_agent_memory_v1_bad"),
      makeDb("db_agent_memory_v1_ccc"),
    ];
    const summary = await orchestrateSweep(
      {
        execMemory: async (db) => {
          if (db.id === "db_agent_memory_v1_bad") throw new DbConfigError("no url");
          return { rows: [{ id: "1" }], rowCount: 1 };
        },
        nowMs: NOW,
      },
      dbs,
    );
    expect(summary.scanned).toBe(3);
    expect(summary.swept).toBe(2);
    expect(summary.expiredRows).toBe(2);
    expect(summary.failures).toBe(1);
    expect(summary.perDb).toContainEqual({
      dbId: "db_agent_memory_v1_bad",
      ok: false,
      error: "db_misconfigured",
    });
  });

  it("classifies a non-config exec error as db_unreachable", async () => {
    const dbs = [makeDb("db_agent_memory_v1_aaa")];
    const summary = await orchestrateSweep(
      {
        execMemory: async () => {
          throw new Error("connection reset");
        },
        nowMs: NOW,
      },
      dbs,
    );
    expect(summary.failures).toBe(1);
    expect(summary.perDb[0]).toMatchObject({ ok: false, error: "db_unreachable" });
  });

  it("returns an empty summary when no memory DBs exist", async () => {
    const summary = await orchestrateSweep({ execMemory: execDeleting(9), nowMs: NOW }, [
      makeDb("db_orders_xyz"),
    ]);
    expect(summary).toEqual({ scanned: 0, swept: 0, expiredRows: 0, failures: 0, perDb: [] });
  });
});
