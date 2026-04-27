import { describe, expect, it } from "vitest";
import { askFnFromDemoFixtures, DEMO_DB_ID } from "../src/chat/demo-shortcut.ts";

describe("chat demo-shortcut", () => {
  it("DEMO_DB_ID is the literal 'demo'", () => {
    // Asserting the literal so /app's empty-state copy and any
    // future client docs stay in sync. If this string changes,
    // both the copy AND this test fail — forces a docs update.
    expect(DEMO_DB_ID).toBe("demo");
  });

  it("returns a successful OrchestrateOutcome shaped for chat-orchestrate", async () => {
    const ask = askFnFromDemoFixtures();
    const outcome = await ask({ goal: "today's orders", dbId: "demo", userId: "u1" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.status).toBe("ok");
    expect(outcome.result.sql).toContain("orders");
    expect(outcome.result.rows.length).toBeGreaterThan(0);
    expect(outcome.result.rowCount).toBeGreaterThan(0);
    expect(outcome.result.cached).toBe(false);
    expect(outcome.result.summary).toContain("orders");
  });

  it("matches different fixtures via goal substring (memory / CRM / leaderboard)", async () => {
    const ask = askFnFromDemoFixtures();
    const memory = await ask({ goal: "agent memory", dbId: "demo", userId: "u1" });
    const crm = await ask({ goal: "CRM contacts", dbId: "demo", userId: "u1" });
    const leaderboard = await ask({ goal: "leaderboard", dbId: "demo", userId: "u1" });
    expect(memory.ok && memory.result.sql).toMatch(/agent_memory/);
    expect(crm.ok && crm.result.sql).toMatch(/contacts/);
    expect(leaderboard.ok && leaderboard.result.sql).toMatch(/hackathon_scores/);
  });
});
