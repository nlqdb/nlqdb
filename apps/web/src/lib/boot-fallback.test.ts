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
