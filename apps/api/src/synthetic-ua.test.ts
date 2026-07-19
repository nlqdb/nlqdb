import { describe, expect, it } from "vitest";
import { isSyntheticRequest, isSyntheticUserAgent, SYNTHETIC_UA_TOKEN } from "./synthetic-ua.ts";

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

describe("isSyntheticRequest (SK-GTM-005)", () => {
  const browserUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

  it("true for the walker UA regardless of environment", () => {
    expect(isSyntheticRequest("nlqdb-stranger-test/1.0", {})).toBe(true);
  });

  it("true on preview/mock deployments even for a real browser UA", () => {
    expect(isSyntheticRequest(browserUa, { NODE_ENV: "preview" })).toBe(true);
    expect(isSyntheticRequest(browserUa, { MOCK_IDP: "1" })).toBe(true);
  });

  it("false for a real browser on production — a stranger must never be tagged", () => {
    expect(isSyntheticRequest(browserUa, { NODE_ENV: "production" })).toBe(false);
    expect(isSyntheticRequest(browserUa, {})).toBe(false);
    expect(isSyntheticRequest(null, {})).toBe(false);
  });
});
