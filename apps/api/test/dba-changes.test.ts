// GLOBAL-041 step 11 — the change ledger read `/app/dba` renders: rows come
// back newest first with their inverse, and only to the DB's owner. Exercised
// against real D1 (migration 0038) through the writer `insert()` uses.

import { env, SELF } from "cloudflare:test";
import type { Proposal } from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { apiKeyHmacSecret, mintSkLiveKey } from "../src/api-keys.ts";
import { listDbaChanges, proposalStatement, recordDbaChanges } from "../src/dba-changes.ts";
import { type DecideDeps, decideProposal } from "../src/dba-verbs.ts";
import { sealSecret } from "../src/secret-envelope.ts";

import "./apply-migrations.ts";

describe("listDbaChanges", () => {
  it("returns the owner's ledger newest first, null to anyone else", async () => {
    await env.DB.prepare(
      "INSERT INTO databases (id, tenant_id, connection_secret_ref) VALUES ('db_ledger', 'u_owner', 'ref')",
    ).run();
    const change = (kind: "create_table" | "add_column", table: string) => ({
      kind,
      table,
      ddl: `-- ${kind} ${table}`,
      inverse: `-- undo ${table}`,
    });
    await recordDbaChanges(env.DB, "db_ledger", "insert", [change("create_table", "servers")]);
    await recordDbaChanges(env.DB, "db_ledger", "ask", [change("add_column", "votes")]);

    const rows = await listDbaChanges(env.DB, "db_ledger", "u_owner");
    expect(rows?.map((r) => [r.origin, r.kind, r.table, r.inverse])).toEqual([
      ["ask", "add_column", "votes", "-- undo votes"],
      ["insert", "create_table", "servers", "-- undo servers"],
    ]);
    expect(typeof rows?.[0]?.createdAt).toBe("number");

    expect(await listDbaChanges(env.DB, "db_ledger", "u_other")).toBeNull();
    expect(await listDbaChanges(env.DB, "db_missing", "u_owner")).toBeNull();
  });
});

describe("GET /v1/databases/:id/changes — principal gate", () => {
  const URL = "https://example.com/v1/databases/db_route/changes";
  const get = (token?: string) =>
    SELF.fetch(URL, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  const code = async (res: Response) =>
    ((await res.json()) as { error?: { code?: string } }).error?.code;

  it("401 without auth, 403 account_required for anon", async () => {
    expect((await get()).status).toBe(401);
    const anon = await get("anon_abcdef0123456789");
    expect(anon.status).toBe(403);
    expect(await code(anon)).toBe("account_required");
  });

  it("serves the owner's key the ledger and a stranger's key db_not_found", async () => {
    await env.DB.prepare(
      "INSERT INTO databases (id, tenant_id, connection_secret_ref) VALUES ('db_route', 'u_route_owner', 'ref')",
    ).run();
    await recordDbaChanges(env.DB, "db_route", "insert", [
      { kind: "create_table", table: "votes", ddl: "-- c", inverse: "-- u" },
    ]);
    const secret = apiKeyHmacSecret(env);
    const owner = await mintSkLiveKey(env.DB, secret, "u_route_owner", null);
    const stranger = await mintSkLiveKey(env.DB, secret, "u_route_stranger", null);

    const ok = await get(owner.plaintext);
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { changes: { table: string }[] };
    expect(body.changes.map((c) => c.table)).toEqual(["votes"]);

    const denied = await get(stranger.plaintext);
    expect(denied.status).toBe(404);
    expect(await code(denied)).toBe("db_not_found");
  });
});

// GLOBAL-043 item 5 — the verbs on real D1 (migrations 0039–0040), the user's
// Postgres stubbed: the DDL it receives is the proposal's, once.
describe("decideProposal", () => {
  const KEK = "test-kek-this-is-a-high-entropy-string-aaaa";
  const proposal = {
    kind: "create_index",
    tier: 0,
    schema: "public",
    table: "posts",
    columns: ["author_id"],
    ddl: 'CREATE INDEX CONCURRENTLY "posts_author_id_idx" ON "public"."posts" ("author_id");',
    inverse: 'DROP INDEX CONCURRENTLY "public"."posts_author_id_idx";',
    reason: "Foreign key posts(author_id) → users has no index.",
    evidence: { rowEstimate: 1000, tableBytes: 8192 },
  } as Proposal;

  async function seed(dbId: string, tenantId: string): Promise<number> {
    const blob = await sealSecret("postgres://app:secret@db.example.com:5432/app", {
      kek: KEK,
      context: `dbconn:${dbId}`,
    });
    await env.DB.prepare(
      "INSERT INTO databases (id, tenant_id, engine, connection_secret_ref, connection_blob) VALUES (?, ?, 'postgres', 'byo', ?)",
    )
      .bind(dbId, tenantId, blob)
      .run();
    const res = await proposalStatement(env.DB, dbId, proposal).run();
    return Number(res.meta.last_row_id);
  }

  function deps(fail = false) {
    const sent: string[] = [];
    return {
      sent,
      deps: {
        d1: env.DB,
        kek: KEK,
        resolve: async () => ["93.184.216.34"],
        buildPostgresQuery: () => ({
          query: async (text: string) => {
            sent.push(text);
            if (fail && text.startsWith("CREATE")) throw new Error("permission denied");
            return { rows: [], rowCount: 0 };
          },
          close: async () => {},
        }),
      } as unknown as DecideDeps,
    };
  }

  it("applies once, records who decided, and replays the same verb", async () => {
    const id = await seed("db_verb_apply", "u_verb");
    const { deps: d, sent } = deps();
    const first = await decideProposal(d, {
      id,
      tenantId: "u_verb",
      decidedBy: "sk_live:k1",
      verb: "apply",
    });
    expect(first).toMatchObject({
      ok: true,
      replayed: false,
      proposal: { id, dbId: "db_verb_apply", status: "applied", decidedBy: "sk_live:k1" },
    });
    expect(sent).toEqual(["SET statement_timeout = '600s'", proposal.ddl]);

    const again = await decideProposal(d, {
      id,
      tenantId: "u_verb",
      decidedBy: "x",
      verb: "apply",
    });
    expect(again).toMatchObject({
      ok: true,
      replayed: true,
      proposal: { decidedBy: "sk_live:k1" },
    });
    expect(sent).toHaveLength(2);

    const reject = await decideProposal(d, {
      id,
      tenantId: "u_verb",
      decidedBy: "x",
      verb: "reject",
      reason: null,
    });
    expect(reject).toEqual({ ok: false, code: "proposal_decided", status: "applied" });
  });

  it("puts a failed apply back to proposed after clearing the half-built index", async () => {
    const id = await seed("db_verb_fail", "u_verb");
    const { deps: d, sent } = deps(true);
    const res = await decideProposal(d, { id, tenantId: "u_verb", decidedBy: "u", verb: "apply" });
    expect(res).toMatchObject({ ok: false, code: "apply_failed" });
    expect(sent.at(-1)).toBe(proposal.inverse);
    const rows = await listDbaChanges(env.DB, "db_verb_fail", "u_verb");
    expect(rows?.[0]?.status).toBe("proposed");
  });

  it("refuses to run DDL outside the proposal kind's verb set, the row untouched", async () => {
    const id = await seed("db_verb_tamper", "u_verb");
    const tampered = { ...proposal, ddl: 'DROP TABLE "public"."posts"' };
    await env.DB.prepare("UPDATE dba_changes SET proposal = ? WHERE id = ?")
      .bind(JSON.stringify(tampered), id)
      .run();
    const { deps: d, sent } = deps();
    await expect(
      decideProposal(d, { id, tenantId: "u_verb", decidedBy: "u", verb: "apply" }),
    ).rejects.toThrow(/DDL validator/);
    expect(sent).toEqual([]);
    const rows = await listDbaChanges(env.DB, "db_verb_tamper", "u_verb");
    expect(rows?.[0]?.status).toBe("proposed");
  });

  it("rejects with the reason, without touching the DB, owner only", async () => {
    const id = await seed("db_verb_reject", "u_verb");
    const { deps: d, sent } = deps();
    const stranger = await decideProposal(d, {
      id,
      tenantId: "u_other",
      decidedBy: "u",
      verb: "reject",
      reason: null,
    });
    expect(stranger).toEqual({ ok: false, code: "proposal_not_found" });

    const res = await decideProposal(d, {
      id,
      tenantId: "u_verb",
      decidedBy: "user:u_verb",
      verb: "reject",
      reason: "we index this table offline",
    });
    expect(res).toMatchObject({
      ok: true,
      proposal: { status: "rejected", rejectReason: "we index this table offline" },
    });
    expect(sent).toEqual([]);
  });
});

describe("POST /v1/proposals/:id/reject — principal gate", () => {
  it("lets the owner's key reject and gives a stranger's key proposal_not_found", async () => {
    await env.DB.prepare(
      "INSERT INTO databases (id, tenant_id, connection_secret_ref) VALUES ('db_verb_route', 'u_verb_owner', 'byo')",
    ).run();
    const p = { kind: "create_index", table: "votes", ddl: "-- c", inverse: "-- u" } as Proposal;
    const id = Number((await proposalStatement(env.DB, "db_verb_route", p).run()).meta.last_row_id);
    const secret = apiKeyHmacSecret(env);
    const owner = await mintSkLiveKey(env.DB, secret, "u_verb_owner", null);
    const stranger = await mintSkLiveKey(env.DB, secret, "u_verb_stranger", null);
    const post = (token: string) =>
      SELF.fetch(`https://example.com/v1/proposals/${id}/reject`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ reason: "not now" }),
      });

    const denied = await post(stranger.plaintext);
    expect(denied.status).toBe(404);
    expect(((await denied.json()) as { error: { code: string } }).error.code).toBe(
      "proposal_not_found",
    );

    const ok = await post(owner.plaintext);
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { proposal: { status: string; decidedBy: string } };
    expect(body.proposal.status).toBe("rejected");
    expect(body.proposal.decidedBy).toMatch(/^sk_live:/);
  });
});
