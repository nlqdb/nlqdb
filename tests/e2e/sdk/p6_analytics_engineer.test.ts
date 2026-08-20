import { describe, expect, it } from "vitest";
import { createClient, NlqdbApiError } from "../../../packages/sdk/src/index.ts";
import { openCassette } from "./_lib/cassette.ts";

describe("P6 — Analytics Engineer · SDK contract", () => {
  it("surfaces trace + confidence on success; clarifies (never dead-ends) on low confidence", async () => {
    const { fetch, assertConsumed } = openCassette("p6_analytics_engineer");
    const client = createClient({
      apiKey: "sk_live_p6_e2e",
      baseUrl: "https://staging.example.com",
      fetch,
    });

    const ok = await client.ask({
      goal: "orders this week, by source",
      dbId: "db_e2e_p6",
    });
    if ("kind" in ok) throw new Error("expected ask path, got create");
    expect(ok.status).toBe("ok");
    expect(ok.rows).toHaveLength(2);
    expect(ok.summary).toMatch(/180/);
    expect(ok.trace.sql).toMatch(/SELECT/i);
    expect(ok.trace.confidence).toBeGreaterThan(0.8);
    expect(ok.trace.model).toBeTruthy();

    let thrown: unknown = null;
    try {
      await client.ask({
        goal: "something ambiguous",
        dbId: "db_e2e_p6",
      });
    } catch (e) {
      thrown = e;
    }
    // GLOBAL-040 — a below-floor plan is a guided `clarify_required` turn
    // (`clarification: "low_confidence"`, one re-sendable `options` entry per
    // candidate reading), never a standalone `low_confidence` dead-end error.
    // The pipeline still never runs the plan silently — the analytics engineer
    // gets one sharp question plus the answer to it, not coerced SQL.
    expect(thrown).toBeInstanceOf(NlqdbApiError);
    const err = thrown as NlqdbApiError;
    expect(err.httpStatus).toBe(409);
    expect(err.code).toBe("clarify_required");
    expect(err.body?.clarification).toBe("low_confidence");
    expect(err.body?.options?.length).toBeGreaterThan(0);
    expect(err.body?.reason).toMatch(/which did you mean/i);

    assertConsumed();
  });
});
