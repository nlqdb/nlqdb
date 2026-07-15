import { describe, expect, test } from "bun:test";
import { copySnippetLabel } from "./copy-snippet-label";

describe("copySnippetLabel", () => {
  test("idle shows the CTA", () => {
    expect(copySnippetLabel("idle")).toBe("Copy snippet");
  });

  test("copied confirms", () => {
    expect(copySnippetLabel("copied")).toBe("Copied");
  });

  test("no-key is the ONLY failure that advises signing in (SK-WEB-007)", () => {
    // A device/DB with no resolvable pk_live_ is the one case where sign-in
    // helps — a permanent key is minted on sign-in.
    expect(copySnippetLabel("no-key")).toBe("Couldn't copy — sign in to load your key.");
  });

  test("copy-failed does NOT tell a keyed user to sign in — it names the clipboard", () => {
    // The bug: a clipboard write that threw despite a valid key rendered the
    // "sign in to load your key" message, misdiagnosing a browser
    // permission/focus error as an auth wall (SK-WEB-007 forbids a sign-in
    // wall on Copy snippet).
    const label = copySnippetLabel("copy-failed");
    expect(label).toBe("Couldn't copy to clipboard — try again.");
    expect(label.toLowerCase()).not.toContain("sign in");
  });
});
