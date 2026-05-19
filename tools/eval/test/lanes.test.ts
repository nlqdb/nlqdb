import { describe, expect, it } from "bun:test";

import { _testing, buildLanes, DEFAULT_FRONTIER_MODEL } from "../src/lanes.ts";

const { buildFreeLane, buildFrontierLane, buildAgenticFrontierLane, AGENTIC_MAX_ATTEMPTS } =
  _testing;

describe("buildFreeLane", () => {
  it("returns null when no free-tier provider key is set", () => {
    expect(buildFreeLane({})).toBeNull();
  });

  it("returns a router when at least one free-tier key is set", () => {
    const lane = buildFreeLane({ GEMINI_API_KEY: "k" });
    expect(lane).not.toBeNull();
    expect(lane?.lane).toBe("free");
    expect(lane?.modelHint).toBe("free-chain");
  });

  it("SK-QUAL-009: free lane carries the production retry budget so scaffolding parity holds", () => {
    const lane = buildFreeLane({ GEMINI_API_KEY: "k" });
    expect(lane?.maxAttempts).toBe(AGENTIC_MAX_ATTEMPTS);
  });
});

describe("buildFrontierLane", () => {
  it("returns null without OPENROUTER_FRONTIER_API_KEY", () => {
    expect(buildFrontierLane({})).toBeNull();
  });

  it("uses the default frontier model when none is provided", () => {
    const lane = buildFrontierLane({ OPENROUTER_FRONTIER_API_KEY: "k" });
    expect(lane?.modelHint).toBe(DEFAULT_FRONTIER_MODEL);
  });

  it("honors FRONTIER_MODEL override", () => {
    const lane = buildFrontierLane({
      OPENROUTER_FRONTIER_API_KEY: "k",
      FRONTIER_MODEL: "anthropic/claude-opus-4.7",
    });
    expect(lane?.modelHint).toBe("anthropic/claude-opus-4.7");
  });

  it("SK-QUAL-004: single-model frontier lane is unscaffolded (maxAttempts=1) so the ablation reference holds", () => {
    const lane = buildFrontierLane({ OPENROUTER_FRONTIER_API_KEY: "k" });
    expect(lane?.maxAttempts).toBe(1);
  });
});

describe("buildAgenticFrontierLane", () => {
  it("returns null without OPENROUTER_FRONTIER_API_KEY", () => {
    expect(buildAgenticFrontierLane({ RUN_AGENTIC_FRONTIER: "1" })).toBeNull();
  });

  it("returns null without the RUN_AGENTIC_FRONTIER opt-in (default off keeps free-only runs cheap)", () => {
    expect(buildAgenticFrontierLane({ OPENROUTER_FRONTIER_API_KEY: "k" })).toBeNull();
  });

  it("returns null when the opt-in is set to a falsy string (avoids accidental engagement)", () => {
    expect(
      buildAgenticFrontierLane({ OPENROUTER_FRONTIER_API_KEY: "k", RUN_AGENTIC_FRONTIER: "no" }),
    ).toBeNull();
    expect(
      buildAgenticFrontierLane({ OPENROUTER_FRONTIER_API_KEY: "k", RUN_AGENTIC_FRONTIER: "0" }),
    ).toBeNull();
  });

  it("builds the lane when both the frontier key and the opt-in are set", () => {
    const lane = buildAgenticFrontierLane({
      OPENROUTER_FRONTIER_API_KEY: "k",
      RUN_AGENTIC_FRONTIER: "1",
    });
    expect(lane?.lane).toBe("agentic-frontier");
    expect(lane?.modelHint).toBe(DEFAULT_FRONTIER_MODEL);
    // The whole point of slice 3c is exec-retry — guard the budget.
    expect(lane?.maxAttempts).toBe(AGENTIC_MAX_ATTEMPTS);
  });

  it("accepts the common truthy variants without falling back to silent off", () => {
    for (const v of ["1", "true", "yes", "TRUE", "Yes"]) {
      const lane = buildAgenticFrontierLane({
        OPENROUTER_FRONTIER_API_KEY: "k",
        RUN_AGENTIC_FRONTIER: v,
      });
      expect(lane?.lane).toBe("agentic-frontier");
    }
  });

  it("inherits the frontier model override so both frontier lanes stay model-aligned", () => {
    const lane = buildAgenticFrontierLane({
      OPENROUTER_FRONTIER_API_KEY: "k",
      RUN_AGENTIC_FRONTIER: "1",
      FRONTIER_MODEL: "anthropic/claude-opus-4.7",
    });
    expect(lane?.modelHint).toBe("anthropic/claude-opus-4.7");
  });
});

describe("buildLanes", () => {
  it("returns only the lanes whose keys are configured", () => {
    expect(buildLanes({}).map((l) => l.lane)).toEqual([]);
    expect(buildLanes({ GROQ_API_KEY: "k" }).map((l) => l.lane)).toEqual(["free"]);
    expect(
      buildLanes({ GROQ_API_KEY: "k", OPENROUTER_FRONTIER_API_KEY: "k" }).map((l) => l.lane),
    ).toEqual(["free", "frontier"]);
  });

  it("SK-QUAL-009: emits all three lanes when the agentic opt-in is on", () => {
    expect(
      buildLanes({
        GROQ_API_KEY: "k",
        OPENROUTER_FRONTIER_API_KEY: "k",
        RUN_AGENTIC_FRONTIER: "1",
      }).map((l) => l.lane),
    ).toEqual(["free", "frontier", "agentic-frontier"]);
  });
});
