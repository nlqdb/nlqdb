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
import { decideProposal } from "../dba-verbs.ts";
import { connectByoDb } from "./connect.ts";

// The api never depends on a Postgres driver (`GLOBAL-021`, lockfile guard);
// test-time setup borrows the owner's copy, `@nlqdb/db`'s `postgres`.
type Sql = {
  unsafe: (q: string, params?: unknown[]) => Promise<unknown>;
  end: () => Promise<void>;
};
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

// What the door and the verbs issue against D1: the dbId probe, the attach
// batch, then each verb's row read and status flips — kept in memory.
function memoryD1() {
  let blob: unknown = null;
  type Entry = { params: unknown[]; status: string; decidedBy: unknown; reason: unknown };
  const ledger: Entry[] = [];
  const row = (id: number) => {
    const e = ledger[id - 1];
    if (!e) return null;
    return {
      id,
      dbId: e.params[0],
      status: e.status,
      proposal: e.params[5],
      blob,
      decidedBy: e.decidedBy,
      decidedAt: 1,
      rejectReason: e.reason,
    };
  };
  const statement = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      first: async () => (sql.startsWith("SELECT c.id") ? row(params[0] as number) : null),
      run: async () => {
        if (sql.startsWith("INSERT INTO databases")) blob = params[4];
        if (sql.startsWith("INSERT INTO dba_changes")) {
          ledger.push({ params, status: "proposed", decidedBy: null, reason: null });
          return { meta: { last_row_id: ledger.length } };
        }
        if (sql.startsWith("UPDATE dba_changes SET status = ?")) {
          const e = ledger[(params[3] as number) - 1];
          if (e?.status !== "proposed") return { meta: { changes: 0 } };
          Object.assign(e, { status: params[0], decidedBy: params[1], reason: params[2] });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE dba_changes SET status = 'proposed'")) {
          const e = ledger[(params[0] as number) - 1];
          if (e) Object.assign(e, { status: "proposed", decidedBy: null });
          return { meta: { changes: 1 } };
        }
        return { meta: { last_row_id: 0 } };
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
  it("records the five Tier 0 proposals with the DB within KPI A's 5 min, then applies four and rejects one", async () => {
    const target = await seedPublic(url as string);
    const { d1, ledger } = memoryD1();

    const deps = {
      resolve: async () => ["93.184.216.34"],
      kek: "test-kek-this-is-a-high-entropy-string-aaaa",
      d1,
      randomSuffix: () => "syn001",
      buildClickhouseQuery: () => async () => ({ rows: [] }),
      buildPostgresQuery: () =>
        openByoPostgres(target, {
          driver: (u) => postgres(u, { max: 1, prepare: false, fetch_types: false }) as never,
        }),
    };
    const attachedAt = performance.now();
    const result = await connectByoDb(deps, {
      engine: "postgres",
      connectionUrl: "postgres://app:secret@db.example.com:5432/app",
      tenantId: "user_synth",
    });
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
    expect(ledger.map((row) => row.params[3])).toEqual(result.proposals.map((p) => p.ddl));
    expect(kpiAMs).toBeLessThan(5 * 60_000);

    // The verbs (`GLOBAL-043` item 5) on the same rows: apply four through the
    // sealed URL, reject the fifth with a reason.
    const decideDeps = deps;
    const [rejected, ...applied] = [...result.proposals].reverse();
    const appliedAt = performance.now();
    for (const p of applied) {
      const r = await decideProposal(decideDeps, {
        id: p.id,
        tenantId: "user_synth",
        decidedBy: "sk_live:synth",
        verb: "apply",
      });
      expect(r).toMatchObject({ ok: true, proposal: { status: "applied" } });
    }
    const applyMs = (performance.now() - appliedAt) / applied.length;
    const r = await decideProposal(decideDeps, {
      id: (rejected as { id: number }).id,
      tenantId: "user_synth",
      decidedBy: "user:user_synth",
      verb: "reject",
      reason: "built offline",
    });
    expect(r).toMatchObject({ ok: true, proposal: { status: "rejected" } });
    // biome-ignore lint/suspicious/noConsole: the verb reading belongs in the CI log
    console.log(
      `Verbs (synthetic, API): ${applied.length} applied (${applyMs.toFixed(1)} ms each), 1 rejected`,
    );

    // The four applied indexes exist and are valid; the rejected one was never built.
    const nameOf = (p: { ddl: string }) => /INDEX CONCURRENTLY "([^"]+)"/.exec(p.ddl)?.[1] ?? "";
    const sql = postgres(target, { max: 1, onnotice: () => {} });
    const built = (await sql.unsafe(
      "SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indisvalid AND c.relname = ANY($1) ORDER BY 1",
      [result.proposals.map(nameOf)],
    )) as unknown as { relname: string }[];
    await sql.end();
    expect(built.map((b) => b.relname)).toEqual(applied.map(nameOf).sort());
  });
});
