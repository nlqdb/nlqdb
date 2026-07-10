import { describe, expect, test } from "bun:test";
import { ATTEMPT_EVENT, LANDING_EVENT, makeDropoffFunnel } from "./dropoff.ts";

// The drop-off funnel pins two guards. `landing` fires once per mount so
// a re-render can't re-count an arrival; `attempt` yields exactly the two
// stages the funnel names — first_query.attempted (ordinal 1) and
// second_query.attempted (ordinal 2) — then goes silent so a stranger's
// retries past the second don't inflate the signal.

describe("makeDropoffFunnel", () => {
  test("landing fires once, then null", () => {
    const funnel = makeDropoffFunnel();
    expect(funnel.landing("create")).toEqual({ event: LANDING_EVENT, props: { surface: "create" } });
    expect(funnel.landing("create")).toBeNull();
  });

  test("attempt yields ordinals 1 then 2, then null", () => {
    const funnel = makeDropoffFunnel();
    expect(funnel.attempt("create")).toEqual({
      event: ATTEMPT_EVENT,
      props: { surface: "create", ordinal: 1 },
    });
    expect(funnel.attempt("create")).toEqual({
      event: ATTEMPT_EVENT,
      props: { surface: "create", ordinal: 2 },
    });
    expect(funnel.attempt("create")).toBeNull();
  });

  test("landing and attempt guards are independent", () => {
    const funnel = makeDropoffFunnel();
    // A landing does not consume an attempt, and vice-versa.
    expect(funnel.attempt("create")?.props.ordinal).toBe(1);
    expect(funnel.landing("create")?.event).toBe(LANDING_EVENT);
    expect(funnel.attempt("create")?.props.ordinal).toBe(2);
  });

  test("funnels are independent (one mount does not silence another)", () => {
    const a = makeDropoffFunnel();
    const b = makeDropoffFunnel();
    expect(a.landing("create")).not.toBeNull();
    expect(b.landing("create")).not.toBeNull();
  });
});
