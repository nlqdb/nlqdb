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

    const { databases } = await client.listDatabases();
    expect(databases).toHaveLength(1);
    const [db] = databases;
    if (!db) throw new Error("unreachable: databases.length is 1");
    expect(db.slug).toBe("mealplan");
    expect(db.engine).toBe("postgres");
    expect(db.pkLive).toMatch(/^pk_live_/);

    const first = await client.ask({
      goal: "upcoming meals this week",
      dbId: db.id,
    });
    if ("kind" in first) throw new Error("expected ask path, got create");
    expect(first.status).toBe("ok");
    expect(first.rows).toHaveLength(2);
    expect(first.summary).toContain("2 upcoming meals");
    expect(first.trace.sql).toMatch(/SELECT/i);
    expect(first.trace.cache_hit).toBe(false);

    // Identical second ask must hit plan-cache per GLOBAL-006.
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
