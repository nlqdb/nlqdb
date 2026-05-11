// Unit tests for `recordAnonAdoption` — covers the token-format gate,
// idempotent insert, the cross-user `token_taken` reject, the
// `databases.tenant_id` re-keying on adoption (SK-ANON-003), and the
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

type UpdateCall = { sql: string; params: unknown[] };

function stubDb(opts: StubOpts): { db: D1Database; updates: UpdateCall[] } {
  const updates: UpdateCall[] = [];
  // Three prepared-statement shapes flow through this stub: the
  // INSERT … RETURNING (anon_adoptions), the SELECT user_id
  // (idempotent-replay check), and the UPDATE databases that rebinds
  // tenant_id from `anon:<hash>` to the user.
  const prepare = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockImplementation((...params: unknown[]) => ({
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
      run: vi.fn().mockImplementation(async () => {
        if (opts.shouldThrow) throw new Error("d1 down");
        if (sql.startsWith("UPDATE")) {
          updates.push({ sql, params: [...params] });
        }
        return { success: true, meta: {} };
      }),
    })),
  }));
  return { db: { prepare } as unknown as D1Database, updates };
}

describe("recordAnonAdoption", () => {
  it("rejects empty token", async () => {
    const out = await recordAnonAdoption(stubDb({ insertResult: null }).db, "user_1", "");
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects too-short token (< 16 chars)", async () => {
    const out = await recordAnonAdoption(stubDb({ insertResult: null }).db, "user_1", "shortone");
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects too-long token (> 128 chars)", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null }).db,
      "user_1",
      "a".repeat(129),
    );
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects token with disallowed characters", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null }).db,
      "user_1",
      "tok with spaces 1234",
    );
    expect(out).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("accepts a 16-char alphanumeric token (boundary)", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: { ok: 1 } }).db,
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: true, adopted: true });
  });

  it("accepts a UUID-shaped token (36 chars with hyphens)", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: { ok: 1 } }).db,
      "user_1",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(out).toEqual({ ok: true, adopted: true });
  });

  it("returns adopted=false when same user replays an already-adopted token", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, existingUserId: "user_1" }).db,
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: true, adopted: false });
  });

  it("rejects with token_taken when a different user already adopted the token", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, existingUserId: "user_other" }).db,
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: false, reason: "token_taken" });
  });

  it("returns reason='internal' on D1 error", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: null, shouldThrow: true }).db,
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
      stubDb({ insertResult: null, existingUserId: null }).db,
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: false, reason: "internal" });
  });

  it("rebinds databases.tenant_id from anon:<hash> to userId on first adoption", async () => {
    // The UPDATE binds `(userId, anon:<sha256(token)[:16]>)` so the
    // user sees the anon DBs immediately after sign-in. Without this
    // the hero → sign-in → chat path lands on an empty rail because
    // `listDatabasesForTenant(userId)` doesn't match the anon
    // tenant_id the DB was created under.
    const stub = stubDb({ insertResult: { ok: 1 } });
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890");
    expect(out).toEqual({ ok: true, adopted: true });
    expect(stub.updates).toHaveLength(1);
    expect(stub.updates[0]?.sql).toContain("UPDATE databases SET tenant_id");
    const [boundUser, boundAnon] = stub.updates[0]?.params ?? [];
    expect(boundUser).toBe("user_42");
    // sha256("abcdef1234567890")[:16] is deterministic; assert the
    // prefix shape rather than the exact hex so the test isn't
    // recomputing the same crypto the implementation does.
    expect(typeof boundAnon).toBe("string");
    expect(String(boundAnon)).toMatch(/^anon:[0-9a-f]{16}$/);
  });

  it("rebinds databases.tenant_id on idempotent replay (same user)", async () => {
    // Replay path: the row already exists, but we still want to
    // re-run the UPDATE in case the previous adoption committed the
    // anon_adoptions row but lost the databases UPDATE (e.g. a Worker
    // restart between the two writes).
    const stub = stubDb({ insertResult: null, existingUserId: "user_42" });
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890");
    expect(out).toEqual({ ok: true, adopted: false });
    expect(stub.updates).toHaveLength(1);
  });
});
