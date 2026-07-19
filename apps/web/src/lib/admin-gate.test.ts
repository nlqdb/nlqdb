// Drift-pin for the presentation-only admin predicate — the same edge
// cases as apps/api/src/admin/gate.test.ts, so the two copies can't
// silently diverge on behavior (SK-GTM-002).

import { describe, expect, test } from "bun:test";
import { isAdminEmail } from "./admin-gate";

describe("isAdminEmail (web copy)", () => {
  test("admits the founder allowlist and any @nlqdb.com address", () => {
    expect(isAdminEmail("omer@salfati.group")).toBe(true);
    expect(isAdminEmail("hi@nlqdb.com")).toBe(true);
    expect(isAdminEmail("  OPS@NLQDB.COM  ")).toBe(true);
  });

  test("rejects strangers, lookalikes, and empty input", () => {
    expect(isAdminEmail("maya@builders.io")).toBe(false);
    expect(isAdminEmail("attacker@nlqdb.com.evil.io")).toBe(false);
    expect(isAdminEmail("other@salfati.group")).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
