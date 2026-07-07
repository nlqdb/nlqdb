import { describe, expect, it } from "vitest";
import { isSyntheticUserAgent, SYNTHETIC_UA_TOKEN } from "./synthetic-ua.ts";

describe("isSyntheticUserAgent", () => {
  it("matches the stranger-test walker UA (flows 001–003)", () => {
    expect(
      isSyntheticUserAgent(
        "nlqdb-stranger-test/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)",
      ),
    ).toBe(true);
  });

  it("matches version-independently (a walker version bump can't re-pollute)", () => {
    expect(isSyntheticUserAgent("nlqdb-stranger-test/2.7")).toBe(true);
    expect(isSyntheticUserAgent("NLQDB-Stranger-Test/1.0")).toBe(true);
  });

  it("does not match a real browser UA", () => {
    expect(
      isSyntheticUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"),
    ).toBe(false);
  });

  it("treats a missing UA as non-synthetic (genuine strangers still count)", () => {
    expect(isSyntheticUserAgent(null)).toBe(false);
    expect(isSyntheticUserAgent(undefined)).toBe(false);
    expect(isSyntheticUserAgent("")).toBe(false);
  });

  it("exports the stable token used at the write site", () => {
    expect(SYNTHETIC_UA_TOKEN).toBe("nlqdb-stranger-test");
  });
});
