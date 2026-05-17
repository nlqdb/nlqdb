import { describe, expect, it } from "vitest";
import { appendFormContext } from "../src/action-goal.ts";

describe("appendFormContext", () => {
  it("returns the bare goal when no entries are given", () => {
    expect(appendFormContext("add an order from this form", [])).toBe(
      "add an order from this form",
    );
  });

  it("trims surrounding whitespace on the goal", () => {
    expect(appendFormContext("  hello  ", [])).toBe("hello");
  });

  it("appends entries as a markdown-list suffix", () => {
    const out = appendFormContext("add an order from this form", [
      ["customer", "alice"],
      ["drink", "latte"],
      ["total", "5.50"],
    ]);
    expect(out).toBe(
      [
        "add an order from this form",
        "",
        "Form data:",
        "- customer: alice",
        "- drink: latte",
        "- total: 5.50",
      ].join("\n"),
    );
  });

  it("skips entries with whitespace-only keys", () => {
    const out = appendFormContext("g", [
      ["", "ignored"],
      ["   ", "also-ignored"],
      ["k", "v"],
    ]);
    expect(out).toBe("g\n\nForm data:\n- k: v");
  });

  it("preserves the value verbatim, including special characters", () => {
    const out = appendFormContext("g", [["note", "line1\nline2 <script>"]]);
    expect(out).toBe("g\n\nForm data:\n- note: line1\nline2 <script>");
  });

  it("when goal is empty but entries exist, only the form-data block is returned", () => {
    expect(appendFormContext("", [["k", "v"]])).toBe("Form data:\n- k: v");
  });

  it("does not deduplicate repeated keys — order is preserved", () => {
    // FormData allows multiple values per name (multi-select inputs);
    // we preserve all of them so the planner sees the full set.
    const out = appendFormContext("g", [
      ["tag", "a"],
      ["tag", "b"],
    ]);
    expect(out).toBe("g\n\nForm data:\n- tag: a\n- tag: b");
  });
});
