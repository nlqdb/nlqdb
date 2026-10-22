// GLOBAL-041 step 11 — the change ledger read `/app/dba` renders: rows come
// back newest first with their inverse, and only to the DB's owner. Exercised
// against real D1 (migration 0038) through the writer `insert()` uses.

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiKeyHmacSecret, mintSkLiveKey } from "../src/api-keys.ts";
import { listDbaChanges, recordDbaChanges } from "../src/dba-changes.ts";

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
