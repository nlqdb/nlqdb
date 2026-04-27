import { describe, expect, it } from "vitest";
import { demoDataFor, demoFixtureKeys } from "../src/demo-data.ts";

describe("demoDataFor", () => {
  it("returns the fixture rows for a known key", () => {
    const rows = demoDataFor("orders");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("customer");
  });

  it("returns an empty array for unknown keys", () => {
    expect(demoDataFor("does-not-exist")).toEqual([]);
  });
});

describe("demoFixtureKeys", () => {
  it("lists every registered fixture", () => {
    const keys = demoFixtureKeys();
    expect(keys).toContain("orders");
    expect(keys).toContain("signups");
    expect(keys).toContain("preferences");
  });
});
