import { describe, expect, test } from "bun:test";
import { renderInline } from "./inline-md.ts";

describe("renderInline", () => {
  test("escapes HTML before anything else", () => {
    expect(renderInline('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  test("renders code spans with escaped content", () => {
    expect(renderInline("compare `id <> NULL` here")).toBe(
      "compare <code>id &lt;&gt; NULL</code> here",
    );
  });

  test("asterisks inside code spans never leak into em/strong matching", () => {
    // The `COUNT(*)` single asterisk must not pair with the `*em*` pair.
    expect(renderInline("was `COUNT(*) WHERE x` — the *instrument* broke")).toBe(
      "was <code>COUNT(*) WHERE x</code> — the <em>instrument</em> broke",
    );
  });

  test("renders strong then em without overlap", () => {
    expect(renderInline("**bold** and *italic*")).toBe("<strong>bold</strong> and <em>italic</em>");
  });

  test("documented limit: strong cannot contain a code span (markers stay literal)", () => {
    // Author post bodies so bold never wraps a code span; this pins the
    // failure mode as visible-but-harmless rather than silently broken.
    expect(renderInline("**`NULL` poisons.**")).toBe("**<code>NULL</code> poisons.**");
  });

  test("site-relative links render plain; external links get rel", () => {
    expect(renderInline("[guide](/solve/x/)")).toBe('<a href="/solve/x/">guide</a>');
    expect(renderInline("[Zep](https://www.getzep.com)")).toBe(
      '<a href="https://www.getzep.com" rel="noopener noreferrer">Zep</a>',
    );
  });

  test("a link with any other scheme stays literal text", () => {
    expect(renderInline("[x](javascript:alert)")).toBe("[x](javascript:alert)");
    expect(renderInline("[x](JAVASCRIPT:alert)")).toBe("[x](JAVASCRIPT:alert)");
    expect(renderInline("[x](//evil.example)")).toBe("[x](//evil.example)");
    expect(renderInline("[x](/\\evil.example)")).toBe("[x](/\\evil.example)");
    expect(renderInline('[x](/a"onmouseover=y)')).toBe('<a href="/a&quot;onmouseover=y">x</a>');
  });

  test("only nlqdb.com itself counts as internal", () => {
    expect(renderInline("[x](https://nlqdb.com/solve/)")).toBe(
      '<a href="https://nlqdb.com/solve/">x</a>',
    );
    expect(renderInline("[x](https://nlqdb.com.evil.example/)")).toBe(
      '<a href="https://nlqdb.com.evil.example/" rel="noopener noreferrer">x</a>',
    );
  });
});
