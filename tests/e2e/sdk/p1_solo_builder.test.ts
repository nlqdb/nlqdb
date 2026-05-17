// P1 — The Solo Builder. SDK contract for the Sunday-morning flow:
// list databases, pick the project one, ask "upcoming meals", get
// rows + trace + summary. Second identical ask hits the plan-cache
// (GLOBAL-006) — `trace.cache_hit` flips true.
//
// Hermetic: replays `cassettes/p1_solo_builder.json`. Re-record with
// RECORD=1 against staging (see README).
//
// Persona link: ../personas/P1-solo-builder/README.md — row "SDK
// contract: client.ask(...) returns rows + summary".

import { describe, expect, it } from "vitest";
import { createClient } from "../../../packages/sdk/src/index.ts";
import { openCassette } from "./_lib/cassette.ts";

describe("P1 — Solo Builder · SDK contract", () => {
  it("list-then-ask returns rows + trace + summary; second call cache-hits", async () => {
    const { fetch, assertConsumed } = openCassette("p1_solo_builder");
    const client = createClient({
      apiKey: "sk_live_p1_e2e",
      baseUrl: "https://staging.example.com",
      fetch,
    });

    // Step 1 — Maya's app calls listDatabases() once on startup.
    const { databases } = await client.listDatabases();
    expect(databases).toHaveLength(1);
    const [db] = databases;
    if (!db) throw new Error("unreachable: databases.length is 1");
    expect(db.slug).toBe("mealplan");
    expect(db.engine).toBe("postgres");
    // Publishable key is exposed so the same DB can be embedded
    // client-side without re-minting (`pk_live_*` is read-only).
    expect(db.pkLive).toMatch(/^pk_live_/);

    // Step 2 — first ask burns one LLM call.
    const first = await client.ask({
      goal: "upcoming meals this week",
      dbId: db.id,
    });
    if ("kind" in first) throw new Error("expected ask path, got create");
    expect(first.status).toBe("ok");
    expect(first.rows).toHaveLength(2);
    expect(first.summary).toContain("2 upcoming meals");
    // Trace block is always present (SK-TRUST-002).
    expect(first.trace.sql).toMatch(/SELECT/i);
    expect(first.trace.cache_hit).toBe(false);

    // Step 3 — identical second ask hits the plan-cache (GLOBAL-006).
    const second = await client.ask({
      goal: "upcoming meals this week",
      dbId: db.id,
    });
    if ("kind" in second) throw new Error("expected ask path, got create");
    expect(second.trace.cache_hit).toBe(true);
    expect(second.trace.plan_id).toBe(first.trace.plan_id);

    assertConsumed();
  });
});
