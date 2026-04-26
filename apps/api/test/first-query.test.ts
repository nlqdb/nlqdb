// First-query tracker tests with a stub Storage. Asserts the
// notFiredYet / commit split contract used by the orchestrator's
// emit-then-commit pattern.

import { describe, expect, it } from "vitest";
import { type FirstQueryStore, makeFirstQueryTracker } from "../src/ask/first-query.ts";

function makeStore(): FirstQueryStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, value);
    },
  };
}

describe("makeFirstQueryTracker", () => {
  it("notFiredYet returns true for an unknown user, false after commit", async () => {
    const tracker = makeFirstQueryTracker(makeStore());
    expect(await tracker.notFiredYet("u_1")).toBe(true);
    await tracker.commit("u_1");
    expect(await tracker.notFiredYet("u_1")).toBe(false);
  });

  it("commit is idempotent", async () => {
    const tracker = makeFirstQueryTracker(makeStore());
    await tracker.commit("u_1");
    await tracker.commit("u_1");
    expect(await tracker.notFiredYet("u_1")).toBe(false);
  });

  it("isolates flags per userId", async () => {
    const tracker = makeFirstQueryTracker(makeStore());
    await tracker.commit("u_1");
    expect(await tracker.notFiredYet("u_1")).toBe(false);
    expect(await tracker.notFiredYet("u_2")).toBe(true);
  });
});
