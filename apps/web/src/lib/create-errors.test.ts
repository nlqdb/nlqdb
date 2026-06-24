import { describe, expect, it } from "vitest";
import type { CreateError } from "./api";
import { messageFor } from "./create-errors";

// Every CreateError kind must map to a non-empty, actionable sentence that
// never leaks the machine slug. The union is the contract; if a kind is
// added without copy, TS fails the build and this list reminds the author.
const ALL_KINDS: CreateError[] = [
  { kind: "challenge_required" },
  { kind: "rate_limited", retryAfter: null },
  { kind: "auth_required", signInUrl: "/auth/sign-in" },
  { kind: "unauthorized" },
  { kind: "goal_unclear" },
  { kind: "server_error", status: 500 },
];

describe("messageFor", () => {
  it.each(ALL_KINDS)("returns user-facing copy for kind=$kind", (error) => {
    const message = messageFor(error);
    expect(message.length).toBeGreaterThan(0);
    // The raw machine slug must never reach the user.
    expect(message).not.toContain(error.kind);
  });

  it("includes the retry window when rate_limited carries retryAfter", () => {
    expect(messageFor({ kind: "rate_limited", retryAfter: 30 })).toContain("30s");
  });

  it("falls back to a generic wait when rate_limited has no retryAfter", () => {
    const message = messageFor({ kind: "rate_limited", retryAfter: null });
    expect(message).toContain("try again in a moment");
    expect(message).not.toMatch(/\d+s/);
  });
});
