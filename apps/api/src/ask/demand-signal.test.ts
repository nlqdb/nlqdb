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
    const error: AskError = { status: "sql_rejected", reason: "drop_statement" };

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

  it("emits ddl_via_ask for every reason in DDL_REJECT_REASONS", async () => {
    for (const reason of [
      "drop_statement",
      "truncate_statement",
      "alter_statement",
      "grant_or_revoke",
      "disallowed_verb",
    ]) {
      const { emitter, ctx, emitted } = makeRecorder();
      emitFeatureSignal(emitter, ctx, "u_1", "chat", { status: "sql_rejected", reason });
      await new Promise((r) => setTimeout(r, 0));
      expect(emitted[0]?.name).toBe("feature.requested.ddl_via_ask");
    }
  });

  it("does NOT emit on sql_rejected with non-DDL reasons (parse_failed, empty, delete_without_where)", async () => {
    for (const reason of ["parse_failed", "empty", "delete_without_where"]) {
      const { emitter, ctx, emitted } = makeRecorder();
      emitFeatureSignal(emitter, ctx, "u_1", "chat", { status: "sql_rejected", reason });
      await new Promise((r) => setTimeout(r, 0));
      expect(emitted).toHaveLength(0);
    }
  });

  it("emits feature.requested.heavier_tier on rate_limited", async () => {
    const { emitter, ctx, emitted } = makeRecorder();
    const error: AskError = {
      status: "rate_limited",
      limit: 30,
      count: 31,
      resetAt: 1_700_000_000,
    };

    emitFeatureSignal(emitter, ctx, "u_5", "chat", error);
    await new Promise((r) => setTimeout(r, 0));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      name: "feature.requested.heavier_tier",
      principalId: "u_5",
      surface: "chat",
    });
  });

  it("does not emit on other error shapes (db_not_found, llm_failed, schema_mismatch)", async () => {
    const errors: AskError[] = [
      { status: "db_not_found" },
      { status: "llm_failed" },
      { status: "schema_mismatch", referencedTables: ["x"], schemaTables: ["y"] },
      { status: "db_unreachable" },
      { status: "db_misconfigured" },
      { status: "schema_unavailable" },
    ];
    for (const error of errors) {
      const { emitter, ctx, emitted } = makeRecorder();
      emitFeatureSignal(emitter, ctx, "u_1", "chat", error);
      await new Promise((r) => setTimeout(r, 0));
      expect(emitted).toHaveLength(0);
    }
  });
});
