import { describe, expect, test } from "bun:test";
import { copyKeyFeedback } from "./copy-key-feedback";

describe("copyKeyFeedback", () => {
  test("idle shows the plain CTA and no warning", () => {
    const fb = copyKeyFeedback("idle");
    expect(fb.label).toBe("Copy");
    expect(fb.warning).toBeNull();
  });

  test("copied confirms and shows no warning", () => {
    const fb = copyKeyFeedback("copied");
    expect(fb.label).toBe("Copied");
    expect(fb.warning).toBeNull();
  });

  test("failed surfaces an actionable warning instead of failing silently", () => {
    // The bug: a clipboard rejection was swallowed silently, so a user could
    // click "Done" (discarding the one-time plaintext, SK-APIKEYS-012) while
    // believing they had copied their key — losing it with no way to retrieve
    // it. The failure MUST be visible and tell them to copy manually first.
    const fb = copyKeyFeedback("failed");
    expect(fb.warning).not.toBeNull();
    expect(fb.warning?.toLowerCase()).toContain("manually");
    expect(fb.warning?.toLowerCase()).toContain("before closing");
    // The button invites a retry rather than reading "Copy" as if idle.
    expect(fb.label).toBe("Retry copy");
    expect(fb.ariaLabel.toLowerCase()).toContain("failed");
  });
});
