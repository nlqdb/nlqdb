// Pure decision-logic tests for the GLOBAL-027 gate. No IO, no
// fixtures — every input is a hand-crafted `EvalBaseline` so the
// suite covers the truth table explicitly.

import { describe, expect, it } from "vitest";
import { gateState } from "../src/gate/check.ts";

const TARGETS = { bird_target: 0.65, spider_target: 0.75, measured_at: "2026-05-18T00:00:00Z" };

describe("gateState — both lanes ANDed (SK-GATE-002)", () => {
  it("closed when both lanes are below target", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: 0.318, spider_accuracy: 0.5 });
    expect(state.kind).toBe("closed");
    expect(state.bird.status).toBe("below");
    expect(state.spider.status).toBe("below");
  });

  it("closed when BIRD meets but Spider is below", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: 0.65, spider_accuracy: 0.74 });
    expect(state.kind).toBe("closed");
    expect(state.bird.status).toBe("met");
    expect(state.spider.status).toBe("below");
  });

  it("closed when Spider meets but BIRD is below", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: 0.64, spider_accuracy: 0.75 });
    expect(state.kind).toBe("closed");
    expect(state.bird.status).toBe("below");
    expect(state.spider.status).toBe("met");
  });

  it("open ONLY when both lanes meet their target", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: 0.65, spider_accuracy: 0.75 });
    expect(state.kind).toBe("open");
    expect(state.bird.status).toBe("met");
    expect(state.spider.status).toBe("met");
  });

  it("open holds when both lanes exceed targets", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: 0.9, spider_accuracy: 0.95 });
    expect(state.kind).toBe("open");
  });
});

describe("gateState — null lane is structurally closed", () => {
  it("null Spider keeps the gate closed even with a met BIRD", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: 0.95, spider_accuracy: null });
    expect(state.kind).toBe("closed");
    expect(state.spider.status).toBe("unmeasured");
    expect(state.spider.accuracy).toBeNull();
  });

  it("null BIRD keeps the gate closed even with a met Spider", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: null, spider_accuracy: 0.9 });
    expect(state.kind).toBe("closed");
    expect(state.bird.status).toBe("unmeasured");
  });

  it("both null is the trivially-closed boot state", () => {
    const state = gateState({ ...TARGETS, bird_accuracy: null, spider_accuracy: null });
    expect(state.kind).toBe("closed");
    expect(state.bird.status).toBe("unmeasured");
    expect(state.spider.status).toBe("unmeasured");
  });
});

describe("gateState — closed branch carries enough state to render the UI", () => {
  it("carries targets, accuracies, and measured_at unchanged", () => {
    const baseline = { ...TARGETS, bird_accuracy: 0.42, spider_accuracy: 0.6 };
    const state = gateState(baseline);
    expect(state.bird.target).toBe(0.65);
    expect(state.spider.target).toBe(0.75);
    expect(state.bird.accuracy).toBe(0.42);
    expect(state.spider.accuracy).toBe(0.6);
    expect(state.measured_at).toBe(TARGETS.measured_at);
  });
});
