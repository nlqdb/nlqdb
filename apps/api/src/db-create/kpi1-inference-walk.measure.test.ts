// GLOBAL-041 Phase A — KPI 1 (first-insert inference rate) AGENT-SIDE
// measurement, over a representative dogfood first-insert shape set. The
// weekly-focus instrument (docs/scorecard.md): turn the run-206 binary 3/3
// executor walk (`widen-walk.integration.test.ts`, hand-built plans) into a
// measured `asks_extend_ok / (ok + failed)` rate over the FULL agent-side
// path — the LLM inference (`extendSchema`) INCLUDED, not just the executor.
//
// Each shape is one first-insert the observed schema cannot admit (an unseen
// table or column). `extendOnWrite` runs the exact `/v1/ask` absorb:
//   real free-tier LLM infers a WidenPlan  →  compileWriteDdl  →
//   validateCompiledDdl (real libpg_query allow-list)  →  one Neon
//   transaction (widen DDL + the write) that commits or rolls back.
// `ok:true` (the write committed, no user action) is a KPI-1 hit; any miss
// (plan / compile / exec) is a KPI-1 miss. The rate this prints IS the
// agent-side KPI-1 number the loop drives to ≥ 95 %.
//
// Why NOT `*.integration.test.ts` (the CI smoke glob) and why RUN_KPI1_MEASURE
// gated: the LLM leg is nondeterministic and needs free-tier keys, so this
// must never run in CI or the default `bun run test` — it is an operator-run
// measurement (`bunx vitest run src/db-create/kpi1-inference-walk.measure.test.ts`
// with NEON_TEST_BRANCH_URL + the free-tier keys + RUN_KPI1_MEASURE=1). The
// filename stays under the unit project's `src/db-create/**/*.test.ts` glob so
// it inherits the real-libpg_query wasm alias; the gate skips it otherwise.
//
// Skill cross-ref: docs/features/schema-widening/FEATURE.md SK-SCHEMA-008/010.

import {
  createCerebrasProvider,
  createGeminiProvider,
  createGroqProvider,
  createGroqQwenProvider,
  createLLMRouter,
  createMistralProvider,
  createOpenRouterProvider,
  type LLMRouter,
} from "@nlqdb/llm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extendOnWrite } from "../ask/extend.ts";
import { validateCompiledDdl } from "../ask/sql-validate-ddl.ts";
import { tenantRoleName } from "../tenant-role.ts";
import { buildPgClient } from "./pg-client.ts";
import type { PgClient } from "./types.ts";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];
const RUN = (process.env["RUN_KPI1_MEASURE"] ?? "").toLowerCase();
const ENABLED = Boolean(TEST_BRANCH_URL) && (RUN === "1" || RUN === "true" || RUN === "yes");
const SCHEMA = "test_kpi1_walk";
const TENANT = "tenant_kpi1_walk";

// Free-tier router built from `process.env` — the same providers + `schema_infer`
// chain order as apps/api/src/llm-router.ts (SK-LLM-054 Qwen3.8 head, Cerebras/
// Mistral direct tail per SK-LLM-047), so the number measures what production's
// extend path would infer. Routed direct (no AI Gateway needed off-Workers).
function buildFreeRouter(): LLMRouter {
  const e = process.env;
  const providers = [];
  if (e["GROQ_API_KEY"]) {
    providers.push(createGroqQwenProvider({ apiKey: e["GROQ_API_KEY"] }));
    providers.push(createGroqProvider({ apiKey: e["GROQ_API_KEY"] }));
  }
  if (e["CEREBRAS_API_KEY"])
    providers.push(createCerebrasProvider({ apiKey: e["CEREBRAS_API_KEY"] }));
  if (e["GEMINI_API_KEY"]) providers.push(createGeminiProvider({ apiKey: e["GEMINI_API_KEY"] }));
  if (e["OPENROUTER_API_KEY"])
    providers.push(createOpenRouterProvider({ apiKey: e["OPENROUTER_API_KEY"] }));
  if (e["MISTRAL_API_KEY"]) providers.push(createMistralProvider({ apiKey: e["MISTRAL_API_KEY"] }));
  return createLLMRouter({
    providers,
    // Extend rides the `schema_infer` tier (router.ts) — same order as prod.
    chains: { schema_infer: ["groq-qwen", "gemini", "cerebras", "groq", "openrouter", "mistral"] },
    // Mirror prod's schema_infer hedge (SK-LLM-014); default 8 s timeout.
    hedge: { schema_infer: { afterMs: 2000 } },
  });
}

// The observed schema the DBA already knows (D1 `db.schemaText`, DDL joined by
// blank lines). Every shape below writes something this schema cannot admit.
const OBSERVED_SCHEMA = [
  'CREATE TABLE "users" ("id" uuid PRIMARY KEY, "email" text)',
  'CREATE TABLE "profiles" ("id" uuid PRIMARY KEY, "display_name" text)',
  'CREATE TABLE "accounts" ("id" uuid PRIMARY KEY)',
].join("\n\n");

// The representative dogfood first-insert shape set (weekly focus): new table ·
// new column · type-varied · jsonb · auth-shaped. `goal` is the NL ask the write
// came from (what `extendSchema` infers structure from); `writeSql` is the
// schema-relative INSERT the planner produced (search_path resolves it).
type Shape = { key: string; goal: string; writeSql: string };
const SHAPES: Shape[] = [
  {
    key: "new-table",
    goal:
      "Save a rating: user 11111111-1111-1111-1111-111111111111 gave subject " +
      "22222222-2222-2222-2222-222222222222 a score of 5 stars.",
    writeSql:
      'INSERT INTO "ratings" ("id", "rater_id", "subject_id", "stars") VALUES ' +
      "('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', " +
      "'22222222-2222-2222-2222-222222222222', 5)",
  },
  {
    key: "new-column",
    goal: "Store this profile's bio text on the existing profiles table.",
    writeSql:
      'INSERT INTO "profiles" ("id", "display_name", "bio") VALUES ' +
      "('b2222222-2222-2222-2222-222222222222', 'Ada', 'Loves databases')",
  },
  {
    key: "type-varied",
    goal:
      "Log a metric: score 4.5 (a decimal), flagged true, recorded at " +
      "2026-09-13T10:00:00Z, with 3 votes.",
    writeSql:
      'INSERT INTO "metrics" ("id", "score", "flagged", "recorded_at", "votes") VALUES ' +
      "('c3333333-3333-3333-3333-333333333333', 4.5, true, '2026-09-13T10:00:00Z', 3)",
  },
  {
    key: "jsonb",
    goal: "Save the account's preferences as a JSON document with keys theme and notifications.",
    writeSql:
      'INSERT INTO "accounts" ("id", "preferences") VALUES ' +
      '(\'d4444444-4444-4444-4444-444444444444\', \'{"theme":"dark","notifications":true}\')',
  },
  {
    key: "auth-shaped",
    goal:
      "Create a login session: token 'tok_abc123' for user " +
      "11111111-1111-1111-1111-111111111111, expiring at 2026-09-20T00:00:00Z.",
    writeSql:
      'INSERT INTO "sessions" ("id", "user_id", "token", "expires_at") VALUES ' +
      "('e5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', " +
      "'tok_abc123', '2026-09-20T00:00:00Z')",
  },
];

const describeMeasure = ENABLED ? describe : describe.skip;

describeMeasure("KPI 1 first-insert inference rate — agent-side walk (GLOBAL-041 Phase A)", () => {
  const pg: PgClient = buildPgClient(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db");
  const llm = ENABLED ? buildFreeRouter() : (undefined as unknown as LLMRouter);
  // The CAS write targets the control-plane D1 (never the user DB) and is
  // best-effort inside `extendOnWrite` (a throw ⇒ schemaRewritten:false, the
  // absorb still ok). Stub it so the walk needs no D1 — it never gates a hit.
  const d1 = {
    prepare() {
      throw new Error("d1-stub: CAS not exercised in the KPI-1 walk");
    },
  } as unknown as D1Database;
  let role = "";

  async function tryQuery(sql: string): Promise<void> {
    try {
      await pg.query(sql);
    } catch {
      // best-effort teardown against a disposable branch
    }
  }

  async function cleanup(): Promise<void> {
    await tryQuery(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    if (role) {
      await tryQuery(`DROP OWNED BY "${role}"`);
      await tryQuery(`DROP ROLE IF EXISTS "${role}"`);
    }
  }

  beforeAll(async () => {
    role = await tenantRoleName(TENANT);
    await cleanup();
    await pg.query(`CREATE SCHEMA "${SCHEMA}"`);
    await pg.query(`CREATE ROLE "${role}" NOLOGIN`);
    // Pre-existing tables the ADD COLUMN shapes widen (bio, preferences).
    await pg.query(
      `CREATE TABLE "${SCHEMA}"."profiles" ("id" uuid PRIMARY KEY, "display_name" text)`,
    );
    await pg.query(`CREATE TABLE "${SCHEMA}"."accounts" ("id" uuid PRIMARY KEY)`);
  }, 60_000);

  afterAll(cleanup);

  it("measures the first-insert inference rate over the representative shape set", async () => {
    const outcomes: { key: string; ok: boolean; detail: string }[] = [];
    for (const shape of SHAPES) {
      const out = await extendOnWrite(
        { llm, pg, d1, validateCompiledDdl },
        {
          dbId: "kpi1-walk",
          tenantId: TENANT,
          schemaName: SCHEMA,
          schemaText: OBSERVED_SCHEMA,
          observedHash: "kpi1-observed",
          goal: shape.goal,
          writeSql: shape.writeSql,
        },
      );
      outcomes.push(
        out.ok
          ? { key: shape.key, ok: true, detail: `model=${out.model} conf=${out.confidence}` }
          : {
              key: shape.key,
              ok: false,
              detail:
                `stage=${out.stage} reason=${out.reason}` +
                (out.sqlState ? ` sqlState=${out.sqlState}` : "") +
                (out.error instanceof Error ? ` msg=${out.error.message}` : ""),
            },
      );
    }

    const ok = outcomes.filter((o) => o.ok).length;
    const total = outcomes.length;
    const rate = total > 0 ? ok / total : 0;
    // The number the loop reads. `console.log` for a TTY run; a machine-
    // readable JSON drop when KPI1_OUT is set (vitest's console intercept
    // swallows stdout under a redirected reporter).
    const summary =
      `KPI1_INFERENCE_RATE ${ok}/${total} = ${(rate * 100).toFixed(1)}%\n` +
      outcomes.map((o) => `  ${o.ok ? "HIT " : "MISS"} ${o.key} — ${o.detail}`).join("\n");
    // biome-ignore lint/suspicious/noConsole: this is an operator-run measurement — the printed rate is its whole purpose.
    console.log(`\n${summary}`);
    const out = process.env["KPI1_OUT"];
    if (out) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        out,
        `${summary}\n\n${JSON.stringify({ ok, total, rate, outcomes }, null, 2)}\n`,
      );
    }

    // The walk must have run every shape end-to-end (denominator complete);
    // the rate itself is a measurement, not a gate here.
    expect(total).toBe(SHAPES.length);
  }, 240_000);
});
