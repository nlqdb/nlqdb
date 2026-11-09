// Live check of the Tier 0 observer against a real Postgres seeded with the
// synthetic app schema (`GLOBAL-043` roadmap item 1a). Runs only when
// `PG_TEST_URL` is set — CI's `test-dba-postgres` job starts Postgres 16 with
// `pg_stat_statements` preloaded; the unit env has no Postgres and skips it.
// It also prints KPI A on the synthetic DB (attach → first proposal, in ms),
// the Tier 1 hot fingerprints' p95 estimate before / after their index (KPI B)
// and the injected regression's auto-revert (KPI C).

import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyProposal,
  type FingerprintWindow,
  newTier1Funnel,
  observePostgresCatalog,
  observePostgresWorkload,
  snapshotPostgresStatements,
  statementWindow,
  verifyApplied,
} from "../src/index.ts";
import { type ByoPostgresConnection, openByoPostgres } from "../src/postgres-byo.ts";

const url = process.env["PG_TEST_URL"];
const SCHEMA = "dba_synth";

describe.skipIf(!url)("the Postgres observers on the seeded synthetic DB", () => {
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

  // The synthetic app's workload: four hot lookups on unindexed columns (the
  // third an ORM's `IN` list, planned as `= ANY (ARRAY[…])`, the fourth a
  // 3-day `BETWEEN`), and five decoys an index on the column wouldn't help — a
  // filter keeping 25 % of its table, a lookup already served by
  // comments_user_id_idx, a bigint compared as text, a one-sided range under
  // a count (its rows unmeasured), and a `BETWEEN` the generic plan guesses
  // keeps 0.5 % but the app passes ~90 % of the table.
  const HOT = [
    "SELECT id FROM dba_synth.posts WHERE title = $1",
    "SELECT id FROM dba_synth.users WHERE email = $1",
    "SELECT id FROM dba_synth.posts WHERE author_id IN ($1, $2, $3)",
    "SELECT id FROM dba_synth.posts WHERE published_at BETWEEN $1 AND $2",
  ];
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + (n % 362))).toISOString().slice(0, 10);
  async function runWorkload(): Promise<FingerprintWindow[]> {
    const before = await snapshotPostgresStatements(conn.query, SCHEMA);
    for (let i = 0; i < 300; i++) {
      await conn.query(HOT[0] as string, [`post ${1 + ((i * 37) % 20000)}`]);
      await conn.query(HOT[1] as string, [`u${1 + ((i * 7) % 2000)}@example.com`]);
      await conn.query(HOT[2] as string, [
        1 + (i % 2000),
        1 + ((i * 7) % 2000),
        1 + ((i * 13) % 2000),
      ]);
      await conn.query(HOT[3] as string, [day(i * 11), day(i * 11 + 2)]);
      await conn.query("SELECT count(*) FROM dba_synth.posts WHERE published_at > $1", [
        day(i * 11),
      ]);
      await conn.query("SELECT count(*) FROM dba_synth.memberships WHERE region = $1", [
        `r${i % 4}`,
      ]);
      await conn.query("SELECT body FROM dba_synth.comments WHERE user_id = $1", [1 + (i % 2000)]);
      await conn.query("SELECT body FROM dba_synth.comments WHERE post_id BETWEEN $1 AND $2", [
        1 + (i % 2000),
        18000 + (i % 2000),
      ]);
      await conn.query("SELECT at FROM dba_synth.events WHERE user_id = $1", [1 + (i % 2000)]);
      await conn.query("SELECT id FROM dba_synth.posts WHERE author_id::text = $1", [
        String(1 + (i % 2000)),
      ]);
    }
    return statementWindow(before, await snapshotPostgresStatements(conn.query, SCHEMA));
  }
  const hot = (window: FingerprintWindow[], sql: string) =>
    window.find((w) => w.query === sql) as FingerprintWindow;

  it("proposes an index for each hot seq-scanned lookup; applied, verify keeps it on its p95 cut", async () => {
    await conn.query("SELECT pg_stat_statements_reset()", []);
    const before = await runWorkload();
    const funnel = newTier1Funnel();
    const proposals = await observePostgresWorkload(conn.query, SCHEMA, before, funnel);
    // The selective lookup on partitioned events waits for the parent's index.
    expect(funnel.partitions).toBe(1);
    // The three ranges are read: the `count(*)` one is left unjudged, and the
    // wide `BETWEEN` judged on its measured rows per call, not the plan's 0.5 %.
    expect(funnel.rangeScans).toBe(3);
    expect(funnel.unjudgedRanges).toBe(1);
    const wide = funnel.unselectivePct.find((pct) => pct > 80);
    // biome-ignore lint/suspicious/noConsole: the range's measured share belongs in the CI log
    console.log(`Tier 1 (synthetic): wide parameter-bound BETWEEN judged at ${wide} % of comments`);
    expect(wide).toBeDefined();
    // Heaviest first, so the order follows the run's timings: compare as a set.
    expect(proposals.map((p) => `${p.table}(${p.columns.join(",")}) t${p.tier}`).sort()).toEqual([
      "posts(author_id) t1",
      "posts(published_at) t1",
      "posts(title) t1",
      "users(email) t1",
    ]);
    // The spike's read-only transport plans the same `$1` fingerprints.
    const ro = openByoPostgres(url as string, {
      driver: (u) => postgres(u, { max: 1, prepare: false, fetch_types: false }) as never,
      readOnly: true,
    });
    try {
      const roProposals = await observePostgresWorkload(ro.query, SCHEMA, before);
      expect(roProposals.map((p) => p.ddl)).toEqual(proposals.map((p) => p.ddl));
    } finally {
      await ro.close();
    }
    expect(proposals.find((p) => p.columns[0] === "title")?.evidence.workload).toMatchObject({
      fingerprint: hot(before, HOT[0] as string).fingerprint,
      calls: 300,
    });

    for (const p of proposals) await applyProposal(conn.query, p);
    const after = await runWorkload();
    let kept = 0;
    for (const p of proposals) {
      const v = await verifyApplied(conn.query, p, after);
      // biome-ignore lint/suspicious/noConsole: the KPI B reading belongs in the CI log
      console.log(`KPI B (synthetic) ${p.table}(${p.columns}): ${JSON.stringify(v)}`);
      expect(v.verdict).toBe("keep");
      if (v.verdict === "keep") expect(v.afterP95Ms).toBeLessThan(v.beforeP95Ms);
      kept++;
    }
    // biome-ignore lint/suspicious/noConsole: the KPI B reading belongs in the CI log
    console.log(`KPI B (synthetic): ${kept}/${proposals.length} applied and kept on a p95 cut`);
    // Served now: the next window proposes nothing.
    expect(await observePostgresWorkload(conn.query, SCHEMA, after)).toEqual([]);
    for (const p of proposals) await conn.query(p.inverse, []);
  }, 30_000);

  it("auto-reverts an apply whose fingerprint regressed in the verify window", async () => {
    await conn.query("SELECT pg_stat_statements_reset()", []);
    const proposal = (await observePostgresWorkload(conn.query, SCHEMA, await runWorkload())).find(
      (p) => p.table === "posts" && p.columns[0] === "title",
    );
    if (!proposal) throw new Error("no proposal to apply");
    await applyProposal(conn.query, proposal);
    // The regression is injected, not caused by the index: JIT forced on every
    // statement adds compile time to each run of the fingerprint. Verify judges
    // the counters, never the cause — the same as a production regression.
    const { rows: jit } = await conn.query("SELECT pg_jit_available() AS ok", []);
    expect(jit[0]?.["ok"]).toBe(true);
    for (const knob of ["jit_above_cost", "jit_inline_above_cost", "jit_optimize_above_cost"]) {
      await conn.query(`SET ${knob} = 0`, []);
    }
    const from = await snapshotPostgresStatements(conn.query, SCHEMA);
    for (let i = 0; i < 30; i++) await conn.query(HOT[0] as string, [`post ${1 + i * 37}`]);
    const after = statementWindow(from, await snapshotPostgresStatements(conn.query, SCHEMA));
    await conn.query("RESET ALL", []);
    const v = await verifyApplied(conn.query, proposal, after);
    // biome-ignore lint/suspicious/noConsole: the KPI C reading belongs in the CI log
    console.log(`KPI C (synthetic, injected regression): ${JSON.stringify(v)}`);
    expect(v.verdict).toBe("revert");
    // The inverse ran: the index is gone and the finding is back.
    const { rows } = await conn.query(
      "SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = $1 AND indexname LIKE 'nlqdb_%'",
      [SCHEMA],
    );
    expect(rows).toEqual([]);
    // biome-ignore lint/suspicious/noConsole: the KPI C reading belongs in the CI log
    console.log("KPI C (synthetic): 1/1 regressions auto-reverted");
  }, 30_000);
});
