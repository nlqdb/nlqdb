import { describe, expect, it } from "vitest";
import { deriveSlug, displayName } from "./list.ts";

describe("displayName", () => {
  it("strips the db_ prefix and the 6-char suffix, spaces the slug body", () => {
    expect(displayName("db_orders_tracker_a4fxyz")).toBe("orders tracker");
  });

  it("keeps a bare suffix-shaped tail whole rather than stripping to empty", () => {
    expect(displayName("db_a4fxyz")).toBe("a4fxyz");
  });

  it("falls back to underscore-spaced text for ids without the db_ prefix", () => {
    expect(displayName("legacy_no_prefix")).toBe("legacy no prefix");
  });

  it("strips a numeric-only hex tail", () => {
    expect(displayName("db_x_999000")).toBe("x");
  });

  it("returns a single-word body unchanged", () => {
    expect(displayName("db_orders_a1b2c3")).toBe("orders");
  });

  it("leaves a bare slug-only id alone (no suffix to strip)", () => {
    expect(displayName("db_orders")).toBe("orders");
  });
});

describe("deriveSlug", () => {
  it("hyphenates the slug body and keeps the suffix", () => {
    expect(deriveSlug("db_orders_tracker_a4fxyz")).toBe("orders-tracker-a4fxyz");
  });

  it("falls back to the underscore-hyphenated form for non-prefixed ids", () => {
    expect(deriveSlug("legacy_no_prefix")).toBe("legacy-no-prefix");
  });
});
