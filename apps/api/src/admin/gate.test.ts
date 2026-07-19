// SK-GTM-002 — the admin predicate is the whole authorization story
// for admin surfaces, so its edges are pinned here: exact allowlist,
// domain match, case/whitespace normalization, and the lookalike
// domains that must NOT pass.

import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./gate.ts";

describe("isAdminEmail", () => {
  it("admits the founder allowlist and any @nlqdb.com address", () => {
    expect(isAdminEmail("omer@salfati.group")).toBe(true);
    expect(isAdminEmail("hi@nlqdb.com")).toBe(true);
    expect(isAdminEmail("future-teammate@nlqdb.com")).toBe(true);
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(isAdminEmail("Omer@Salfati.Group")).toBe(true);
    expect(isAdminEmail("  OPS@NLQDB.COM  ")).toBe(true);
  });

  it("rejects strangers, lookalike domains, and non-domain matches", () => {
    expect(isAdminEmail("maya@builders.io")).toBe(false);
    expect(isAdminEmail("attacker@nlqdb.com.evil.io")).toBe(false);
    expect(isAdminEmail("attacker@evilnlqdb.com")).toBe(false);
    expect(isAdminEmail("nlqdb.com")).toBe(false);
    expect(isAdminEmail("other@salfati.group")).toBe(false);
  });

  it("rejects empty / null / undefined", () => {
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
