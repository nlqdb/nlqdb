// GLOBAL-041 step 11 — the change ledger read `/app/dba` renders: rows come
// back newest first with their inverse, and only to the DB's owner. Exercised
// against real D1 (migration 0038) through the writer `insert()` uses.

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
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
  it("returns 401 when no auth is present", async () => {
    const { SELF } = await import("cloudflare:test");
    const res = await SELF.fetch("https://example.com/v1/databases/db_ledger/changes");
    expect(res.status).toBe(401);
  });
});
