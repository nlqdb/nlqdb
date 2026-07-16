import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { EXTENSION_PREFIXES, isExternalNoise } from "./boot-fallback.ts";

// Regression coverage for SK-WEB-001 — pin the prefixes so a future tidy-up doesn't reopen the production bug where extension throws painted the boot-fallback on healthy pages.

describe("isExternalNoise", () => {
  test("flags the browser's cross-origin 'Script error.'", () => {
    expect(isExternalNoise({ filename: "" }, "Script error.")).toBe(true);
  });

  test("flags Chromium browser-chrome throws (chrome://newtab etc.)", () => {
    expect(isExternalNoise({ filename: "chrome://newtab/script.js" }, "x is not defined")).toBe(
      true,
    );
  });

  test("flags Chrome / Edge / Brave extension throws", () => {
    expect(
      isExternalNoise({ filename: "chrome-extension://abcdef/content.js" }, "x is not defined"),
    ).toBe(true);
  });

  test("flags Firefox extension throws", () => {
    expect(
      isExternalNoise({ filename: "moz-extension://abcdef/content.js" }, "x is not defined"),
    ).toBe(true);
  });

  test("flags Safari extension throws (both schemes)", () => {
    expect(isExternalNoise({ filename: "safari-web-extension://abc/content.js" }, "x")).toBe(true);
    expect(isExternalNoise({ filename: "safari-extension://abc/content.js" }, "x")).toBe(true);
  });

  test("flags Safari's webkit-masked-url scheme", () => {
    expect(isExternalNoise({ filename: "webkit-masked-url://hidden/" }, "x")).toBe(true);
    expect(isExternalNoise({ filename: "https://embed.tawk.to/widget.js" }, "x")).toBe(true);
    expect(isExternalNoise({ filename: "https://va.tawk.to/v1/x" }, "x")).toBe(true);
  });

  test("does NOT flag throws from our own bundles", () => {
    expect(
      isExternalNoise(
        { filename: "https://app.nlqdb.com/_astro/chat.D34D.js" },
        "Cannot read properties of undefined (reading 'sql')",
      ),
    ).toBe(false);
  });

  test("does NOT flag events with no filename (covers PromiseRejectionEvent too)", () => {
    expect(isExternalNoise({ filename: "" }, "TypeError: undefined")).toBe(false);
    expect(isExternalNoise({}, "TypeError: undefined")).toBe(false);
    expect(isExternalNoise(null, "TypeError: undefined")).toBe(false);
    expect(isExternalNoise(undefined, "TypeError: undefined")).toBe(false);
  });

  test("a same-origin URL never matches an extension prefix by accident", () => {
    expect(
      isExternalNoise({ filename: "https://nlqdb.com/path?chrome-extension://x" }, "real error"),
    ).toBe(false);
  });
});

// `is:inline` can't import — Base.astro carries a hand-copy of the prefix list; this guards drift at CI time.
test("Base.astro inline copy of EXTENSION_PREFIXES stays in sync", () => {
  const baseAstro = readFileSync(new URL("../layouts/Base.astro", import.meta.url), "utf-8");
  for (const prefix of EXTENSION_PREFIXES) {
    expect(baseAstro).toContain(`"${prefix}"`);
  }
});

// Primary guard: `[hidden]{display:none!important}` in global.css beats any author display rule.
test("global.css includes the [hidden] display-none reset", () => {
  const css = readFileSync(new URL("../styles/global.css", import.meta.url), "utf-8");
  expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/s);
});

// Defense-in-depth: boot-fallback selectors also gated so no display rule leaks when hidden.
test("every #boot-fallback CSS selector is gated on the hidden attribute", () => {
  const css = readFileSync(new URL("../styles/global.css", import.meta.url), "utf-8");
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = stripped.match(/#boot-fallback(?![-\w])[^\s,{]*/g) ?? [];
  expect(selectors.length).toBeGreaterThan(0);
  for (const selector of selectors) {
    expect(selector).toMatch(/^#boot-fallback(:not\(\[hidden\]\)|\[hidden\])$/);
  }
});
