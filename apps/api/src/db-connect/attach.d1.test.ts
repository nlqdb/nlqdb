// The attach door on a D1 (`GLOBAL-043` roadmap 1a, slice 5): `connectByoDb`
// takes an API token + account id + database id, reads the schema and the Tier 0
// proposals over the REST client from a local D1 (workerd's own, via miniflare),
// seals the triple and records the DB row with its proposals in the api's own
// D1. Prints KPI A through the door (credentials in → proposals in the ledger).

import { d1RestBatch } from "@nlqdb/db";
import { afterAll, describe, expect, it } from "vitest";
import { D1_TARGET, localD1 } from "../../../../packages/db/test/fixtures/local-d1.ts";
import { listProposals } from "../dba-changes.ts";
import { openSecret } from "../secret-envelope.ts";
import { type ConnectByoDeps, connectByoDb } from "./connect.ts";
import { sqliteD1 } from "./test-sqlite-d1.ts";

const KEK = "test-kek-this-is-a-high-entropy-string-aaaa";
const APP = `
  CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
  CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT);
  CREATE TABLE comments (id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id), user_id INTEGER REFERENCES users(id), body TEXT);
  CREATE INDEX comments_post ON comments(post_id, id);
  CREATE TABLE likes (user_id INTEGER REFERENCES users(id), post_id INTEGER REFERENCES posts(id));
`;

const userD1 = localD1();
afterAll(() => userD1.dispose());

async function deps(schema: string): Promise<ConnectByoDeps & { d1: D1Database }> {
  const { fetchFn } = await userD1.open(schema);
  let n = 0;
  return {
    resolve: async () => {
      throw new Error("a D1 attach resolves no host");
    },
    kek: KEK,
    d1: sqliteD1(),
    randomSuffix: () => `d1t${String(n++).padStart(3, "0")}`,
    buildClickhouseQuery: () => {
      throw new Error("not a ClickHouse attach");
    },
    buildPostgresQuery: () => {
      throw new Error("not a Postgres attach");
    },
    buildD1Batch: (target) => d1RestBatch(target, fetchFn),
  };
}

const attach = (d: ConnectByoDeps, d1 = D1_TARGET) =>
  connectByoDb(d, { engine: "d1", d1, tenantId: "user_synth", name: "rateme" });

describe("the attach door on a local D1", () => {
  it("records the Tier 0 proposals with the DB row; the sealed secret is the triple", async () => {
    const d = await deps(APP);
    const result = await attach(d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ engine: "d1", name: "rateme", pkLive: null });
    expect(result.proposals.map((p) => `${p.table}(${p.columns.join(",")})#${p.id}`)).toEqual([
      "comments(user_id)#1",
      "likes(post_id)#2",
      "likes(user_id)#3",
      "posts(user_id)#4",
    ]);
    expect(result.schemaPreview).toContain("CREATE TABLE posts");

    const row = await d.d1
      .prepare(
        "SELECT engine, connection_blob AS blob, schema_text AS text FROM databases WHERE id = ?",
      )
      .bind(result.dbId)
      .first<{ engine: string; blob: string; text: string }>();
    expect(row?.engine).toBe("d1");
    expect(row?.text).toContain("CREATE INDEX comments_post");
    expect(row?.blob).not.toContain(D1_TARGET.accountId);
    const opened = await openSecret(row?.blob ?? "", {
      kek: KEK,
      context: `dbconn:${result.dbId}`,
    });
    expect(JSON.parse(opened)).toEqual(D1_TARGET);

    const ledger = await listProposals(d.d1, result.dbId, "user_synth");
    expect(ledger.map((p) => p.ddl)).toEqual(result.proposals.map((p) => p.ddl));
  });

  it("a malformed id is refused before any request; nothing is recorded", async () => {
    const d = await deps(APP);
    const before = userD1.requests();
    const result = await attach(d, { ...D1_TARGET, databaseId: "../../../user/tokens" });
    expect(result).toEqual({ ok: false, status: 400, message: "D1 database id must be a UUID." });
    expect(userD1.requests()).toBe(before);
    expect(await d.d1.prepare("SELECT COUNT(*) AS n FROM databases").first()).toEqual({ n: 0 });
  });

  it("a refused token is one generic sentence; nothing is recorded", async () => {
    const d = await deps(APP);
    d.buildD1Batch = (target) =>
      d1RestBatch(target, (async () =>
        Response.json(
          { success: false, errors: [{ code: 10000, message: "Authentication error" }] },
          { status: 403 },
        )) as unknown as typeof fetch);
    const result = await attach(d);
    expect(result).toMatchObject({ ok: false, status: 502 });
    if (result.ok) return;
    expect(result.message).toMatch(/^Could not read the D1 catalog/);
    expect(await d.d1.prepare("SELECT COUNT(*) AS n FROM databases").first()).toEqual({ n: 0 });
  });

  // KPI A through the door (`GLOBAL-043` item 9), printed in CI's
  // `test-dba-postgres` log. Local, so it excludes the 3 sequential REST round
  // trips a real attach adds (the schema read runs alongside the first).
  it("KPI A (synthetic, D1 attach door): credentials → proposals in the ledger", async () => {
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const d = await deps(APP);
      const t0 = performance.now();
      const result = await attach(d);
      runs.push(performance.now() - t0);
      expect(result.ok && result.proposals.length).toBe(4);
    }
    runs.sort((a, b) => a - b);
    // biome-ignore lint/suspicious/noConsole: the KPI A reading belongs in the CI log
    console.log(
      `KPI A (synthetic, D1 attach door): median ${runs[2]?.toFixed(1)} ms over 5 (${runs[0]?.toFixed(1)}–${runs[4]?.toFixed(1)} ms)`,
    );
  });
});
