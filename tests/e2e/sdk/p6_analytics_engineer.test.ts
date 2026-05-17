// P6 — Analytics / Observability Engineer. SDK contract: every
// successful ask carries a `trace` block with SQL + confidence + cache
// state (GLOBAL-011 + GLOBAL-023 + SK-TRUST-002), and low-confidence
// requests refuse loudly rather than coerce.
//
// Hermetic — replays `cassettes/p6_analytics_engineer.json`.
//
// Persona link: ../personas/P6-analytics-engineer/README.md.

import { describe, expect, it } from "vitest";
import { createClient, NlqdbApiError } from "../../../packages/sdk/src/index.ts";
import { openCassette } from "./_lib/cassette.ts";

describe("P6 — Analytics Engineer · SDK contract", () => {
  it("surfaces trace + confidence on success; refuses loudly on low confidence", async () => {
    const { fetch, assertConsumed } = openCassette("p6_analytics_engineer");
    const client = createClient({
      apiKey: "sk_live_p6_e2e",
      baseUrl: "https://staging.example.com",
      fetch,
    });

    // Step 1 — analyst pipes a real question through.
    const ok = await client.ask({
      goal: "orders this week, by source",
      dbId: "db_e2e_p6",
    });
    if ("kind" in ok) throw new Error("expected ask path, got create");
    expect(ok.status).toBe("ok");
    expect(ok.rows).toHaveLength(2);
    expect(ok.summary).toMatch(/180/);
    // GLOBAL-023 trust-UX baseline — trace is always present.
    expect(ok.trace.sql).toMatch(/SELECT/i);
    expect(ok.trace.confidence).toBeGreaterThan(0.8);
    expect(ok.trace.model).toBeTruthy();

    // Step 2 — vague prompt: the LLM router refuses, the SDK throws
    // NlqdbApiError with a discriminated code (not a generic Error).
    let thrown: unknown = null;
    try {
      await client.ask({
        goal: "something ambiguous",
        dbId: "db_e2e_p6",
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(NlqdbApiError);
    const err = thrown as NlqdbApiError;
    expect(err.httpStatus).toBe(422);
    expect(err.code).toBe("low_confidence");
    // The API's body carries the one-sentence + next-action message
    // (GLOBAL-012); the SDK preserves it on `err.body.message`.
    expect(err.body?.message).toMatch(/confidence/i);
    expect(err.body?.message).toMatch(/Try a more specific/i);

    assertConsumed();
  });
});
