// The spike's apply step (`spike-apply.ts`) on a synthetic Postgres before it
// ever runs on the spike: it defers when busy or with nothing to apply,
// applies one index with its counters, re-reads the fingerprint after the
// apply, keeps a faster index once the window passed, reverts a regression
// (and finishes a revert a cancelled run left half done), and never applies
// a second index. Runs only when `PG_TEST_URL` is set (CI's
// `test-dba-postgres` job).

import { createRequire } from "node:module";
import { createIndexProposal, openByoPostgres, snapshotPostgresStatements } from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { VERIFY_WINDOW_SEC } from "../dba-verbs.ts";
import { readNote, spikeApplyStep } from "./spike-apply.ts";

type Sql = {
  unsafe: (q: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  begin: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>;
  end: () => Promise<void>;
};
const postgres = createRequire(new URL("../../../../packages/db/package.json", import.meta.url))(
  "postgres",
) as (url: string, opts: Record<string, unknown>) => Sql;

const url = process.env["PG_TEST_URL"];
const DB = "spike_apply_synth";
const LOOKUP = "SELECT id FROM events WHERE at > $1";

async function seed(adminUrl: string): Promise<string> {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE ${DB}`);
  await admin.end();
  const target = new URL(adminUrl);
  target.pathname = `/${DB}`;
  const sql = postgres(target.href, { max: 1, onnotice: () => {} });
  await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
  await sql.unsafe("CREATE TABLE events (id serial PRIMARY KEY, at int NOT NULL, body text)");
  await sql.unsafe(
    "INSERT INTO events (at, body) SELECT g, repeat('x', 200) FROM generate_series(1, 50000) g",
  );
  await sql.unsafe("ANALYZE events");
  await sql.end();
  return target.href;
}

// The app's hot lookup: a range the last few rows match.
async function runLookups(target: string, n: number) {
  const app = postgres(target, { max: 1, prepare: false, onnotice: () => {} });
  for (let i = 0; i < n; i++) await app.unsafe(LOOKUP, [49_990]);
  await app.end();
}

describe.skipIf(!url)("the spike's apply step on a synthetic Postgres", () => {
  it("defers when busy, applies one index with its counters, keeps a faster one, reverts a regression, and never applies a second", async () => {
    const target = await seed(url as string);
    await runLookups(target, 40);
    const conn = openByoPostgres(target, {
      driver: (u) => postgres(u, { max: 1, prepare: false, fetch_types: false }) as never,
    });
    try {
      const snapshot = await snapshotPostgresStatements(conn.query, "public");
      const [fingerprint, before] = [...snapshot].find(([, c]) => c.query.startsWith(LOOKUP)) ?? [];
      if (!fingerprint || !before) throw new Error("the lookup's fingerprint was not recorded");
      const mean = before.totalMs / before.calls;
      const proposal = createIndexProposal({
        tier: 1,
        schema: "public",
        table: "events",
        columns: ["at"],
        reason: "synthetic",
        evidence: {
          rowEstimate: 50_000,
          tableBytes: 0,
          workload: { fingerprint, calls: before.calls, meanMs: mean, p95EstimateMs: mean * 2 },
        },
      });
      const now = Math.floor(Date.now() / 1000);

      expect(await spikeApplyStep(conn.query, [], now)).toEqual({
        step: "deferred",
        reason: "no Tier 1 proposal",
      });
      // A transaction left open elsewhere would hold `CONCURRENTLY` up.
      const other = postgres(target, { max: 1, onnotice: () => {} });
      let release = () => {};
      const held = other.begin(async (tx) => {
        await tx.unsafe("SELECT 1");
        await new Promise<void>((r) => {
          release = r;
        });
      });
      await new Promise((r) => setTimeout(r, 50));
      const busy = await spikeApplyStep(conn.query, [proposal], now, {
        maxActive: 5,
        longXactSec: 0,
      });
      release();
      await held;
      await other.end();
      expect(busy).toMatchObject({ step: "deferred" });
      expect(busy.step === "deferred" && busy.reason).toMatch(/^busy: /);

      const applied = await spikeApplyStep(conn.query, [proposal], now);
      expect(applied).toMatchObject({ step: "applied" });
      if (applied.step !== "applied") throw new Error("not applied");
      expect(applied.note.verifyFrom.calls).toBeGreaterThanOrEqual(before.calls);

      // Inside the window: a reading, no verdict.
      await runLookups(target, 40);
      const early = await spikeApplyStep(conn.query, [proposal], now + 60);
      expect(early).toMatchObject({ step: "measured", ageSec: 60, valid: true });
      if (early.step !== "measured") throw new Error("not measured");
      expect(early.after?.calls).toBe(40);
      expect(early.verification).toBeUndefined();

      // After it: the index serves the lookup faster than the scan did — kept, once.
      const judged = await spikeApplyStep(conn.query, [proposal], now + VERIFY_WINDOW_SEC);
      if (judged.step !== "measured") throw new Error("not measured");
      expect(judged.verification?.verdict).toBe("keep");
      const again = await spikeApplyStep(conn.query, [proposal], now + 2 * VERIFY_WINDOW_SEC);
      expect(again.step === "measured" && again.verification).toEqual(judged.verification);

      // A regression: the same index judged against an impossible before.
      const { rows } = await conn.query(
        "SELECT c.relname, obj_description(c.oid, 'pg_class') AS note FROM pg_class c WHERE c.relname LIKE 'nlqdb\\_%'",
        [],
      );
      const note = readNote(rows[0]?.["note"]);
      if (!note?.proposal.evidence.workload) throw new Error("no note on the index");
      note.proposal.evidence.workload.p95EstimateMs = 1e-6;
      delete note.verification;
      const { rows: ddl } = await conn.query(
        "SELECT format('COMMENT ON INDEX public.%I IS %L', $1::text, $2::text) AS ddl",
        [rows[0]?.["relname"], `nlqdb spike apply: ${JSON.stringify(note)}`],
      );
      await conn.query(String(ddl[0]?.["ddl"]), []);
      await runLookups(target, 10);
      const reverted = await spikeApplyStep(conn.query, [proposal], now + VERIFY_WINDOW_SEC);
      expect(reverted.step === "measured" && reverted.verification?.verdict).toBe("revert");
      const { rows: left } = await conn.query(
        "SELECT count(*)::int AS n FROM pg_class WHERE relname LIKE 'nlqdb\\_%'",
        [],
      );
      expect(left[0]?.["n"]).toBe(0);

      // A revert cut off mid-drop leaves the index under its revert verdict:
      // the next run finishes the drop instead of judging it afresh.
      await conn.query(proposal.ddl, []);
      const { rows: cut } = await conn.query(
        "SELECT format('COMMENT ON INDEX public.%I IS %L', $1::text, $2::text) AS ddl",
        [
          rows[0]?.["relname"],
          `nlqdb spike apply: ${JSON.stringify({ ...note, verification: reverted.step === "measured" && reverted.verification })}`,
        ],
      );
      await conn.query(String(cut[0]?.["ddl"]), []);
      const resumed = await spikeApplyStep(conn.query, [proposal], now + VERIFY_WINDOW_SEC);
      expect(resumed.step === "measured" && resumed.verification?.verdict).toBe("revert");
      const { rows: gone } = await conn.query(
        "SELECT count(*)::int AS n FROM pg_class WHERE relname LIKE 'nlqdb\\_%'",
        [],
      );
      expect(gone[0]?.["n"]).toBe(0);

      // One index ever: the reverted build is in the history.
      expect(await spikeApplyStep(conn.query, [proposal], now + VERIFY_WINDOW_SEC)).toMatchObject({
        step: "spent",
      });
    } finally {
      await conn.close();
      const admin = postgres(url as string, { max: 1, onnotice: () => {} });
      await admin.unsafe(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
      await admin.end();
    }
  }, 60_000);
});
