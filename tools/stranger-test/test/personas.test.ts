import { describe, expect, test } from "bun:test";
import { percentile } from "../src/browser.ts";
import { FLOW_PERSONA, PERSONA_PROMPTS } from "../src/personas.ts";

// The seeded prompts double as the §1.1 "what shape of stranger
// lands" surface; drift here changes what we're measuring, not just
// how. Counts pinned to the plan's §1.1 paragraph.
describe("personas", () => {
  test("each persona has the planned prompt count", () => {
    expect(PERSONA_PROMPTS.P1.length).toBeGreaterThanOrEqual(10);
    expect(PERSONA_PROMPTS.P2.length).toBeGreaterThanOrEqual(8);
    expect(PERSONA_PROMPTS.P3.length).toBeGreaterThanOrEqual(4);
    expect(PERSONA_PROMPTS.P6.length).toBeGreaterThanOrEqual(3);
  });

  test("every prompt is a non-empty, non-secret-looking string", () => {
    for (const list of Object.values(PERSONA_PROMPTS)) {
      for (const p of list) {
        expect(p.length).toBeGreaterThan(5);
        expect(p).not.toMatch(/sk_|sk-|pk_|api[_-]?key|secret/i);
      }
    }
  });

  test("FLOW_PERSONA maps every shipped flow", () => {
    expect(FLOW_PERSONA["flow-001"]).toBe("P1");
    expect(FLOW_PERSONA["flow-002"]).toBe("P3");
    expect(FLOW_PERSONA["flow-003"]).toBe("P3");
  });
});

describe("percentile", () => {
  test("returns null for an empty input (the no-passing-run case)", () => {
    expect(percentile([], 50)).toBeNull();
  });

  test("p50 of 5 evenly-spaced samples is the middle one", () => {
    expect(percentile([100, 200, 300, 400, 500], 50)).toBe(300);
  });

  test("p95 of 20 samples lies at the top of the distribution", () => {
    const xs = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    expect(percentile(xs, 95)).toBe(2000);
  });

  test("does not mutate the caller's array", () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
});
