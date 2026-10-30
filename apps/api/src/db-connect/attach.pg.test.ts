// Live check of the attach door (`GLOBAL-043` item 6) on the seeded synthetic
// Postgres: `connectByoDb` validates, introspects, observes Tier 0, seals and
// records the DB row with its proposals, on the production BYO transport minus
// TLS, then the verbs, the `dba_observe` job's Tier 1 proposals and the
// `dba_verify` job's verify after the window. Runs only when `PG_TEST_URL` is
// set (CI's `test-dba-postgres` job); it prints KPI A through the door
// (connection string in → proposals in the ledger, in ms), the observe, and
// KPIs B and C as the job judged them. The last case needs no Postgres.

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createIndexProposal, openByoPostgres } from "@nlqdb/db";
import { describe, expect, it, vi } from "vitest";
import { listProposals, proposalStatement } from "../dba-changes.ts";
import { OBSERVE_WINDOW_SEC, observeDue } from "../dba-observe.ts";
import { decideProposal, VERIFY_WINDOW_SEC, verifyDue } from "../dba-verbs.ts";
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

// `node:sqlite` (Node 22) has no types under the Workers type set.
type SQLInputValue = string | number | null;
type Statement = {
  get: (...p: SQLInputValue[]) => unknown;
  all: (...p: SQLInputValue[]) => unknown[];
  run: (...p: SQLInputValue[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (
    path: string,
  ) => { exec: (sql: string) => void; prepare: (sql: string) => Statement };
};

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

// The api's own D1 schema (every migration) on an in-memory SQLite, behind
// the slice of the D1 API the door, the verbs and verify call.
function sqliteD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  const bound = (sql: string, params: SQLInputValue[]) => ({
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => {
      if (/^\s*SELECT/i.test(sql)) return { results: db.prepare(sql).all(...params), meta: {} };
      const r = db.prepare(sql).run(...params);
      return {
        results: [],
        meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
      };
    },
  });
  return {
    prepare: (sql: string) => ({
      ...bound(sql, []),
      bind: (...p: SQLInputValue[]) => bound(sql, p),
    }),
    batch: async (stmts: { run: () => Promise<unknown> }[]) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as D1Database;
}

describe.skipIf(!url)("the attach door on the seeded synthetic Postgres", () => {
  it("records the five Tier 0 proposals within KPI A's 5 min; the verbs decide them; the observe job proposes Tier 1; verify judges every applied row after its window", async () => {
    const target = await seedPublic(url as string);
    const d1 = sqliteD1();

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
    const { results: ledger } = await d1
      .prepare("SELECT ddl FROM dba_changes ORDER BY id")
      .all<{ ddl: string }>();
    expect(ledger.map((row) => row.ddl)).toEqual(result.proposals.map((p) => p.ddl));
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

    // The `dba_observe` job (`GLOBAL-043` item 7, Tier 1) on the attached DB:
    // its first tick keeps a baseline, the app's two hot lookups run, and the
    // tick after the window records their proposals — no caller asks. Then
    // verify after the window (items 4 and 7): applied through the verb, every
    // applied row is judged by the `dba_verify` job's `verifyDue`.
    const conn = deps.buildPostgresQuery();
    const HOT = ["SELECT id FROM posts WHERE title = $1", "SELECT id FROM users WHERE email = $1"];
    const run = async (n: number, which: 0 | 1) => {
      for (let i = 0; i < n; i++) {
        await conn.query(HOT[which] as string, [
          which === 0 ? `post ${1 + ((i * 37) % 20000)}` : `u${1 + ((i * 7) % 2000)}@example.com`,
        ]);
      }
    };
    const t0 = 1_000_000_000;
    expect(await observeDue(deps, t0)).toEqual([{ dbId: result.dbId, proposalIds: [] }]);
    await run(300, 0);
    await run(300, 1);
    expect(await observeDue(deps, t0 + OBSERVE_WINDOW_SEC - 1)).toEqual([]); // inside the window
    const observeAt = performance.now();
    const [observed] = await observeDue(deps, t0 + OBSERVE_WINDOW_SEC);
    const observeMs = performance.now() - observeAt;
    const tier1Ids = observed?.proposalIds ?? [];
    const tier1 = await listProposals(d1, result.dbId, "user_synth").then((ps) =>
      ps.filter((p) => tier1Ids.includes(p.id)),
    );
    expect(tier1.map((p) => `${p.table}(${p.columns}) t${p.tier}`)).toEqual([
      "posts(title) t1",
      "users(email) t1",
    ]);
    // biome-ignore lint/suspicious/noConsole: the observe reading belongs in the CI log
    console.log(
      `Tier 1 observe (synthetic, dba_observe job): ${tier1.length} proposals recorded with no caller, ${observeMs.toFixed(1)} ms for the DB`,
    );
    // The same lookups next window: their DDL is already in the ledger.
    await run(300, 0);
    expect(await observeDue(deps, t0 + 2 * OBSERVE_WINDOW_SEC)).toEqual([
      { dbId: result.dbId, proposalIds: [] },
    ]);
    for (const id of tier1Ids) {
      const r = await decideProposal(deps, {
        id,
        tenantId: "user_synth",
        decidedBy: "sk_mcp:synth",
        verb: "apply",
      });
      expect(r).toMatchObject({ ok: true, proposal: { status: "applied" } });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    expect(await verifyDue(deps, nowSec)).toEqual([]); // inside the window: nothing due

    // The window: users(email) runs as before; posts(title) regresses —
    // injected, JIT forced on its runs (as in packages/db's KPI C test).
    // Verify judges the counters, never the cause.
    for (const knob of ["jit_above_cost", "jit_inline_above_cost", "jit_optimize_above_cost"]) {
      await conn.query(`SET ${knob} = 0`, []);
    }
    await run(30, 0);
    await conn.query("RESET ALL", []);
    await run(300, 1);

    const verifyAt = performance.now();
    const verdicts: Awaited<ReturnType<typeof verifyDue>> = [];
    for (let tick = 0; tick < 3; tick++)
      verdicts.push(...(await verifyDue(deps, nowSec + VERIFY_WINDOW_SEC)));
    const verifyMs = (performance.now() - verifyAt) / verdicts.length;
    await conn.close();
    const byId = new Map(verdicts.map((v) => [v.id, v.verification]));
    expect(verdicts).toHaveLength(applied.length + tier1.length);
    for (const p of applied) expect(byId.get(p.id)).toMatchObject({ verdict: "unmeasured" });
    const title = byId.get(tier1Ids[0] as number);
    const email = byId.get(tier1Ids[1] as number);
    expect(title).toMatchObject({ verdict: "revert" });
    expect(email).toMatchObject({ verdict: "keep" });
    if (email?.verdict === "keep") expect(email.afterP95Ms).toBeLessThan(email.beforeP95Ms);
    // biome-ignore lint/suspicious/noConsole: the verify reading belongs in the CI log
    console.log(
      `Verify after the window (synthetic, dba_verify job): ${verdicts.length}/${verdicts.length} applied rows judged with no caller (${verifyMs.toFixed(1)} ms each); KPI B ${JSON.stringify(email)}; KPI C 1/1 ${JSON.stringify(title)}`,
    );

    // The ledger says so, and the reverted index is gone from Postgres.
    const { results: rows } = await d1
      .prepare("SELECT id, status FROM dba_changes WHERE id IN (?, ?) ORDER BY id")
      .bind(...tier1Ids)
      .all<{ id: number; status: string }>();
    expect(rows.map((r) => r.status)).toEqual(["reverted", "applied"]);
    const check = postgres(target, { max: 1, onnotice: () => {} });
    const left = (await check.unsafe(
      "SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ANY($1) ORDER BY 1",
      [tier1.map(nameOf)],
    )) as unknown as { relname: string }[];
    await check.end();
    expect(left.map((b) => b.relname)).toEqual([nameOf(tier1[1] as { ddl: string })]);
  }, 60_000);
});

describe("verifyDue on rows it can't reach", () => {
  it("tries the untried rows before retrying a failed one, so failures never hold the batch", async () => {
    const d1 = sqliteD1();
    await d1
      .prepare(
        "INSERT INTO databases (id, tenant_id, engine, connection_secret_ref, connection_blob, schema_hash, schema_text, synthetic, created_at, updated_at, last_queried_at) VALUES ('db_gone', 'user_synth', 'postgres', 'byo', NULL, 'h', '', 0, 0, 0, 0)",
      )
      .run();
    const p = createIndexProposal({
      tier: 1,
      schema: "public",
      table: "posts",
      columns: ["title"],
      reason: "r",
      evidence: {
        rowEstimate: 1,
        tableBytes: 1,
        workload: { fingerprint: "1", calls: 1, meanMs: 1, p95EstimateMs: 1 },
      },
    });
    for (let i = 0; i < 6; i++) await proposalStatement(d1, "db_gone", p).run();
    await d1
      .prepare("UPDATE dba_changes SET status = 'applied', decided_at = 0, verify_from = '{}'")
      .run();
    const deps = {
      resolve: async () => [],
      kek: "test-kek-this-is-a-high-entropy-string-aaaa",
      d1,
      randomSuffix: () => "x",
      buildClickhouseQuery: () => async () => ({ rows: [] }),
      buildPostgresQuery: () => {
        throw new Error("unreachable");
      },
    };
    const tried = async () =>
      (
        await d1
          .prepare("SELECT verify_tried_at AS t FROM dba_changes ORDER BY id")
          .all<{ t: number | null }>()
      ).results.map((r) => r.t);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await verifyDue(deps, VERIFY_WINDOW_SEC + 1)).toEqual([]);
    expect(await tried()).toEqual([...Array(5).fill(VERIFY_WINDOW_SEC + 1), null]);
    expect(await verifyDue(deps, VERIFY_WINDOW_SEC + 2)).toEqual([]);
    expect((await tried())[5]).toBe(VERIFY_WINDOW_SEC + 2);
    quiet.mockRestore();
  });
});
