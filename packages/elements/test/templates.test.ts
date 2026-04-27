import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatValue,
  kvTemplate,
  listTemplate,
  renderTemplate,
  tableTemplate,
} from "../src/templates.ts";

describe("escapeHtml", () => {
  it("escapes the OWASP basics", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });
});

describe("formatValue", () => {
  it("returns empty string for null/undefined", () => {
    expect(formatValue(null)).toBe("");
    expect(formatValue(undefined)).toBe("");
  });

  it("stringifies primitives directly", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue("hello")).toBe("hello");
    expect(formatValue(true)).toBe("true");
  });

  it("JSON-stringifies objects/arrays", () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
    expect(formatValue([1, 2])).toBe("[1,2]");
  });
});

describe("tableTemplate", () => {
  it("renders rows with inferred columns in first-seen order", () => {
    const html = tableTemplate([
      { name: "Maya", drink: "latte" },
      { name: "Jordan", drink: "flat white" },
    ]);
    expect(html).toContain("<table");
    expect(html.indexOf("<th>name</th>")).toBeLessThan(html.indexOf("<th>drink</th>"));
    expect(html).toContain("<td>Maya</td>");
    expect(html).toContain("<td>flat white</td>");
  });

  it("escapes hostile values structurally", () => {
    const html = tableTemplate([{ name: '<img onerror="x">' }]);
    expect(html).not.toContain('<img onerror="x">');
    expect(html).toContain("&lt;img onerror=&quot;x&quot;&gt;");
  });

  it("widens columns across sparse rows", () => {
    const html = tableTemplate([{ a: 1 }, { b: 2 }]);
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<th>b</th>");
  });

  it("returns an empty placeholder for [] / non-array", () => {
    expect(tableTemplate([])).toContain("nlq-empty");
  });
});

describe("listTemplate", () => {
  it("renders the first key as the primary item, rest as <small>", () => {
    const html = listTemplate([{ name: "Maya", role: "Solo Builder" }]);
    expect(html).toContain("<ul");
    expect(html).toContain("<li>Maya<small>role: Solo Builder</small></li>");
  });

  it("escapes hostile values", () => {
    const html = listTemplate([{ name: "<x>" }]);
    expect(html).not.toContain("<x>");
    expect(html).toContain("&lt;x&gt;");
  });

  it("returns an empty placeholder for []", () => {
    expect(listTemplate([])).toContain("nlq-empty");
  });
});

describe("kvTemplate", () => {
  it("renders the FIRST row as a <dl>", () => {
    const html = kvTemplate([
      { name: "Maya", units: "metric" },
      { name: "Jordan", units: "imperial" },
    ]);
    expect(html).toContain("<dl");
    expect(html).toContain("<dt>name</dt><dd>Maya</dd>");
    expect(html).toContain("<dt>units</dt><dd>metric</dd>");
    // Second row is intentionally ignored.
    expect(html).not.toContain("Jordan");
  });

  it("returns an empty placeholder for []", () => {
    expect(kvTemplate([])).toContain("nlq-empty");
  });
});

describe("renderTemplate", () => {
  it("dispatches by name", () => {
    expect(renderTemplate("table", [{ a: 1 }])).toContain("<table");
    expect(renderTemplate("list", [{ a: 1 }])).toContain("<ul");
    expect(renderTemplate("kv", [{ a: 1 }])).toContain("<dl");
  });

  it("falls back to table for unknown names", () => {
    expect(renderTemplate("nope", [{ a: 1 }])).toContain("<table");
  });

  it("treats non-array data as empty", () => {
    expect(renderTemplate("table", "not an array")).toContain("nlq-empty");
    expect(renderTemplate("list", null)).toContain("nlq-empty");
  });
});
