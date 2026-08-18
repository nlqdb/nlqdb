// SK-EVENTS-010 — unit tests for the demand-signal emit helper. The
// route-handler integration is exercised by `test/orchestrate.test.ts`
// and friends; these tests pin the emit-shape contract.

import type { EventEmitter, ProductEvent } from "@nlqdb/events";
import { describe, expect, it } from "vitest";
import { emitFeatureSignal, type WaitUntilCtx } from "./demand-signal.ts";
import type { AskError } from "./types.ts";

function makeRecorder(): { emitter: EventEmitter; ctx: WaitUntilCtx; emitted: ProductEvent[] } {
  const emitted: ProductEvent[] = [];
  const emitter: EventEmitter = {
    async emit(event) {
      emitted.push(event);
    },
  };
  const ctx: WaitUntilCtx = {
    waitUntil(promise) {
      // Drain the promise synchronously enough for the test (Bun's
      // microtask queue settles before the next assertion).
      void promise;
    },
  };
  return { emitter, ctx, emitted };
}

describe("emitFeatureSignal", () => {
  it("emits feature.requested.ddl_via_ask on sql_rejected with a DDL reason", async () => {
    const { emitter, ctx, emitted } = makeRecorder();
    const error: AskError = { code: "sql_rejected", reason: "drop_statement" };

    emitFeatureSignal(emitter, ctx, "anon:abc", "hero", error);
    await new Promise((r) => setTimeout(r, 0));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      name: "feature.requested.ddl_via_ask",
      principalId: "anon:abc",
      surface: "hero",
      rejectReason: "drop_statement",
    });
  });

  it("SK-ASK-026: emits ddl_via_ask on a destructive_ambiguous clarify (drop/truncate rerouted here)", async () => {
    const { emitter, ctx, emitted } = makeRecorder();
    const error: AskError = {
      code: "clarify_required",
      clarification: "destructive_ambiguous",
      pinned_db: null,
      reason: "Clearing the whole database could mean a few things.",
      options: [{ label: "Start fresh", goal: "create a new empty database", forceNoPin: true }],
    };

    emitFeatureSignal(emitter, ctx, "anon:abc", "hero", error);
    await new Promise((r) => setTimeout(r, 0));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      name: "feature.requested.ddl_via_ask",
      principalId: "anon:abc",
      surface: "hero",
      rejectReason: "destructive_ambiguous",
    });
  });

  it("does NOT emit on a create_or_query_pinned clarify (SK-ASK-014 is not a demand signal)", async () => {
    const { emitter, ctx, emitted } = makeRecorder();
    const error: AskError = {
      code: "clarify_required",
      clarification: "create_or_query_pinned",
      pinned_db: { id: "db_1", slug: "orders" },
      reason: "Create a new database, or query orders?",
    };
    emitFeatureSignal(emitter, ctx, "u_1", "chat", error);
    await new Promise((r) => setTimeout(r, 0));
    expect(emitted).toHaveLength(0);
  });

  it("emits ddl_via_ask for every reason in DDL_REJECT_REASONS", async () => {
    for (const reason of [
      "drop_statement",
      "truncate_statement",
      "alter_statement",
      "grant_or_revoke",
      "disallowed_verb",
    ]) {
      const { emitter, ctx, emitted } = makeRecorder();
      emitFeatureSignal(emitter, ctx, "u_1", "chat", { code: "sql_rejected", reason });
      await new Promise((r) => setTimeout(r, 0));
      expect(emitted[0]?.name).toBe("feature.requested.ddl_via_ask");
    }
  });

  it("does NOT emit on sql_rejected with non-DDL reasons (parse_failed, empty, delete_without_where)", async () => {
    for (const reason of ["parse_failed", "empty", "delete_without_where"]) {
      const { emitter, ctx, emitted } = makeRecorder();
      emitFeatureSignal(emitter, ctx, "u_1", "chat", { code: "sql_rejected", reason });
      await new Promise((r) => setTimeout(r, 0));
      expect(emitted).toHaveLength(0);
    }
  });

  it("emits feature.requested.larger_account on rate_limited (authed per-account trip, SK-EVENTS-010)", async () => {
    const { emitter, ctx, emitted } = makeRecorder();
    const error: AskError = {
      code: "rate_limited",
      limit: 60,
      count: 61,
      resetAt: 1_700_000_000,
    };

    emitFeatureSignal(emitter, ctx, "u_5", "chat", error);
    await new Promise((r) => setTimeout(r, 0));

    // The orchestrator rate_limited is the per-account D1 bucket — the
    // anon per-IP gate fires `heavier_tier` at the route top-level, not
    // through this helper. The two demand signals stay distinct.
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      name: "feature.requested.larger_account",
      principalId: "u_5",
      surface: "chat",
    });
  });

  it("does not emit on other error shapes (db_not_found, llm_failed, schema_mismatch)", async () => {
    const errors: AskError[] = [
      { code: "db_not_found" },
      { code: "llm_failed" },
      { code: "schema_mismatch", referencedTables: ["x"], schemaTables: ["y"] },
      { code: "db_unreachable" },
      { code: "db_misconfigured" },
      { code: "schema_unavailable" },
    ];
    for (const error of errors) {
      const { emitter, ctx, emitted } = makeRecorder();
      emitFeatureSignal(emitter, ctx, "u_1", "chat", error);
      await new Promise((r) => setTimeout(r, 0));
      expect(emitted).toHaveLength(0);
    }
  });
});
