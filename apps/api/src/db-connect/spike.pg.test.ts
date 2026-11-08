// The Postgres spike's attach (`GLOBAL-043` item 10, roadmap item 1b): the
// attach door on the founder-picked real-traffic Postgres, read-only. Runs only
// when `SPIKE_ATTACH_URL` is set: CI's `spike-attach` job maps the
// `SPIKE_PG_URL` secret to it, so a shell that merely holds the secret keeps
// `bun run test` offline. The ledger is an in-memory copy of the api's D1, so
// nothing is recorded in production, and nothing is written to the spike DB —
// introspection, Tier 0's catalog reads, one `pg_stat_statements` read and
// `EXPLAIN` (no ANALYZE) for Tier 1. The secret's role can write, so every
// statement also runs in a server-side READ ONLY transaction.
//
// It prints KPI A on a real DB (connection string → proposals in the ledger)
// and whether Tier 1 can read the workload under the secret's role. CI logs are
// public: only counts and timings are printed, never a table, column or query.

import { promises as dns } from "node:dns";
import {
  newTier1Funnel,
  observePostgresWorkload,
  openByoPostgres,
  snapshotPostgresStatements,
  statementWindow,
} from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { connectByoDb } from "./connect.ts";
import { sqliteD1 } from "./test-sqlite-d1.ts";

const url = process.env["SPIKE_ATTACH_URL"];

// Schemas a managed host (Supabase, Neon, RDS) or an extension owns: the
// statements naming only these are the host's, never the app's.
const HOST_SCHEMAS = new Set([
  "auth",
  "storage",
  "realtime",
  "_realtime",
  "_analytics",
  "supabase_functions",
  "supabase_migrations",
  "extensions",
  "graphql",
  "graphql_public",
  "vault",
  "pgsodium",
  "pgsodium_masks",
  "net",
  "cron",
  "pgbouncer",
  "pg_catalog",
  "information_schema",
]);

const USER_RELATIONS_SQL = `
SELECT n.nspname, c.relname FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p', 'v', 'm') AND n.nspname NOT LIKE 'pg\\_%'`;

const IDENTS = /[A-Za-z_][\w$]*|"(?:[^"]|"")+"/g;
const LEADING_NOISE = /^(?:\s+|--[^\n]*\n|\/\*[\s\S]*?\*\/|\()*/;

// Why a fingerprint isn't a public-schema Tier 1 candidate (or that it is), as a bucket name
// safe for a public log: its leading SQL keyword, or which schemas it names.
// `relationsBySchema` maps a relation name to the schemas holding it.
function skipBucket(query: string, relationsBySchema: Map<string, Set<string>>): string {
  const verb = /^[A-Za-z]+/.exec(query.replace(LEADING_NOISE, ""))?.[0]?.toUpperCase() ?? "?";
  if (!/^\s*(SELECT|UPDATE|DELETE|WITH)\b/i.test(query))
    return /^(SELECT|UPDATE|DELETE|WITH)$/.test(verb) ? "comment-prefixed" : `verb:${verb}`;
  if (query.includes(";")) return "multi-statement";
  const schemas = new Set<string>();
  for (const [id] of query.matchAll(IDENTS)) {
    const name = id.startsWith('"') ? id.slice(1, -1).replaceAll('""', '"') : id.toLowerCase();
    for (const s of relationsBySchema.get(name) ?? []) schemas.add(s);
  }
  if (schemas.has("public")) return "public-candidate";
  if ([...schemas].some((s) => !HOST_SCHEMAS.has(s))) return "names-other-app-schema";
  return schemas.size > 0 ? "names-host-schema-only" : "names-no-relation";
}

// The BYO transport, each statement its own `BEGIN READ ONLY` transaction, so a
// write anywhere in the attach path fails on the server instead of landing.
const openReadOnly = (raw: string) => openByoPostgres(raw, { readOnly: true });

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
      const funnel = newTier1Funnel();
      const tier1 = await observePostgresWorkload(conn.query, "public", window, funnel);
      const { rows: version } = await conn.query("SHOW server_version_num", []);
      // biome-ignore lint/suspicious/noConsole: the Tier 1 reading belongs in the CI log
      console.log(
        `Tier 1 (spike, cumulative since the stats reset, server ${version[0]?.["server_version_num"]}): ${snapshot.size} fingerprints readable, ${window.length} with calls, ${funnel.candidates} explainable naming a public relation, ${tier1.length} proposals; funnel ${JSON.stringify(funnel)}`,
      );

      // Where the fingerprints Tier 1 skips go, weighted by their exec time —
      // the lead after every public filter read unselective (run 280).
      const { rows: rels } = await conn.query(USER_RELATIONS_SQL, []);
      const relationsBySchema = new Map<string, Set<string>>();
      for (const r of rels) {
        const name = String(r["relname"]);
        const set = relationsBySchema.get(name) ?? new Set<string>();
        set.add(String(r["nspname"]));
        relationsBySchema.set(name, set);
      }
      const totalMs = window.reduce((sum, w) => sum + w.totalMs, 0);
      const buckets = new Map<string, { n: number; ms: number }>();
      const otherSchemas = new Set<string>();
      for (const w of window) {
        const b = skipBucket(w.query, relationsBySchema);
        const acc = buckets.get(b) ?? { n: 0, ms: 0 };
        acc.n++;
        acc.ms += w.totalMs;
        buckets.set(b, acc);
        if (b === "names-other-app-schema")
          for (const [id] of w.query.matchAll(IDENTS))
            for (const s of relationsBySchema.get(id.toLowerCase()) ?? [])
              if (s !== "public" && !HOST_SCHEMAS.has(s)) otherSchemas.add(s);
      }
      const share = (ms: number) => `${((100 * ms) / (totalMs || 1)).toFixed(1)} % of exec time`;
      // biome-ignore lint/suspicious/noConsole: the skipped-fingerprint split belongs in the CI log
      console.log(
        `Tier 1 skips (spike): ${[...buckets]
          .sort((a, b) => b[1].ms - a[1].ms)
          .map(([k, v]) => `${k} ${v.n} (${share(v.ms)})`)
          .join(
            ", ",
          )}; non-host schemas other than public with relations ${new Set([...relationsBySchema.values()].flatMap((s) => [...s]).filter((s) => s !== "public" && !HOST_SCHEMAS.has(s))).size}, named by skipped fingerprints ${otherSchemas.size}`,
      );
      // Tier 1 run on each such schema, numbered, never named.
      let i = 0;
      for (const schema of otherSchemas) {
        const f = newTier1Funnel();
        const p = await observePostgresWorkload(conn.query, schema, window, f);
        // biome-ignore lint/suspicious/noConsole: the per-schema Tier 1 reading belongs in the CI log
        console.log(
          `Tier 1 (spike, other app schema #${++i}): ${p.length} proposals; funnel ${JSON.stringify(f)}`,
        );
      }

      const { rows } = await conn.query("SHOW transaction_read_only", []);
      expect(rows[0]?.["transaction_read_only"]).toBe("on");
    } finally {
      await conn.close();
    }
  }, 120_000);
});
