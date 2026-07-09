import { describe, expect, test } from "bun:test";
import { CREATE_STARTERS } from "./create-starters.ts";

// The create-form starters are a stranger's one-click first goal on the
// SK-ANON-012 one-shot anon call, so the invariants below guard the two
// ways the list quietly breaks: a duplicate (two chips read the same, one
// wasted slot) and an over-long goal (a chip that wraps or overflows the
// fold instead of reading as a crisp build goal).

describe("create-starters", () => {
  test("is non-empty and short (chips compete for one fold)", () => {
    expect(CREATE_STARTERS.length).toBeGreaterThan(0);
    expect(CREATE_STARTERS.length).toBeLessThanOrEqual(8);
  });

  test("ids are unique", () => {
    const ids = CREATE_STARTERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("goals are unique", () => {
    const goals = CREATE_STARTERS.map((s) => s.goal);
    expect(new Set(goals).size).toBe(goals.length);
  });

  test("each is a self-standing build goal — trimmed, no trailing punctuation", () => {
    for (const s of CREATE_STARTERS) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.goal).toBe(s.goal.trim());
      expect(s.goal.length).toBeGreaterThanOrEqual(6);
      expect(s.goal.length).toBeLessThanOrEqual(48);
      expect(s.goal).not.toMatch(/[.?!]$/);
    }
  });
});
