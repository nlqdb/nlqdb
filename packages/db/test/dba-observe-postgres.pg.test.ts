// Live check of the Tier 0 observer against a real Postgres seeded with the
// synthetic app schema (`GLOBAL-043` roadmap item 1a). Runs only when
// `PG_TEST_URL` is set — CI's `test-dba-postgres` job starts Postgres 16 with
// `pg_stat_statements` preloaded; the unit env has no Postgres and skips it.
// It also prints KPI A on the synthetic DB: attach → first proposal, in ms.

import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { observePostgresCatalog } from "../src/index.ts";
import { type ByoPostgresConnection, openByoPostgres } from "../src/postgres-byo.ts";

const url = process.env["PG_TEST_URL"];
const SCHEMA = "dba_synth";

describe.skipIf(!url)("observePostgresCatalog on the seeded synthetic DB", () => {
  let conn: ByoPostgresConnection;

  beforeAll(async () => {
    const seed = postgres(url as string, { max: 1, onnotice: () => {} });
    await seed.unsafe(
      readFileSync(new URL("./fixtures/dba-synthetic-seed.sql", import.meta.url), "utf8"),
    );
    await seed.end();
    // The production BYO transport, minus TLS (the CI Postgres is local).
    conn = openByoPostgres(url as string, {
      driver: (u) => postgres(u, { max: 1, prepare: false, fetch_types: false }) as never,
    });
  });

  afterAll(async () => {
    await conn?.close();
  });

  it("proposes exactly the unindexed FKs, within KPI A's 5 min, and apply / inverse round-trip", async () => {
    const attachedAt = performance.now();
    const proposals = await observePostgresCatalog(conn.query, SCHEMA);
    const kpiAMs = performance.now() - attachedAt;
    // biome-ignore lint/suspicious/noConsole: the KPI A reading belongs in the CI log
    console.log(`KPI A (synthetic, Tier 0): attach → first proposal ${kpiAMs.toFixed(1)} ms`);

    // comments.user_id is indexed; posts' partial index, deployments' (region)
    // index and memberships' INCLUDE and BRIN indexes don't cover their FKs;
    // partitioned events is skipped. So five proposals, largest first.
    expect(proposals.map((p) => `${p.table}(${p.columns.join(",")})`)).toEqual([
      "comments(post_id)",
      "posts(author_id)",
      "deployments(tenant_id,region)",
      "memberships(tenant_id,region)",
      "memberships(user_id)",
    ]);
    expect(kpiAMs).toBeLessThan(5 * 60_000);

    // Every DDL and inverse is valid Postgres: applying all clears the
    // findings, and running every inverse brings them back.
    for (const p of proposals) await conn.query(p.ddl, []);
    expect(await observePostgresCatalog(conn.query, SCHEMA)).toEqual([]);
    // A taken name fails loud rather than no-op under an inverse it doesn't own.
    await expect(conn.query(proposals[0]?.ddl as string, [])).rejects.toThrow(/already exists/);
    for (const p of proposals) await conn.query(p.inverse, []);
    expect(await observePostgresCatalog(conn.query, SCHEMA)).toHaveLength(5);
    // The inverses dropped only nlqdb's indexes, never the app's own.
    const { rows } = await conn.query(
      "SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = $1 AND indexname = 'posts_author_id_idx'",
      [SCHEMA],
    );
    expect(rows).toHaveLength(1);
  });
});
