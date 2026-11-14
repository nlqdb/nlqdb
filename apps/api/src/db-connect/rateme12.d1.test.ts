// rateme12's attach (`GLOBAL-043` roadmap 1b, `002-rateme12-attach.md` §3
// step 1): the attach door on the real rateme12 D1, read-only. Runs only when
// the `RATEME12_ATTACH_*` triple is set: CI's `rateme12-attach` job maps the
// `RATEME12_D1_*` secrets to it, so a shell that merely holds the secrets keeps
// `bun run test` offline. The ledger is an in-memory copy of the api's D1, so
// nothing is recorded in production, and every statement sent to rateme12 must
// be a read (`SELECT`, `EXPLAIN`, a `PRAGMA` that sets nothing) or it is
// refused before it leaves — the token may write, the attach must not.
//
// Two reads, two token scopes: the workload (GraphQL, Account Analytics Read)
// as the `dba_observe` job's first tick reads it, and the attach door (REST,
// D1 Read) with KPI A. CI logs are public: counts and timings only, never a
// table, column or query.

import {
  type D1BatchFn,
  D1RestError,
  type D1Target,
  d1RestBatch,
  d1WorkloadCandidates,
  observeD1Workload,
  readD1QueryInsights,
} from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { OBSERVE_WINDOW_SEC } from "../dba-observe.ts";
import { isoHour } from "../dba-verbs.ts";
import { connectByoDb } from "./connect.ts";
import { sqliteD1 } from "./test-sqlite-d1.ts";

const env = process.env;
const token = env["RATEME12_ATTACH_TOKEN"];
const accountId = env["RATEME12_ATTACH_ACCOUNT_ID"];
const databaseId = env["RATEME12_ATTACH_DATABASE_ID"];
const target: D1Target | null =
  token && accountId && databaseId ? { token, accountId, databaseId } : null;

// A read: `SELECT`, `EXPLAIN …`, or a `PRAGMA` that sets nothing.
const READ = /^\s*(?:SELECT|EXPLAIN)\b|^\s*PRAGMA\s+[\w.]+(?:\s*\([^)]*\))?\s*;?\s*$/i;

// The REST client, refusing any batch that holds a statement other than a read.
function readOnlyBatch(t: D1Target, sent: { requests: number }): D1BatchFn {
  const batch = d1RestBatch(t);
  return (statements) => {
    if (statements.some((s) => !READ.test(s)))
      throw new Error("refused: a non-read statement in the attach path");
    sent.requests++;
    return batch(statements);
  };
}

const log = (line: string) =>
  // biome-ignore lint/suspicious/noConsole: the rateme12 readings belong in the CI log
  console.log(`rateme12 (real D1): ${line}`);

describe.skipIf(!target)("the attach door on rateme12's real D1", () => {
  it("reads the workload Tier 1 plans from (Account Analytics Read)", async () => {
    const t = target as D1Target;
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
      const candidates = d1WorkloadCandidates(insights);
      log(
        `workload, last ${days * 24} h (sampled): ${insights.length} query texts, ${calls} calls, ${rowsRead} rows read, read in ${ms.toFixed(1)} ms; ${candidates.length} Tier 1 candidates (one table, equality filter, ≤ 5 % of rows read kept)`,
      );
      for (const [i, { insight: q, filter }] of candidates.slice(0, 5).entries())
        log(
          `candidate #${i + 1}: ${filter.columns.length} key column(s); ${q.calls} calls, mean ${q.meanMs.toFixed(3)} ms, ${q.rowsRead.toFixed(1)} rows read / ${q.rowsReturned.toFixed(1)} returned per run, ${q.totalRowsRead} total`,
        );
    }
  }, 60_000);

  it("records Tier 0 proposals within KPI A's 5 min, then Tier 1's (D1 Read)", async (ctx) => {
    const t = target as D1Target;
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
    const deps = {
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
      buildD1Batch: (x: D1Target) => readOnlyBatch(x, sent),
    };

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
    const tier1 = await observeD1Workload(
      readOnlyBatch(t, sent),
      await readD1QueryInsights(t, window),
    );
    log(
      `Tier 1 (last 24 h): ${tier1.length} proposals in ${(performance.now() - at).toFixed(1)} ms`,
    );
    for (const p of tier1) {
      const w = p.evidence.d1Workload;
      log(
        `Tier 1 proposal: ${p.columns.length} key column(s); ${w?.calls} calls, mean ${w?.meanMs.toFixed(3)} ms, ${w?.rowsRead.toFixed(1)} rows read / ${w?.rowsReturned.toFixed(1)} returned per run`,
      );
    }
  }, 120_000);
});
