// The D1 Tier 0 observer and schema reader against a local D1 (`GLOBAL-043`
// roadmap 1a, the D1 slice), through `d1RestBatch` — the client a real attach
// uses (`fixtures/local-d1.ts`).

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { introspectD1Schema, observeD1Catalog } from "../src/index.ts";
import { localD1 as createLocalD1 } from "./fixtures/local-d1.ts";

const d1 = createLocalD1();
const localD1 = async (schema: string) => (await d1.open(schema)).batch;
let requestsBefore = 0;

let telemetry: TestTelemetry;
afterAll(() => d1.dispose());
beforeEach(() => {
  telemetry = createTestTelemetry();
  requestsBefore = d1.requests();
});
afterEach(() => telemetry.reset());

// A small app: what an agent-built D1 schema looks like — PKs and FKs, few
// secondary indexes.
const APP = `
  CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
  CREATE TABLE profiles (user_id INTEGER PRIMARY KEY REFERENCES users(id), bio TEXT);
  CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT);
  CREATE TABLE comments (id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id), user_id INTEGER REFERENCES users(id), body TEXT);
  CREATE INDEX comments_post ON comments(post_id, id);
  CREATE INDEX comments_user_recent ON comments(user_id) WHERE id > 100;
  CREATE TABLE orgs (region TEXT, code TEXT, PRIMARY KEY (region, code)) WITHOUT ROWID;
  CREATE TABLE seats (id INTEGER PRIMARY KEY, code TEXT, region TEXT, FOREIGN KEY (region, code) REFERENCES orgs(region, code));
  CREATE INDEX seats_org ON seats(code, region);
  CREATE TABLE "it's" (id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id));
  INSERT INTO users (email) VALUES ('a'), ('b'), ('c');
  INSERT INTO posts (user_id, title) VALUES (1, 'x'), (2, 'y');
  INSERT INTO comments (post_id, user_id, body) VALUES (1, 1, 'z');
`;

describe("observeD1Catalog on a local D1", () => {
  it("proposes an index for each unindexed FK, and none for covered ones", async () => {
    const proposals = await observeD1Catalog(await localD1(APP));

    // posts.user_id: no index. comments.user_id: only a partial one. "it's":
    // a quoted name survives the pragma literal. Covered: profiles.user_id
    // (rowid), comments.post_id (leading key), seats(region, code) (reversed).
    expect(proposals.map((p) => `${p.table}(${p.columns.join(",")})`).sort()).toEqual([
      "comments(user_id)",
      "it's(post_id)",
      "posts(user_id)",
    ]);
    const posts = proposals.find((p) => p.table === "posts");
    expect(posts).toMatchObject({
      kind: "create_index",
      tier: 0,
      schema: "main",
      ddl: 'CREATE INDEX IF NOT EXISTS "nlqdb_posts_user_id_dac06227" ON "posts" ("user_id")',
      inverse: 'DROP INDEX IF EXISTS "nlqdb_posts_user_id_dac06227"',
      evidence: { rowEstimate: 0, tableBytes: 0 },
    });
    // Three requests whatever the table count (the seed itself makes none).
    expect(d1.requests() - requestsBefore).toBe(3);
  });

  it("orders by sqlite_stat1 row counts once ANALYZE has run", async () => {
    const proposals = await observeD1Catalog(await localD1(`${APP} ANALYZE;`));
    expect(proposals.map((p) => [p.table, p.evidence.rowEstimate])).toEqual([
      ["posts", 2],
      ["comments", 1],
      ["it's", 0],
    ]);
  });

  it("the proposal's DDL builds on D1 and its inverse drops it", async () => {
    const batch = await localD1(APP);
    const [first] = await observeD1Catalog(batch);
    if (!first) throw new Error("expected a proposal");
    await batch([first.ddl, first.ddl]); // IF NOT EXISTS: a retried apply is a no-op
    expect((await observeD1Catalog(batch)).map((p) => p.table)).not.toContain(first.table);
    await batch([first.inverse, first.inverse]);
    expect((await observeD1Catalog(batch)).map((p) => p.table)).toContain(first.table);
  });

  it("a healthy or empty D1 gets nothing, never an invented proposal", async () => {
    expect(await observeD1Catalog(await localD1(""))).toEqual([]);
    expect(
      await observeD1Catalog(
        await localD1(`
          CREATE TABLE a (id INTEGER PRIMARY KEY);
          CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a(id));
          CREATE INDEX b_a ON b(a_id);
        `),
      ),
    ).toEqual([]);
  });

  it("reads the schema as the app's own DDL, one request, no internal tables", async () => {
    const batch = await localD1(APP);
    const before = d1.requests();
    const { schemaText, schemaHash } = await introspectD1Schema(batch);
    expect(d1.requests() - before).toBe(1);
    expect(schemaText).toContain("CREATE TABLE posts (id INTEGER PRIMARY KEY");
    expect(schemaText).toContain("CREATE INDEX comments_post ON comments(post_id, id);");
    expect(schemaText).not.toMatch(/_cf_|sqlite_/);
    expect(schemaHash).toBe((await introspectD1Schema(batch)).schemaHash);
  });

  it("records one db.observe span with the proposal count", async () => {
    await observeD1Catalog(await localD1(APP));
    const span = telemetry.spanExporter.getFinishedSpans().find((s) => s.name === "db.observe");
    expect(span?.attributes).toMatchObject({
      "db.system": "sqlite",
      "db.operation.name": "observe_catalog",
      "nlqdb.dba.proposals": 3,
    });
  });

  // KPI A on a synthetic D1 (`GLOBAL-043` item 9): catalog read → first
  // proposal, printed in CI's `test-dba-postgres` log. Local, so it excludes the
  // REST round trips (3 requests) a real attach adds.
  it("KPI A (synthetic, local D1): time to first proposal", async () => {
    const batch = await localD1(APP);
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const proposals = await observeD1Catalog(batch);
      runs.push(performance.now() - t0);
      expect(proposals.length).toBeGreaterThan(0);
    }
    runs.sort((a, b) => a - b);
    // biome-ignore lint/suspicious/noConsole: the KPI A reading belongs in the CI log
    console.log(
      `KPI A (synthetic, local D1): median ${runs[2]?.toFixed(1)} ms over 5 (${runs[0]?.toFixed(1)}–${runs[4]?.toFixed(1)} ms)`,
    );
  });
});
