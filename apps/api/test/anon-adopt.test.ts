// Unit tests for `recordAnonAdoption` — covers the token-format gate,
// idempotent insert, the cross-user `token_taken` reject, the
// `databases.tenant_id` re-keying on adoption (SK-ANON-003), the
// SK-ANON-014 dbId capture/return, and the D1-failure path. Pure-
// function shape makes Miniflare unnecessary.

import { describe, expect, it, vi } from "vitest";
import { buildRetargetStatements, recordAnonAdoption } from "../src/anon-adopt.ts";

type MigratedRow = { id: string; engine: string; connection_blob: string | null };

type StubOpts = {
  // Result of the INSERT anon_adoptions … RETURNING. `null` = ON
  // CONFLICT DO NOTHING hit (replay), `{ ok: 1 }` = a fresh row was
  // written (first adoption).
  insertResult: { ok: number } | null;
  // Result of the post-conflict SELECT user_id, database_id. Only
  // consulted when the insert returned null. Absent means "no
  // existing row" (race).
  existingUserId?: string | null;
  // SK-ANON-014 — dbId stored on a prior adoption's anon_adoptions row.
  // Returned alongside `existingUserId` on the replay-path SELECT.
  existingDbId?: string | null;
  // SK-ANON-014 — dbId returned by `UPDATE databases ... RETURNING id`.
  // Absent means the UPDATE matched zero rows (the typical replay path
  // after a prior adoption already migrated the row).
  migratedDbId?: string | null;
  // Full RETURNING rows for the migrate UPDATE when a test needs to
  // control engine / connection_blob (ACL-retarget gating). Defaults
  // to one hosted-postgres row derived from `migratedDbId`.
  migratedRows?: MigratedRow[];
  shouldThrow?: boolean;
};

type UpdateCall = { sql: string; params: unknown[] };

function stubDb(opts: StubOpts): { db: D1Database; updates: UpdateCall[] } {
  const updates: UpdateCall[] = [];
  // Prepared-statement shapes flowing through this stub: the INSERT …
  // RETURNING (anon_adoptions), the SELECT user_id+database_id (replay
  // check), the UPDATE databases … RETURNING id (migrate + capture
  // dbId, SK-ANON-014), and two run-only UPDATEs (api_keys, and the
  // anon_adoptions back-fill that stores the migrated dbId).
  const prepare = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockImplementation((...params: unknown[]) => ({
      first: vi.fn().mockImplementation(async () => {
        if (opts.shouldThrow) throw new Error("d1 down");
        if (sql.startsWith("INSERT")) return opts.insertResult;
        if (sql.startsWith("SELECT")) {
          if (opts.existingUserId === undefined || opts.existingUserId === null) return null;
          return {
            user_id: opts.existingUserId,
            database_id: opts.existingDbId ?? null,
          };
        }
        if (sql.startsWith("UPDATE databases")) {
          updates.push({ sql, params: [...params] });
          return opts.migratedDbId ? { id: opts.migratedDbId } : null;
        }
        return null;
      }),
      all: vi.fn().mockImplementation(async () => {
        if (opts.shouldThrow) throw new Error("d1 down");
        if (sql.startsWith("UPDATE databases")) {
          updates.push({ sql, params: [...params] });
          const results =
            opts.migratedRows ??
            (opts.migratedDbId
              ? [{ id: opts.migratedDbId, engine: "postgres", connection_blob: null }]
              : []);
          return { results };
        }
        return { results: [] };
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
      stubDb({ insertResult: { ok: 1 }, migratedDbId: "db_alpha" }).db,
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: true, adopted: true, dbId: "db_alpha" });
  });

  it("accepts a UUID-shaped token (36 chars with hyphens)", async () => {
    const out = await recordAnonAdoption(
      stubDb({ insertResult: { ok: 1 }, migratedDbId: "db_uuid" }).db,
      "user_1",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(out).toEqual({ ok: true, adopted: true, dbId: "db_uuid" });
  });

  it("returns adopted=false + persisted dbId when same user replays an already-adopted token", async () => {
    // SK-ANON-014 — replay reads `database_id` off the prior
    // anon_adoptions row so the post-signin landing can still pin the
    // adopted DB even when the after-hook (not this call) was the
    // adopter.
    const out = await recordAnonAdoption(
      stubDb({
        insertResult: null,
        existingUserId: "user_1",
        existingDbId: "db_prior",
      }).db,
      "user_1",
      "abcdef1234567890",
    );
    expect(out).toEqual({ ok: true, adopted: false, dbId: "db_prior" });
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
    const stub = stubDb({ insertResult: { ok: 1 }, migratedDbId: "db_x" });
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890");
    expect(out).toEqual({ ok: true, adopted: true, dbId: "db_x" });
    // Three UPDATEs: databases.tenant_id + api_keys.tenant_id (SK-ANON-003)
    // + anon_adoptions.database_id back-fill (SK-ANON-014).
    expect(stub.updates).toHaveLength(3);
    expect(stub.updates[0]?.sql).toContain("UPDATE databases SET tenant_id");
    const [boundUser, boundAnon] = stub.updates[0]?.params ?? [];
    expect(boundUser).toBe("user_42");
    // sha256("abcdef1234567890")[:16] is deterministic; assert the
    // prefix shape rather than the exact hex so the test isn't
    // recomputing the same crypto the implementation does.
    expect(typeof boundAnon).toBe("string");
    expect(String(boundAnon)).toMatch(/^anon:[0-9a-f]{16}$/);
    expect(stub.updates[1]?.sql).toContain("UPDATE api_keys SET tenant_id");
    // SK-ANON-014 — the back-fill stores the migrated dbId on the
    // adoption row keyed by token, guarded by `database_id IS NULL`.
    expect(stub.updates[2]?.sql).toContain("UPDATE anon_adoptions SET database_id");
    expect(stub.updates[2]?.params[0]).toBe("db_x");
  });

  it("rebinds databases.tenant_id on idempotent replay (same user)", async () => {
    // Replay path: the row already exists, but we still want to
    // re-run the UPDATE in case the previous adoption committed the
    // anon_adoptions row but lost the databases UPDATE (e.g. a Worker
    // restart between the two writes).
    const stub = stubDb({
      insertResult: null,
      existingUserId: "user_42",
      existingDbId: "db_prior",
    });
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890");
    expect(out).toEqual({ ok: true, adopted: false, dbId: "db_prior" });
    // On replay the databases UPDATE runs but matches 0 rows, and the
    // back-fill is skipped (the stored dbId is already populated). So
    // only the two SK-ANON-003 UPDATEs land in `stub.updates`.
    expect(stub.updates).toHaveLength(2);
  });

  it("back-fills database_id on legacy replay (existingDbId null but UPDATE matches)", async () => {
    // Legacy adoption rows written before migration 0012 have
    // database_id = NULL. If the prior adoption's UPDATE somehow lost
    // (e.g. Worker restart between INSERT and UPDATE), a replay can
    // still observe a migrated dbId via RETURNING and back-fill the
    // adoption row so subsequent replays surface the same dbId.
    const stub = stubDb({
      insertResult: null,
      existingUserId: "user_42",
      existingDbId: null,
      migratedDbId: "db_late",
    });
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890");
    expect(out).toEqual({ ok: true, adopted: false, dbId: "db_late" });
    // Three UPDATEs including the back-fill.
    expect(stub.updates).toHaveLength(3);
    expect(stub.updates[2]?.sql).toContain("UPDATE anon_adoptions SET database_id");
  });

  it("returns dbId=null when first adoption migrated zero rows (eg sweep evicted the anon DB)", async () => {
    // Edge case: the sweep job (`docs/runbook.md §9`) could evict the
    // anon DB between create and sign-in. The adoption row is still
    // written (tracking the token-to-user binding for security) but
    // there's no DB to migrate. Returning `dbId: null` is honest; the
    // post-signin landing falls back to the rail's newest-DB pin
    // (which will be empty for this user too — graceful degrade).
    const stub = stubDb({ insertResult: { ok: 1 }, migratedDbId: null });
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890");
    expect(out).toEqual({ ok: true, adopted: true, dbId: null });
    // Two UPDATEs (databases + api_keys); no back-fill since no dbId.
    expect(stub.updates).toHaveLength(2);
  });

  it("retargets the Postgres ACL for each migrated hosted DB (SK-ANON-003 amendment)", async () => {
    const stub = stubDb({ insertResult: { ok: 1 }, migratedDbId: "db_users_abc123" });
    const retarget = vi.fn().mockResolvedValue(undefined);
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890", retarget);
    expect(out).toEqual({ ok: true, adopted: true, dbId: "db_users_abc123" });
    expect(retarget).toHaveBeenCalledExactlyOnceWith("db_users_abc123", "user_42");
  });

  it("skips the ACL retarget for BYO and non-postgres rows", async () => {
    const stub = stubDb({
      insertResult: { ok: 1 },
      migratedRows: [
        { id: "db_byo", engine: "postgres", connection_blob: "sealed…" },
        { id: "db_ch", engine: "clickhouse", connection_blob: null },
      ],
    });
    const retarget = vi.fn().mockResolvedValue(undefined);
    const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890", retarget);
    expect(out.ok).toBe(true);
    expect(retarget).not.toHaveBeenCalled();
  });

  it("a failed ACL retarget is logged but never fails the adoption (sign-in must succeed)", async () => {
    const stub = stubDb({ insertResult: { ok: 1 }, migratedDbId: "db_users_abc123" });
    const retarget = vi.fn().mockRejectedValue(new Error("neon down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const out = await recordAnonAdoption(stub.db, "user_42", "abcdef1234567890", retarget);
      expect(out).toEqual({ ok: true, adopted: true, dbId: "db_users_abc123" });
      const logged = errSpy.mock.calls.map((c) => String(c[0])).find((s) => s.includes("regrant"));
      expect(logged).toBeDefined();
      expect(JSON.parse(logged ?? "{}")).toMatchObject({
        event: "anon_adopt_regrant_failed",
        db_id: "db_users_abc123",
      });
    } finally {
      errSpy.mockRestore();
    }
  });
});

describe("buildRetargetStatements", () => {
  it("emits role-if-missing, grants, WITH SET membership, and one ALTER POLICY per table", () => {
    const stmts = buildRetargetStatements("users_abc123", "user_42", "tenant_0123456789abcdef", [
      "users",
      "orders",
    ]);
    const sqls = stmts.map((s) => s.sql);
    // Timeout bound first (ALTER POLICY takes ACCESS EXCLUSIVE — a held
    // lock must not pin the sign-in path past 30 s), then role-if-missing.
    expect(sqls[0]).toBe("SET LOCAL statement_timeout = '30s'");
    expect(sqls[1]).toContain('CREATE ROLE "tenant_0123456789abcdef"');
    expect(sqls).toContainEqual(expect.stringContaining('GRANT USAGE ON SCHEMA "users_abc123"'));
    expect(sqls).toContainEqual(
      expect.stringContaining("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA"),
    );
    expect(sqls).toContainEqual(expect.stringContaining("GRANT USAGE ON ALL SEQUENCES IN SCHEMA"));
    // PG16+ split SET from ADMIN — exec's `SET LOCAL ROLE` needs the
    // explicit membership, same as the provision batch.
    expect(sqls).toContainEqual(
      expect.stringContaining('GRANT "tenant_0123456789abcdef" TO CURRENT_USER WITH SET TRUE'),
    );
    const policyStmts = sqls.filter((s) => s.startsWith("ALTER POLICY tenant_isolation"));
    expect(policyStmts).toHaveLength(2);
    expect(policyStmts[0]).toContain(
      `ON "users_abc123"."users" USING (current_setting('app.tenant_id', true) = 'user_42')`,
    );
  });

  it("escapes single quotes in the tenant literal (RLS predicate breakout guard)", () => {
    const stmts = buildRetargetStatements("s1", "us'er", "tenant_0123456789abcdef", ["t1"]);
    const policy = stmts.find((s) => s.sql.startsWith("ALTER POLICY"));
    expect(policy?.sql).toContain("= 'us''er')");
  });

  it("rejects an unsafe policy-table identifier (defense in depth on catalog output)", () => {
    expect(() =>
      buildRetargetStatements("s1", "user_42", "tenant_0123456789abcdef", ['bad"name']),
    ).toThrow(/unsafe policyTable/);
  });
});
