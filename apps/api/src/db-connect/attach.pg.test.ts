// Live check of the attach door (`GLOBAL-043` item 6) on the seeded synthetic
// Postgres: `connectByoDb` validates, introspects, observes Tier 0, seals and
// records the DB row with its proposals, on the production BYO transport minus
// TLS. Runs only when `PG_TEST_URL` is set (CI's `test-dba-postgres` job); it
// prints KPI A through the door — connection string in → proposals in the
// ledger, in ms.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { openByoPostgres } from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { connectByoDb } from "./connect.ts";

// The api never depends on a Postgres driver (`GLOBAL-021`, lockfile guard);
// test-time setup borrows the owner's copy, `@nlqdb/db`'s `postgres`.
type Sql = { unsafe: (q: string) => Promise<unknown>; end: () => Promise<void> };
const postgres = createRequire(new URL("../../../../packages/db/package.json", import.meta.url))(
  "postgres",
) as (url: string, opts: Record<string, unknown>) => Sql;

const url = process.env["PG_TEST_URL"];
const DB = "attach_synth";

// The packages/db seed, minus its `dba_synth` schema lines: the door attaches
// `public`, so the synthetic app lives there in a database of its own.
async function seedPublic(adminUrl: string): Promise<string> {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE ${DB}`);
  await admin.end();
  const target = new URL(adminUrl);
  target.pathname = `/${DB}`;
  const seed = readFileSync(
    new URL("../../../../packages/db/test/fixtures/dba-synthetic-seed.sql", import.meta.url),
    "utf8",
  ).replace(/^.*dba_synth.*$/gm, "");
  const sql = postgres(target.href, { max: 1, onnotice: () => {} });
  await sql.unsafe(seed);
  await sql.end();
  return target.href;
}

// The two statements the door issues: the dbId probe and one batch.
function memoryD1() {
  const ledger: unknown[][] = [];
  const statement = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      first: async () => null,
      run: async () => {
        if (!sql.startsWith("INSERT INTO dba_changes")) return { meta: { last_row_id: 0 } };
        ledger.push(params);
        return { meta: { last_row_id: ledger.length } };
      },
    }),
  });
  const batch = async (stmts: { run: () => Promise<unknown> }[]) => {
    const out = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  };
  return { d1: { prepare: statement, batch } as unknown as D1Database, ledger };
}

describe.skipIf(!url)("the attach door on the seeded synthetic Postgres", () => {
  it("records the five Tier 0 proposals with the DB, within KPI A's 5 min", async () => {
    const target = await seedPublic(url as string);
    const { d1, ledger } = memoryD1();

    const attachedAt = performance.now();
    const result = await connectByoDb(
      {
        resolve: async () => ["93.184.216.34"],
        kek: "test-kek-this-is-a-high-entropy-string-aaaa",
        d1,
        randomSuffix: () => "syn001",
        buildClickhouseQuery: () => async () => ({ rows: [] }),
        buildPostgresQuery: () =>
          openByoPostgres(target, {
            driver: (u) => postgres(u, { max: 1, prepare: false, fetch_types: false }) as never,
          }),
      },
      {
        engine: "postgres",
        connectionUrl: "postgres://app:secret@db.example.com:5432/app",
        tenantId: "user_synth",
      },
    );
    const kpiAMs = performance.now() - attachedAt;
    // biome-ignore lint/suspicious/noConsole: the KPI A reading belongs in the CI log
    console.log(
      `KPI A (synthetic, attach door): connection string → proposals in the ledger ${kpiAMs.toFixed(1)} ms`,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposals.map((p) => `${p.table}(${p.columns.join(",")})`)).toEqual([
      "comments(post_id)",
      "posts(author_id)",
      "deployments(tenant_id,region)",
      "memberships(tenant_id,region)",
      "memberships(user_id)",
    ]);
    expect(result.proposals.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(ledger.map((row) => row[3])).toEqual(result.proposals.map((p) => p.ddl));
    expect(kpiAMs).toBeLessThan(5 * 60_000);
  });
});
