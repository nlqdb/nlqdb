// Unit tests for `recordAnonAdoption` — covers the token-format gate,
// idempotent insert, and the D1-failure path. Pure-function shape
// makes Miniflare unnecessary.

import { describe, expect, it, vi } from "vitest";
import { recordAnonAdoption } from "../src/anon-adopt.ts";

function stubDb(opts: { insertResult: { ok: number } | null; shouldThrow?: boolean }): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => {
          if (opts.shouldThrow) throw new Error("d1 down");
          return opts.insertResult;
        }),
      }),
    }),
  } as unknown as D1Database;
}

describe("recordAnonAdoption", () => {
  it("rejects empty token", async () => {
    const out = await recordAnonAdoption(stubDb({ insertResult: null }), "user_1", "");
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects too-short token (< 16 chars)", async () => {
    const out = await recordAnonAdoption(stubDb({ insertResult: null }), "user_1", "shortone");
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects too-long token (> 128 chars)", async () => {
    const out = await recordAnonAdoption(stubDb({ insertResult: null }), "user_1", "a".repeat(129));
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects token with disallowed characters", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null }),
      "user_1",
      "tok with spaces 1234",
    );
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("accepts a 16-char alphanumeric token (boundary)", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: { ok: 1 } }),
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: true, adopted: true });
  });

  it("accepts a UUID-shaped token (36 chars with hyphens)", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: { ok: 1 } }),
      "user_1",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(out).toEqual({ ok: true, adopted: true });
  });

  it("returns adopted=false on duplicate insert", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null }),
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: true, adopted: false });
  });

  it("returns reason='internal' on D1 error", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, shouldThrow: true }),
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: false, reason: "internal" });
  });
});
