// rateme12's attach (`GLOBAL-043` roadmap 1b, `002-rateme12-attach.md` §3
// step 1): the attach door on the real rateme12 D1, read-only. The live cases
// run only when the `RATEME12_ATTACH_*` triple is set: CI's `rateme12-attach`
// job maps the `RATEME12_D1_*` secrets to it, so a shell that merely holds the
// secrets keeps `bun run test` offline. The ledger is an in-memory copy of the
// api's D1, so nothing is recorded in production, and every statement sent to
// rateme12 must be one read (`SELECT`, `EXPLAIN`, a catalog `PRAGMA`) or it is
// refused before it leaves — the token may write, the attach must not. The
// guard's own case runs offline on a local D1.
//
// Two reads, two token scopes: the workload (GraphQL, Account Analytics Read)
// as the `dba_observe` job's first tick reads it, and the attach door (REST,
// D1 Read) with KPI A. CI logs are public: counts and timings only, never a
// table, column or query.

import {
  D1_TIER1_STAGES,
  type D1BatchFn,
  D1RestError,
  type D1Target,
  type D1Tier1Funnel,
  d1RestBatch,
  d1WorkloadCandidates,
  newD1Tier1Funnel,
  observeD1Workload,
  readD1QueryInsights,
} from "@nlqdb/db";
import { afterAll, describe, expect, it } from "vitest";
import { D1_TARGET, localD1 } from "../../../../packages/db/test/fixtures/local-d1.ts";
import { OBSERVE_WINDOW_SEC } from "../dba-observe.ts";
import { isoHour } from "../dba-verbs.ts";
import { connectByoDb } from "./connect.ts";
import { sqliteD1 } from "./test-sqlite-d1.ts";

const env = process.env;
// Trimmed: a secret pasted with a trailing newline is still the same id.
const token = env["RATEME12_ATTACH_TOKEN"]?.trim();
const accountId = env["RATEME12_ATTACH_ACCOUNT_ID"]?.trim();
const databaseId = env["RATEME12_ATTACH_DATABASE_ID"]?.trim();
const target: D1Target | null =
  token && accountId && databaseId ? { token, accountId, databaseId } : null;

// A read: one `SELECT`, `EXPLAIN …`, or catalog `PRAGMA` the observer sends
// (a `PRAGMA x(v)` sets `x` for setter pragmas, so the names are listed), and
// nothing after a `;` — D1 runs every statement in one `sql` string.
const READ =
  /^\s*(?:(?:SELECT|EXPLAIN)\b|PRAGMA\s+(?:table_list|table_info|table_xinfo|index_list|index_info|index_xinfo|foreign_key_list)\b(?:\s*\([^)]*\))?\s*;?\s*$)/i;
const isRead = (sql: string): boolean => READ.test(sql) && !/;\s*\S/.test(sql);

// The REST client, refusing any batch that holds a statement other than a read.
function readOnlyBatch(
  t: D1Target,
  sent: { requests: number },
  fetchFn: typeof fetch = fetch,
): D1BatchFn {
  const batch = d1RestBatch(t, fetchFn);
  return (statements) => {
    if (!statements.every(isRead))
      throw new Error("refused: a non-read statement in the attach path");
    sent.requests++;
    return batch(statements);
  };
}

// The door's deps with an in-memory ledger; `buildD1Batch` is the guarded client.
const doorDeps = (buildD1Batch: (t: D1Target) => D1BatchFn) => ({
  resolve: async () => {
    throw new Error("a D1 attach resolves no host");
  },
  kek: "rateme12-kek-in-memory-ledger-only-never-persisted",
  d1: sqliteD1(),
  randomSuffix: () => "rm12a1",
  buildClickhouseQuery: () => {
    throw new Error("not a ClickHouse attach");
  },
  buildPostgresQuery: () => {
    throw new Error("not a Postgres attach");
  },
  buildD1Batch,
});

// The guard offline, on a local D1: every statement the door and Tier 1 send
// passes it — so the live case can't go red on the guard once the token is
// granted — and writes, setter pragmas and trailing statements are refused.
describe("the rateme12 read guard", () => {
  const userD1 = localD1();
  afterAll(() => userD1.dispose());

  it("passes the door's and Tier 1's statements; refuses writes", async () => {
    const { fetchFn } = await userD1.open(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id));
    `);
    const sent = { requests: 0 };
    const guarded = (t: D1Target) => readOnlyBatch(t, sent, fetchFn);
    const result = await connectByoDb(doorDeps(guarded), {
      engine: "d1",
      d1: D1_TARGET,
      tenantId: "user_rateme12",
      name: "rateme12",
    });
    expect(result.ok && result.proposals.map((p) => p.table)).toEqual(["posts"]);
    const tier1 = await observeD1Workload(guarded(D1_TARGET), [
      {
        query: "SELECT id FROM users WHERE email = ?",
        calls: 400,
        meanMs: 1.2,
        rowsRead: 100,
        rowsReturned: 1,
        rowsWritten: 0,
        totalRowsRead: 40_000,
      },
    ]);
    expect(tier1.map((p) => `${p.table}(${p.columns.join(",")})`)).toEqual(["users(email)"]);
    expect(sent.requests).toBeGreaterThan(0);
    for (const sql of [
      "CREATE INDEX i ON users(email)",
      "PRAGMA optimize",
      "PRAGMA user_version(5)",
      "PRAGMA foreign_keys = ON",
      "SELECT 1; DROP TABLE users",
      "EXPLAIN QUERY PLAN SELECT 1; DELETE FROM users",
    ])
      expect(isRead(sql), sql).toBe(false);
  });
});

// Each non-empty stage as `stage texts/share of rows read`, heaviest first.
function funnelLine(funnel: D1Tier1Funnel): string {
  const total = D1_TIER1_STAGES.reduce((sum, s) => sum + funnel[s].rowsRead, 0);
  return D1_TIER1_STAGES.filter((s) => funnel[s].texts > 0)
    .sort((a, b) => funnel[b].rowsRead - funnel[a].rowsRead)
    .map(
      (s) => `${s} ${funnel[s].texts}/${((100 * funnel[s].rowsRead) / (total || 1)).toFixed(1)} %`,
    )
    .join(", ");
}

const log = (line: string) =>
  // biome-ignore lint/suspicious/noConsole: the rateme12 readings belong in the CI log
  console.log(`rateme12 (real D1): ${line}`);

// A malformed id is a secret to re-set, not a red build on every PR: the case
// skips with the id named (never its value).
function targetOrSkip(ctx: { skip: () => never }): D1Target {
  const t = target as D1Target;
  try {
    d1RestBatch(t);
  } catch (err) {
    log(`attach blocked: a RATEME12_D1_* secret is malformed (${(err as Error).message})`);
    ctx.skip();
  }
  return t;
}

describe.skipIf(!target)("the attach door on rateme12's real D1", () => {
  it("reads the workload Tier 1 plans from (Account Analytics Read)", async (ctx) => {
    const t = targetOrSkip(ctx);
    const nowSec = Math.floor(Date.now() / 1000);
    for (const days of [1, 7]) {
      const window = {
        since: isoHour(nowSec - days * OBSERVE_WINDOW_SEC),
        until: isoHour(nowSec),
      };
      const at = performance.now();
      const insights = await readD1QueryInsights(t, window);
      const ms = performance.now() - at;
      const calls = insights.reduce((s, i) => s + i.calls, 0);
      const rowsRead = insights.reduce((s, i) => s + i.totalRowsRead, 0);
      // Before the plan, with no request: the rest is `candidates`.
      const funnel = newD1Tier1Funnel();
      const candidates = d1WorkloadCandidates(insights, funnel);
      log(
        `workload, last ${days * 24} h (sampled): ${insights.length} query texts, ${calls} calls, ${rowsRead} rows read, read in ${ms.toFixed(1)} ms; ${candidates.length} Tier 1 candidates; ${funnelLine(funnel)}`,
      );
    }
  }, 60_000);

  it("records Tier 0 proposals within KPI A's 5 min, then Tier 1's (D1 Read)", async (ctx) => {
    const t = targetOrSkip(ctx);
    const sent = { requests: 0 };
    // The door folds every catalog failure into one 502; name the scope here.
    try {
      await readOnlyBatch(t, sent)(["PRAGMA table_list"]);
    } catch (err) {
      if (err instanceof D1RestError && err.status === 403) {
        log(`attach blocked: the D1 query endpoint refuses the token (${err.message})`);
        ctx.skip();
      }
      throw err;
    }
    const deps = doorDeps((x) => readOnlyBatch(x, sent));

    const attachedAt = performance.now();
    const result = await connectByoDb(deps, {
      engine: "d1",
      d1: t,
      tenantId: "user_rateme12",
      name: "rateme12",
    });
    const kpiAMs = performance.now() - attachedAt;
    if (!result.ok) throw new Error(`attach refused: ${result.status} ${result.message}`);
    const tables = (result.schemaPreview.match(/CREATE TABLE/g) ?? []).length;
    log(
      `KPI A (attach door): credentials → ${result.proposals.length} Tier 0 proposals in the ledger ${kpiAMs.toFixed(1)} ms; ${tables} tables; ${sent.requests} read-only REST requests`,
    );
    expect(kpiAMs).toBeLessThan(5 * 60_000);

    // Tier 1 as the `dba_observe` job's first tick after attach reads it.
    const nowSec = Math.floor(Date.now() / 1000);
    const window = { since: isoHour(nowSec - OBSERVE_WINDOW_SEC), until: isoHour(nowSec) };
    const at = performance.now();
    const funnel = newD1Tier1Funnel();
    const tier1 = await observeD1Workload(
      readOnlyBatch(t, sent),
      await readD1QueryInsights(t, window),
      funnel,
    );
    log(
      `Tier 1 (last 24 h): ${tier1.length} proposals in ${(performance.now() - at).toFixed(1)} ms; ${funnelLine(funnel)}`,
    );
    for (const p of tier1) {
      const w = p.evidence.d1Workload;
      log(
        `Tier 1 proposal: ${p.columns.length} key column(s); ${w?.calls} calls, mean ${w?.meanMs.toFixed(3)} ms, ${w?.rowsRead.toFixed(1)} rows read / ${w?.rowsReturned.toFixed(1)} returned per run`,
      );
    }
  }, 120_000);
});
