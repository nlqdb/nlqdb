import { describe, expect, it } from "bun:test";

import { _testing, buildLanes, DEFAULT_FRONTIER_MODEL } from "../src/lanes.ts";

const { buildFreeLane, buildFrontierLane } = _testing;

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
});

describe("buildLanes", () => {
  it("returns only the lanes whose keys are configured", () => {
    expect(buildLanes({}).map((l) => l.lane)).toEqual([]);
    expect(buildLanes({ GROQ_API_KEY: "k" }).map((l) => l.lane)).toEqual(["free"]);
    expect(
      buildLanes({ GROQ_API_KEY: "k", OPENROUTER_FRONTIER_API_KEY: "k" }).map((l) => l.lane),
    ).toEqual(["free", "frontier"]);
  });
});
