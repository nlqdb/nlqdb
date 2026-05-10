// SK-ASK-011 — reconciler tests. The SpeculativeHandle is stubbed
// here (the speculative module's tests cover the actual DROP/DELETE
// behaviour); the reconciler is purely a dispatch function.

import { describe, expect, it, vi } from "vitest";
import type { DatabaseSummaryRow } from "../databases/list.ts";
import type { SpeculativeHandle } from "../db-create/speculative.ts";
import type { DbCreateResult } from "../db-create/types.ts";
import { reconcileSpeculativeCreate } from "./reconcile-speculative.ts";

function makeSpeculativeHandle(opts: {
  result: DbCreateResult | (() => Promise<DbCreateResult>);
  speculativeDoneAt?: number;
}): SpeculativeHandle & { rollback: ReturnType<typeof vi.fn> } {
  const result = typeof opts.result === "function" ? opts.result() : Promise.resolve(opts.result);
  const speculativeDoneAt = Promise.resolve(opts.speculativeDoneAt ?? 0);
  const rollback = vi.fn(async () => {});
  return { result, speculativeDoneAt, rollback } as unknown as SpeculativeHandle & {
    rollback: ReturnType<typeof vi.fn>;
  };
}

const COMMITTED_RESULT: DbCreateResult = {
  ok: true,
  dbId: "db_orders_tracker_a4f3b2",
  schemaName: "orders_tracker_a4f3b2",
  engine: "postgres",
  pkLive: null,
  plan: { metrics: [], dimensions: [], foreign_keys: [] },
  sampleRows: [],
};

const ONE_DB: DatabaseSummaryRow = {
  id: "db_existing_xyz123",
  slug: "existing-xyz123",
  engine: "postgres",
  pkLive: null,
  lastQueriedAt: null,
  createdAt: 0,
};

describe("reconcileSpeculativeCreate", () => {
  it("D1 returns 0 dbs + create succeeded → committed with the create result", async () => {
    const handle = makeSpeculativeHandle({ result: COMMITTED_RESULT });
    const out = await reconcileSpeculativeCreate({
      speculative: handle,
      authoritativeDbsPromise: Promise.resolve([]),
      principalKind: "user",
    });
    expect(out).toEqual({ kind: "committed", result: COMMITTED_RESULT });
    expect(handle.rollback).not.toHaveBeenCalled();
  });

  it("D1 returns ≥ 1 dbs → rollback with reason=dbs_appeared, returns the dbs", async () => {
    const handle = makeSpeculativeHandle({ result: COMMITTED_RESULT });
    const out = await reconcileSpeculativeCreate({
      speculative: handle,
      authoritativeDbsPromise: Promise.resolve([ONE_DB]),
      principalKind: "user",
    });
    expect(out).toEqual({ kind: "rolled_back", dbs: [ONE_DB] });
    expect(handle.rollback).toHaveBeenCalledWith({ reason: "dbs_appeared" });
  });

  it("D1 read fails → rollback with reason=list_failed (fail safe)", async () => {
    const handle = makeSpeculativeHandle({ result: COMMITTED_RESULT });
    const out = await reconcileSpeculativeCreate({
      speculative: handle,
      authoritativeDbsPromise: Promise.reject(new Error("d1 down")),
      principalKind: "anon",
    });
    expect(out).toEqual({ kind: "rolled_back", dbs: [] });
    expect(handle.rollback).toHaveBeenCalledWith({ reason: "list_failed" });
  });

  it("forwards idempotencyKey to rollback when present (rollback branch)", async () => {
    const handle = makeSpeculativeHandle({ result: COMMITTED_RESULT });
    await reconcileSpeculativeCreate({
      speculative: handle,
      authoritativeDbsPromise: Promise.resolve([ONE_DB]),
      principalKind: "user",
      idempotencyKey: "key_42",
    });
    expect(handle.rollback).toHaveBeenCalledWith({
      idempotencyKey: "key_42",
      reason: "dbs_appeared",
    });
  });

  it("create rejected after speculation + D1 says 0 → propagates the create error", async () => {
    const handle = makeSpeculativeHandle({
      result: () => Promise.reject(new Error("orchestrator panic")),
    });
    await expect(
      reconcileSpeculativeCreate({
        speculative: handle,
        authoritativeDbsPromise: Promise.resolve([]),
        principalKind: "user",
      }),
    ).rejects.toThrow(/panic/);
  });

  it("create returned ok:false + D1 says 0 → committed with the failure envelope", async () => {
    const failed: DbCreateResult = {
      ok: false,
      error: { kind: "infer_failed", reason: "ambiguous_goal" },
    };
    const handle = makeSpeculativeHandle({ result: failed });
    const out = await reconcileSpeculativeCreate({
      speculative: handle,
      authoritativeDbsPromise: Promise.resolve([]),
      principalKind: "user",
    });
    expect(out).toEqual({ kind: "committed", result: failed });
  });
});
