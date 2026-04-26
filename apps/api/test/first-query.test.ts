// First-query tracker tests with a stub Storage. Asserts the
// "fire once per user" contract.

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
  it("returns true on the first call for a user, false thereafter", async () => {
    const tracker = makeFirstQueryTracker(makeStore());
    expect(await tracker.markIfFirst("u_1")).toBe(true);
    expect(await tracker.markIfFirst("u_1")).toBe(false);
    expect(await tracker.markIfFirst("u_1")).toBe(false);
  });

  it("isolates flags per userId", async () => {
    const tracker = makeFirstQueryTracker(makeStore());
    expect(await tracker.markIfFirst("u_1")).toBe(true);
    expect(await tracker.markIfFirst("u_2")).toBe(true);
    expect(await tracker.markIfFirst("u_1")).toBe(false);
  });
});
