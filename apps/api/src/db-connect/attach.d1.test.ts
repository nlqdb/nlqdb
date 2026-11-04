// The attach door on a D1 (`GLOBAL-043` roadmap 1a, slice 5): `connectByoDb`
// takes an API token + account id + database id, reads the schema and the Tier 0
// proposals over the REST client from a local D1 (workerd's own, via miniflare),
// seals the triple and records the DB row with its proposals in the api's own
// D1. Prints KPI A through the door (credentials in → proposals in the ledger).

import { type D1QueryInsight, d1RestBatch } from "@nlqdb/db";
import { afterAll, describe, expect, it } from "vitest";
import { D1_TARGET, localD1 } from "../../../../packages/db/test/fixtures/local-d1.ts";
import { listProposals } from "../dba-changes.ts";
import { OBSERVE_WINDOW_SEC, observeDue } from "../dba-observe.ts";
import { decideProposal, VERIFY_WINDOW_SEC, verifyDue } from "../dba-verbs.ts";
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

async function deps(
  schema: string,
): Promise<ConnectByoDeps & { d1: D1Database; fetchFn: typeof fetch }> {
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
    fetchFn,
  };
}

// One statement through the REST endpoint, with D1's own `meta.rows_read`.
async function rowsRead(fetchFn: typeof fetch, sql: string): Promise<number> {
  const res = await fetchFn("https://d1.test/query", {
    method: "POST",
    body: JSON.stringify({ batch: [{ sql }] }),
  });
  const body = (await res.json()) as { result: { meta: { rows_read: number } }[] };
  return Number(body.result[0]?.meta.rows_read);
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

  // The verbs on a D1 (`GLOBAL-043` items 4, 5, 7; `002-rateme12-attach.md` §3
  // step 2): three proposals applied through the REST client with the sealed
  // triple, one rejected; a tampered row is refused before it is claimed; the
  // `dba_verify` job judges the applied Tier 0 rows without opening the DB.
  // Prints D1 rows read by the app's hot FK lookup before → after its index.
  it("apply / reject on a D1: indexes built, rows read on the FK lookup drop", async () => {
    const d = await deps(APP);
    const seq = (n: number) =>
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${n})`;
    await rowsRead(
      d.fetchFn,
      `${seq(100)} INSERT INTO users (id, email) SELECT i, 'u' || i FROM n`,
    );
    await rowsRead(
      d.fetchFn,
      `${seq(5000)} INSERT INTO posts (user_id, title) SELECT 1 + i % 100, 'post ' || i FROM n`,
    );
    const HOT = "SELECT id, title FROM posts WHERE user_id = 7";
    const before = await rowsRead(d.fetchFn, HOT);
    const result = await attach(d);
    if (!result.ok) throw new Error(result.message);
    const [rejected, ...applied] = result.proposals;
    // A ledger row whose DDL is not the one nlqdb renders never runs.
    const tampered = applied[0] as { id: number; ddl: string };
    const evil = { ...tampered, ddl: "DROP TABLE users" };
    await d.d1
      .prepare("UPDATE dba_changes SET proposal = ? WHERE id = ?")
      .bind(JSON.stringify(evil), tampered.id)
      .run();
    const apply = (id: number) =>
      decideProposal(d, { id, tenantId: "user_synth", decidedBy: "sk_live:synth", verb: "apply" });
    await expect(apply(tampered.id)).rejects.toThrow(/failed the D1 DDL check/);
    const still = await listProposals(d.d1, result.dbId, "user_synth");
    expect(still.map((p) => p.id)).toContain(tampered.id); // still `proposed`
    await d.d1
      .prepare("UPDATE dba_changes SET proposal = ? WHERE id = ?")
      .bind(JSON.stringify(tampered), tampered.id)
      .run();

    const t0 = performance.now();
    for (const p of applied) {
      expect(await apply(p.id)).toMatchObject({ ok: true, proposal: { status: "applied" } });
    }
    const applyMs = (performance.now() - t0) / applied.length;
    expect(await apply(applied[0]?.id as number)).toMatchObject({ ok: true, replayed: true });
    expect(
      await decideProposal(d, {
        id: (rejected as { id: number }).id,
        tenantId: "user_synth",
        decidedBy: "user:user_synth",
        verb: "reject",
        reason: "covered by a composite",
      }),
    ).toMatchObject({ ok: true, proposal: { status: "rejected" } });

    const built = await d.buildD1Batch?.(D1_TARGET)([
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'nlqdb_%' ORDER BY name",
    ]);
    const nameOf = (p: { ddl: string }) => /EXISTS "([^"]+)"/.exec(p.ddl)?.[1];
    expect(built?.[0]?.map((r) => r["name"])).toEqual(applied.map(nameOf).sort());
    const after = await rowsRead(d.fetchFn, HOT);
    expect(after).toBeLessThan(before);

    // Tier 0 names no fingerprint: verify keeps it, claims no delta, no request.
    const requests = userD1.requests();
    const verified = await verifyDue(d, Math.floor(Date.now() / 1000) + VERIFY_WINDOW_SEC);
    expect(verified.map((v) => v.verification.verdict)).toEqual(applied.map(() => "unmeasured"));
    expect(userD1.requests()).toBe(requests);
    // biome-ignore lint/suspicious/noConsole: the D1 apply reading belongs in the CI log
    console.log(
      `Verbs (synthetic, D1 API): ${applied.length} applied (${applyMs.toFixed(1)} ms each), 1 rejected; rows read by the posts(user_id) lookup ${before} → ${after}`,
    );
  });

  // The `dba_observe` job on a D1 (`GLOBAL-043` item 7, `002-rateme12-attach.md`
  // §3 step 1): no baseline to wait for — Cloudflare keeps the insights — so the
  // first tick proposes from the day before, with no caller. The FK lookup's
  // index is already a Tier 0 row, so it is not recorded twice.
  it("the dba_observe job records a D1's Tier 1 proposals from its first tick", async () => {
    const d = await deps(APP);
    const insight = (query: string, rowsRead: number, rowsReturned: number): D1QueryInsight => ({
      query,
      calls: 400,
      meanMs: 1.2,
      rowsRead,
      rowsReturned,
      rowsWritten: 0,
      totalRowsRead: rowsRead * 400,
    });
    const windows: { since: string; until: string }[] = [];
    d.readD1Insights = async (target, window) => {
      expect(target).toEqual(D1_TARGET);
      windows.push(window);
      return [
        insight("SELECT id FROM users WHERE email = ?", 100, 1),
        insight("SELECT id, user_id FROM posts WHERE title = ? LIMIT 1", 5000, 1),
        insight("SELECT id, title FROM posts WHERE user_id = ?", 5000, 50),
      ];
    };
    const result = await attach(d);
    if (!result.ok) throw new Error(result.message);

    const t0 = Date.UTC(2026, 10, 4, 9, 48) / 1000;
    const observeAt = performance.now();
    const [observed] = await observeDue(d, t0);
    const observeMs = performance.now() - observeAt;
    expect(windows).toEqual([{ since: "2026-11-03T09:00:00Z", until: "2026-11-04T09:00:00Z" }]);
    const ledger = await listProposals(d.d1, result.dbId, "user_synth");
    const tier1 = ledger.filter((p) => observed?.proposalIds.includes(p.id));
    expect(tier1.map((p) => `${p.table}(${p.columns}) t${p.tier}`)).toEqual([
      "posts(title) t1",
      "users(email) t1",
    ]);
    expect(ledger.filter((p) => p.ddl.includes('"posts" (`user_id`)'))).toHaveLength(1);

    // Inside the window: not due. After it: the next window starts where this
    // one ended, and the same texts add nothing.
    expect(await observeDue(d, t0 + OBSERVE_WINDOW_SEC - 1)).toEqual([]);
    expect(await observeDue(d, t0 + OBSERVE_WINDOW_SEC)).toEqual([
      { dbId: result.dbId, proposalIds: [] },
    ]);
    expect(windows[1]).toEqual({ since: "2026-11-04T09:00:00Z", until: "2026-11-05T09:00:00Z" });

    // A refused insights read keeps the window start, so nothing is lost.
    d.readD1Insights = async () => {
      throw new Error("Authentication error");
    };
    expect(await observeDue(d, t0 + 2 * OBSERVE_WINDOW_SEC)).toEqual([]);
    const row = await d.d1
      .prepare("SELECT observe_from AS f FROM databases WHERE id = ?")
      .bind(result.dbId)
      .first<{ f: string }>();
    expect(row?.f).toBe("2026-11-05T09:00:00Z");
    // biome-ignore lint/suspicious/noConsole: the observe reading belongs in the CI log
    console.log(
      `Tier 1 observe (synthetic, D1, dba_observe job): ${tier1.length} proposals recorded with no caller on the first tick, ${observeMs.toFixed(1)} ms for the DB`,
    );
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
