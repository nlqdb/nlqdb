import { describe, expect, test } from "bun:test";

// SK-WEB-005 — the chat Data block renders at most MAX_ROWS; the "+N more
// rows" footer must count rows beyond what is *rendered*, not beyond the
// returned array. The regression this guards: `/v1/ask` returns the full
// result uncapped with `rowCount === rows.length`, so the old
// `rowCount > rows.length` test was always false and rows 51+ vanished with
// no indicator.

import { hiddenRowCount, MAX_ROWS, showsEmptyNotice } from "./data-rows.ts";

describe("hiddenRowCount", () => {
  test("a complete uncapped result over the cap still reports the hidden tail (the regression)", () => {
    // 80 rows returned, rowCount echoes the same total — the real /v1/ask shape.
    expect(hiddenRowCount(80, 80)).toBe(80 - MAX_ROWS); // 30
  });

  test("no footer when everything rendered fits under the cap", () => {
    expect(hiddenRowCount(50, 50)).toBe(0);
    expect(hiddenRowCount(12, 12)).toBe(0);
    expect(hiddenRowCount(1, 1)).toBe(0);
  });

  test("null rowCount falls back to the returned length", () => {
    expect(hiddenRowCount(80, null)).toBe(30);
    expect(hiddenRowCount(20, null)).toBe(0);
  });

  test("a server total larger than the returned page counts against the rendered cap", () => {
    // 100 returned, 500 true total → 500 − 50 rendered.
    expect(hiddenRowCount(100, 500)).toBe(450);
  });

  test("an inconsistent low rowCount never masks real dropped rows", () => {
    // 80 rows in hand but rowCount claims 40 — still show the 30 we dropped.
    expect(hiddenRowCount(80, 40)).toBe(30);
  });

  test("never negative", () => {
    expect(hiddenRowCount(0, 0)).toBe(0);
    expect(hiddenRowCount(3, 0)).toBe(0);
  });
});

// SK-ASK-028 — the founder-reported moment: approve an insert, then read
// "No rows returned." A committed write returns no rows but a non-zero
// AFFECTED-row count, so the empty-read notice would deny a write that
// happened.
describe("showsEmptyNotice", () => {
  test("a committed write (no rows, rows affected) suppresses the empty notice", () => {
    expect(showsEmptyNotice(0, 1)).toBe(false);
    expect(showsEmptyNotice(0, 42)).toBe(false);
  });

  test("a genuinely empty read still says so", () => {
    expect(showsEmptyNotice(0, 0)).toBe(true);
    expect(showsEmptyNotice(0, null)).toBe(true);
  });

  test("rows present ⇒ never the notice", () => {
    expect(showsEmptyNotice(3, 3)).toBe(false);
  });
});
