// Unit tests for `recordAnonAdoption` — covers the token-format gate,
// idempotent insert, the cross-user `token_taken` reject, and the
// D1-failure path. Pure-function shape makes Miniflare unnecessary.

import { describe, expect, it, vi } from "vitest";
import { recordAnonAdoption } from "../src/anon-adopt.ts";

type StubOpts = {
  // Result of the INSERT … RETURNING. `null` = ON CONFLICT DO NOTHING
  // hit, `{ ok: 1 }` = a fresh row was written.
  insertResult: { ok: number } | null;
  // Result of the post-conflict SELECT user_id. Only consulted when
  // the insert returned null. Absent means "no existing row" (race).
  existingUserId?: string | null;
  shouldThrow?: boolean;
};

function stubDb(opts: StubOpts): D1Database {
  // Two prepared-statement shapes flow through this stub: the INSERT …
  // RETURNING and the SELECT user_id. Distinguish by the SQL prefix so
  // each call gets the right canned result.
  const prepare = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockReturnValue({
      first: vi.fn().mockImplementation(async () => {
        if (opts.shouldThrow) throw new Error("d1 down");
        if (sql.startsWith("INSERT")) return opts.insertResult;
        if (sql.startsWith("SELECT")) {
          return opts.existingUserId === undefined || opts.existingUserId === null
            ? null
            : { user_id: opts.existingUserId };
        }
        return null;
      }),
    }),
  }));
  return { prepare } as unknown as D1Database;
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

  it("returns adopted=false when same user replays an already-adopted token", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, existingUserId: "user_1" }),
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: true, adopted: false });
  });

  it("rejects with token_taken when a different user already adopted the token", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, existingUserId: "user_other" }),
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: false, reason: "token_taken" });
  });

  it("returns reason='internal' on D1 error", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, shouldThrow: true }),
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: false, reason: "internal" });
  });

  it("returns reason='internal' if the post-conflict SELECT loses the row", async () => {
    // Race: INSERT failed (conflict), SELECT returns null (e.g. CASCADE
    // delete won the race). Conservative: report internal so the client
    // can retry rather than silently noop.
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, existingUserId: null }),
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: false, reason: "internal" });
  });
});
