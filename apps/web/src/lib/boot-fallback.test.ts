import { describe, expect, test } from "bun:test";
import { isExternalNoise } from "./boot-fallback.ts";

// Regression coverage for SK-WEB-001. Production showed the
// boot-fallback panel painted under the footer of a healthy
// marketing page because `window.error` fired for browser-extension
// throws and the gate was wide open. `isExternalNoise` is the filter
// the inline boot script applies — these tests pin the prefixes so a
// future "tidy up" doesn't reopen the regression.

describe("isExternalNoise", () => {
  test("flags the browser's cross-origin 'Script error.'", () => {
    expect(isExternalNoise({ filename: "" }, "Script error.")).toBe(true);
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

  test("does NOT flag throws with no filename (unhandled rejection shape)", () => {
    expect(isExternalNoise({ filename: "" }, "TypeError: undefined")).toBe(false);
    expect(isExternalNoise(null, "TypeError: undefined")).toBe(false);
    expect(isExternalNoise(undefined, "TypeError: undefined")).toBe(false);
  });

  test("a missing filename does not trigger an extension-prefix match", () => {
    expect(isExternalNoise({}, "real error")).toBe(false);
  });
});
