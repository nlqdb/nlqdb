import { describe, expect, test } from "bun:test";
import { formatCell, prettifyHeader } from "./text.ts";

describe("prettifyHeader", () => {
  test("snake_case → sentence case", () => {
    expect(prettifyHeader("customer_id")).toBe("Customer id");
  });

  test("preserves leading numerics on the capitalized first token", () => {
    expect(prettifyHeader("v2_orders")).toBe("V2 orders");
  });

  test("kebab-case → sentence case", () => {
    expect(prettifyHeader("order-items")).toBe("Order items");
  });

  test("idempotent on already-pretty mixed-case input", () => {
    expect(prettifyHeader("Already Title")).toBe("Already Title");
  });

  test("preserves acronym casing on already-pretty input", () => {
    expect(prettifyHeader("Customer ID")).toBe("Customer ID");
  });

  test("collapses repeated separators and trims edges", () => {
    expect(prettifyHeader("__order__items")).toBe("Order items");
  });

  test("returns the raw identifier when the result would be empty", () => {
    expect(prettifyHeader("___")).toBe("___");
  });
});

describe("formatCell", () => {
  test("null and undefined render as an em-dash placeholder", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell(undefined)).toBe("—");
  });

  test("strings render verbatim (no JSON quoting)", () => {
    expect(formatCell("Ada Lovelace")).toBe("Ada Lovelace");
  });

  test("numbers and booleans stringify without quotes", () => {
    expect(formatCell(42)).toBe("42");
    expect(formatCell(0)).toBe("0");
    expect(formatCell(true)).toBe("true");
    expect(formatCell(false)).toBe("false");
  });

  // The bug this shared helper fixes: the create-path SampleTable used to
  // `String(value)` a JSON/JSONB column and render `[object Object]` at a
  // stranger's first "did it work?" moment (SK-HDC-001). JSON columns are
  // real on connected/created DBs — the object must round-trip to JSON.
  test("object cells serialize to JSON, never [object Object]", () => {
    expect(formatCell({ city: "Berlin", zip: "10115" })).toBe('{"city":"Berlin","zip":"10115"}');
    expect(formatCell({ city: "Berlin" })).not.toBe("[object Object]");
  });

  test("array cells serialize to JSON (consistent across both surfaces)", () => {
    expect(formatCell([1, 2, 3])).toBe("[1,2,3]");
    expect(formatCell(["a", "b"])).toBe('["a","b"]');
  });
});
