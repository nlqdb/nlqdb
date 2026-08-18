// SK-ASK-005 — the summarize gate skips prose on opt-out and on empty
// results (the fabrication case), and keeps it for non-empty sets.

import { describe, expect, it } from "vitest";
import { shouldSummarize } from "./summarize-gate.ts";

describe("shouldSummarize", () => {
  it("skips when the caller opted out (Accept: application/json / knowledge DB)", () => {
    expect(shouldSummarize(42, { skipSummary: true })).toBe(false);
    expect(shouldSummarize(0, { skipSummary: true })).toBe(false);
  });

  it("skips an empty result set — narration can only fabricate with no rows", () => {
    expect(shouldSummarize(0, { skipSummary: false })).toBe(false);
  });

  it("summarizes any non-empty result set (small results keep the chat voice)", () => {
    expect(shouldSummarize(1, { skipSummary: false })).toBe(true);
    expect(shouldSummarize(4, { skipSummary: false })).toBe(true);
    expect(shouldSummarize(500, { skipSummary: false })).toBe(true);
  });
});
