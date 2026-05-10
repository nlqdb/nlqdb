import { describe, expect, test } from "bun:test";
import { prettifyHeader } from "./text.ts";

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
