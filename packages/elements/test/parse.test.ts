import { describe, expect, it } from "vitest";
import { parseRefresh } from "../src/parse.ts";

describe("parseRefresh", () => {
  it("parses seconds", () => {
    expect(parseRefresh("60s")).toBe(60_000);
    expect(parseRefresh("5s")).toBe(5_000);
  });

  it("parses minutes", () => {
    expect(parseRefresh("5m")).toBe(300_000);
  });

  it("parses milliseconds explicitly", () => {
    expect(parseRefresh("500ms")).toBe(500);
  });

  it("treats a bare integer as milliseconds", () => {
    expect(parseRefresh("250")).toBe(250);
  });

  it("tolerates whitespace", () => {
    expect(parseRefresh("  60s  ")).toBe(60_000);
  });

  it("returns null for null/empty", () => {
    expect(parseRefresh(null)).toBeNull();
    expect(parseRefresh("")).toBeNull();
  });

  it("returns null for malformed values", () => {
    expect(parseRefresh("60h")).toBeNull();
    expect(parseRefresh("abc")).toBeNull();
    expect(parseRefresh("-30s")).toBeNull();
    expect(parseRefresh("1.5s")).toBeNull();
  });
});
