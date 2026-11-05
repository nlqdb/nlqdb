// The Postgres spike's attach (`GLOBAL-043` item 10, roadmap item 1b): the
// attach door on the founder-picked real-traffic Postgres, read-only. Runs only
// when `SPIKE_ATTACH_URL` is set: CI's `spike-attach` job maps the
// `SPIKE_PG_URL` secret to it, so a shell that merely holds the secret keeps
// `bun run test` offline. The ledger is an in-memory copy of the api's D1, so
// nothing is recorded in production, and nothing is written to the spike DB —
// introspection, Tier 0's catalog reads, one `pg_stat_statements` read and
// `EXPLAIN` (no ANALYZE) for Tier 1. The secret's role can write, so every
// session is also set READ ONLY server-side.
//
// It prints KPI A on a real DB (connection string → proposals in the ledger)
// and whether Tier 1 can read the workload under the secret's role. CI logs are
// public: only counts and timings are printed, never a table, column or query.

import { promises as dns } from "node:dns";
import {
  type ByoPostgresConnection,
  observePostgresWorkload,
  openByoPostgres,
  snapshotPostgresStatements,
  statementWindow,
} from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { connectByoDb } from "./connect.ts";
import { sqliteD1 } from "./test-sqlite-d1.ts";

const url = process.env["SPIKE_ATTACH_URL"];

// The BYO transport with the session made read-only before its first query, so
// a write anywhere in the attach path fails on the server instead of landing.
function openReadOnly(raw: string): ByoPostgresConnection {
  const conn = openByoPostgres(raw);
  let readOnly: Promise<unknown> | undefined;
  return {
    ...conn,
    query: async (text, params, signal) => {
      readOnly ??= conn.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY", []);
      await readOnly;
      return conn.query(text, params, signal);
    },
  };
}

describe.skipIf(!url)("the attach door on the spike Postgres (read-only)", () => {
  it("records Tier 0 proposals within KPI A's 5 min and reads the workload Tier 1 plans from", async () => {
    const spikeUrl = url as string;
    const deps = {
      resolve: async (host: string) =>
        (await dns.lookup(host, { all: true, family: 4 })).map((a) => a.address),
      kek: "spike-kek-in-memory-ledger-only-never-persisted",
      d1: sqliteD1(),
      randomSuffix: () => "spike1",
      buildClickhouseQuery: () => async () => ({ rows: [] }),
      buildPostgresQuery: openReadOnly,
    };

    const attachedAt = performance.now();
    const result = await connectByoDb(deps, {
      engine: "postgres",
      connectionUrl: spikeUrl,
      tenantId: "user_spike",
    });
    const kpiAMs = performance.now() - attachedAt;
    if (!result.ok) throw new Error(`attach refused: ${result.status} ${result.message}`);
    // biome-ignore lint/suspicious/noConsole: the KPI A reading belongs in the CI log
    console.log(
      `KPI A (spike, real DB, attach door): connection string → ${result.proposals.length} Tier 0 proposals in the ledger ${kpiAMs.toFixed(1)} ms`,
    );
    expect(kpiAMs).toBeLessThan(5 * 60_000);

    // Tier 1's input: the cumulative counters since the last stats reset,
    // planned as one window. The `dba_observe` job diffs two snapshots instead.
    const conn = openReadOnly(spikeUrl);
    try {
      const snapshot = await snapshotPostgresStatements(conn.query, "public");
      const window = statementWindow(new Map(), snapshot);
      const tier1 = await observePostgresWorkload(conn.query, "public", window);
      // biome-ignore lint/suspicious/noConsole: the Tier 1 reading belongs in the CI log
      console.log(
        `Tier 1 (spike, cumulative since the stats reset): ${snapshot.size} fingerprints readable, ${window.length} with calls, ${tier1.length} proposals`,
      );
      const { rows } = await conn.query("SHOW transaction_read_only", []);
      expect(rows[0]?.["transaction_read_only"]).toBe("on");
    } finally {
      await conn.close();
    }
  }, 120_000);
});
