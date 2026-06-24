import { describe, expect, it } from "bun:test";
import { isValidEmail } from "./email";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("you@example.com")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("x.y+tag@sub.example.co.uk")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isValidEmail("  you@example.com  ")).toBe(true);
    expect(isValidEmail("\tyou@example.com\n")).toBe(true);
  });

  it("rejects empty or whitespace-only input", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
  });

  it("requires a local part, an @, and a dotted domain", () => {
    expect(isValidEmail("noatsign")).toBe(false);
    expect(isValidEmail("@no-local.com")).toBe(false);
    expect(isValidEmail("no-domain@")).toBe(false);
    expect(isValidEmail("no-dot@domain")).toBe(false);
  });

  it("rejects addresses containing internal whitespace", () => {
    expect(isValidEmail("a b@example.com")).toBe(false);
    expect(isValidEmail("a@b c.com")).toBe(false);
  });
});
