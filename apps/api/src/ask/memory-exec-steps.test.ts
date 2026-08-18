// Lazy TTL sweep step-composition tests (SK-PIVOT-011 lazy variant, E-04).
//
// Product need being verified: agent memory forgets what it no longer needs
// without a cron. The user journey is "agent writes a fact with a short
// TTL; time passes; agent writes another memory; the expired fact is gone
// from queries and physically evicted from the DB." The read-side half
// (RLS `expires_at` arm) is exercised by the Neon-branch integration test;
// this unit test pins the write-side lazy sweep's step composition and
// gating, which is what makes the memory decay happen at all.

import { describe, expect, it } from "vitest";
import { LAZY_TTL_SWEEP_LIMIT, withLazyTtlSweep } from "./memory-exec-steps.ts";

function fakeBaseSteps(userText: string) {
  // Shape mirrors `buildHostedExecSteps`: owner-context SETs, then
  // `SET LOCAL ROLE`, then the user step. Only the shape matters for
  // splice correctness.
  return [
    { text: "SELECT set_config('search_path', $1, true)", params: ["tenant_schema"] },
    { text: "SELECT set_config('app.tenant_id', $1, true)", params: ["user_1"] },
    { text: "SELECT set_config('app.agent_id', $1, true)", params: ["user_1"] },
    { text: "SET LOCAL statement_timeout = '10s'", params: [] },
    { text: 'SET LOCAL ROLE "tenant_deadbeef"', params: [] },
    { text: userText, params: [] },
  ];
}

describe("withLazyTtlSweep — agent memory decays on every write", () => {
  it("splices the owner-scoped sweep before the role switch on an INSERT plan", () => {
    // An agent writes a fact — the sweep must run *before* the role
    // switch (as owner) so it can see expired rows the RLS TTL arm hides
    // from the tenant role. Otherwise the DELETE targets zero rows and
    // memory never actually decays.
    const base = fakeBaseSteps("INSERT INTO facts (agent_id, content) VALUES ($1, $2)");
    const steps = withLazyTtlSweep(base, { text: base[base.length - 1]?.text ?? "" });

    expect(steps).toHaveLength(base.length + 1);
    // Owner-context SETs unchanged.
    expect(steps.slice(0, 3)).toEqual(base.slice(0, 3));
    // Sweep sits at index 4 — after SET LOCAL statement_timeout, before
    // SET LOCAL ROLE.
    expect(steps[3]).toEqual(base[3]);
    const sweep = steps[4];
    if (!sweep) throw new Error("sweep step missing");
    expect(sweep.text).toContain("DELETE FROM facts");
    expect(sweep.text).toContain("expires_at IS NOT NULL AND expires_at < now()");
    expect(sweep.text).toContain(`LIMIT ${LAZY_TTL_SWEEP_LIMIT}`);
    expect(sweep.params).toEqual([]);
    // Role switch and user INSERT come last, in that order.
    expect(steps[5]).toEqual(base[4]);
    expect(steps[6]).toEqual(base[5]);
  });

  it("skips the sweep on non-INSERT plans (pack-runner reconcile SELECT)", () => {
    // The pack-runner reuses `buildMemoryExec` to run a COUNT reconcile;
    // it must never mutate. Verify a SELECT plan leaves the step list
    // untouched.
    const base = fakeBaseSteps("SELECT COUNT(*) FROM facts");
    const steps = withLazyTtlSweep(base, { text: base[base.length - 1]?.text ?? "" });
    expect(steps).toEqual(base);
  });

  it("gates on the actual verb, not a mention of INSERT in a comment", () => {
    // Defensive: only a leading INSERT triggers the sweep.
    const base = fakeBaseSteps("SELECT 1 -- INSERT lookalike");
    const steps = withLazyTtlSweep(base, { text: base[base.length - 1]?.text ?? "" });
    expect(steps).toEqual(base);
  });

  it("caps the sweep so a burst of expired rows doesn't blow the write's p95", () => {
    // The bound is the whole point of "lazy": the write pays a fixed
    // ceiling, not proportional to the expired backlog. If someone lifts
    // the cap unintentionally this test fires.
    expect(LAZY_TTL_SWEEP_LIMIT).toBe(200);
  });
});
