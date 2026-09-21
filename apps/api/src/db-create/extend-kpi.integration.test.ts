// Agent-side KPI-1 harness — GLOBAL-041 Phase A, first-insert inference rate
// measured off the prod path (weekly focus 2026-09-13). Widen-on-write is
// deployed live (run 214 confirmed a `forceExtend` first-insert on prod; run
// 215 deployed the no-flag `pinned_write` route), but the LIVE counters
// (`asks_extend_ok` / `asks_extend_failed`, SK-SCHEMA-010) still read 0 %
// because no no-flag write has been driven at prod yet — the daily agent
// session cannot (its credential classifier denies the prod key), so the live
// number is read from CI via `.github/workflows/e2e-kpi1-live.yml`. This
// harness measures the same number the *engine* controls —
// `asks_extend_ok / (ok + failed)` — over a representative first-insert shape
// set, at $0, so the loop can hold it at ≥ 95 % while the live walk runs.
//
// What it exercises: the full agent-side extend path minus the live Postgres
// commit — `extendSchema` (the LLM designs a `WidenPlan`, the only
// per-shape-VARIABLE step) → `compileWriteDdl` → `validateCompiledDdl`
// (libpg_query allow-list, SK-HDC-006) → `buildWidenBatch` (the transaction
// the executor would run). The commit stage is deterministic given a valid
// batch and is independently proven 3/3 against real Postgres by
// `widen-walk.integration.test.ts` (run 206), so a shape that reaches a built
// batch is a first-insert-inference hit (`asks_extend_ok`); one that fails at
// design, compile, or build is a miss (`asks_extend_failed`).
//
// Gated on `RUN_EXTEND_KPI` (like `NEON_TEST_BRANCH_URL` gates the executor
// walk): unset ⇒ the block skips so CI without live free-LLM keys stays green
// and deterministic. Set (with the free-tier keys present) ⇒ it runs the free
// chain over the shapes and logs the measured rate. The LLM design step is
// non-deterministic, so the only hard assertion is a loose regression floor
// well below the ≥ 95 % goal; the value to read is the logged KPI-1 line.
//
// Skill cross-ref: docs/features/schema-widening/FEATURE.md SK-SCHEMA-010.

import {
  createCerebrasProvider,
  createGeminiProvider,
  createGroqProvider,
  createGroqQwenProvider,
  createLLMRouter,
  createMistralProvider,
  createOpenRouterProvider,
  createWorkersAIProvider,
  type LLMRouter,
} from "@nlqdb/llm";
import { describe, expect, it } from "vitest";
import { validateCompiledDdl } from "../ask/sql-validate-ddl.ts";
import { compileWriteDdl } from "./compile-write-ddl.ts";
import { extendSchema } from "./extend-schema.ts";
import { buildWidenBatch } from "./widen-provision.ts";

const RUN = process.env["RUN_EXTEND_KPI"];
const describeKpi = RUN ? describe : describe.skip;

// A conservative regression floor — the goal is ≥ 0.95 (GLOBAL-041 Phase A
// exit); this only trips CI (when an operator opts in) on a gross breakage,
// not on one shape a free model happens to design imperfectly.
const REGRESSION_FLOOR = 0.6;

const SCHEMA_NAME = "rateme12";
const TENANT = "tenant_extend_kpi";

// The representative first-insert shape set the weekly focus names, grounded
// in the rateme12 dogfood workload: new table · new column · type-varied ·
// jsonb · auth-shaped. Each is a write whose fields the observed schema does
// not yet have — exactly the first-insert case KPI-1 measures.
type Shape = {
  name: string;
  schemaText: string;
  goal: string;
  writeSql: string;
};

const SHAPES: Shape[] = [
  {
    name: "new-table",
    schemaText: `CREATE TABLE "${SCHEMA_NAME}"."profiles" ("id" uuid PRIMARY KEY, "name" text);`,
    goal: "Record a rating: a rater gives a profile a star count from 1 to 5. Store the rating id, which profile it targets, and the star count.",
    writeSql: `INSERT INTO "ratings" ("id", "profile_id", "stars") VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 5)`,
  },
  {
    name: "new-column",
    schemaText: `CREATE TABLE "${SCHEMA_NAME}"."ratings" ("id" uuid PRIMARY KEY, "stars" integer);`,
    goal: "Store the free-text comment the rater left alongside their star rating.",
    writeSql: `INSERT INTO "ratings" ("id", "stars", "comment") VALUES ('11111111-1111-1111-1111-111111111111', 4, 'great service')`,
  },
  {
    name: "type-varied",
    schemaText: `CREATE TABLE "${SCHEMA_NAME}"."ratings" ("id" uuid PRIMARY KEY);`,
    goal: "Record when a rating was submitted (a timestamp), its numeric average score to two decimals, and whether it was flagged for moderation review.",
    writeSql: `INSERT INTO "ratings" ("id", "submitted_at", "avg_score", "flagged") VALUES ('11111111-1111-1111-1111-111111111111', now(), 4.25, false)`,
  },
  {
    name: "jsonb",
    schemaText: `CREATE TABLE "${SCHEMA_NAME}"."ratings" ("id" uuid PRIMARY KEY);`,
    goal: "Attach arbitrary structured metadata to a rating — the device, locale, and referrer — as a single nested JSON object.",
    writeSql: `INSERT INTO "ratings" ("id", "metadata") VALUES ('11111111-1111-1111-1111-111111111111', '{"device":"ios","locale":"en-US"}')`,
  },
  {
    name: "auth-shaped",
    schemaText: `CREATE TABLE "${SCHEMA_NAME}"."ratings" ("id" uuid PRIMARY KEY);`,
    goal: "Register a new account: an email address, a bcrypt password hash, and the timestamp they signed up.",
    writeSql: `INSERT INTO "accounts" ("id", "email", "password_hash", "created_at") VALUES ('11111111-1111-1111-1111-111111111111', 'a@b.com', '$2b$10$abcdefghijklmnopqrstuv', now())`,
  },
];

// Build the free-tier planner chain exactly as prod (`apps/api/src/llm-router.ts`)
// and the eval harness (`tools/eval/src/lanes.ts`) do, so the measured rate is
// what production would score. `extendSchema` rides the `schema_infer` tier.
function buildFreeRouter(): LLMRouter | null {
  const env = process.env;
  const providers = [];
  if (env["GROQ_API_KEY"]) {
    providers.push(createGroqQwenProvider({ apiKey: env["GROQ_API_KEY"] }));
    providers.push(createGroqProvider({ apiKey: env["GROQ_API_KEY"] }));
  }
  if (env["CEREBRAS_API_KEY"])
    providers.push(createCerebrasProvider({ apiKey: env["CEREBRAS_API_KEY"] }));
  if (env["GEMINI_API_KEY"])
    providers.push(createGeminiProvider({ apiKey: env["GEMINI_API_KEY"] }));
  const cfToken = env["CF_AI_TOKEN"] ?? env["CLOUDFLARE_API_TOKEN"];
  if (cfToken && env["CLOUDFLARE_ACCOUNT_ID"]) {
    providers.push(
      createWorkersAIProvider({ apiToken: cfToken, accountId: env["CLOUDFLARE_ACCOUNT_ID"] }),
    );
  }
  if (env["OPENROUTER_API_KEY"])
    providers.push(createOpenRouterProvider({ apiKey: env["OPENROUTER_API_KEY"] }));
  if (env["MISTRAL_API_KEY"])
    providers.push(createMistralProvider({ apiKey: env["MISTRAL_API_KEY"] }));
  if (providers.length === 0) return null;
  return createLLMRouter({
    providers,
    chains: {
      schema_infer: [
        "groq-qwen",
        "gemini",
        "cerebras",
        "groq",
        "workers-ai",
        "openrouter",
        "mistral",
      ],
    },
    // Honor a 429's full window rather than recording a rate-limit as a miss.
    maxRateLimitCooldownMs: Number.POSITIVE_INFINITY,
  });
}

// One shape through the agent-side path. Returns the KPI-1 verdict + the stage
// it stopped at (for the logged breakdown).
async function walkShape(
  llm: LLMRouter,
  shape: Shape,
): Promise<{ ok: boolean; stage: string; detail: string; model?: string; confidence?: number }> {
  const designed = await extendSchema({ llm }, { goal: shape.goal, schema: shape.schemaText });
  if (!designed.ok) return { ok: false, stage: "plan", detail: designed.reason };

  const compiled = compileWriteDdl(designed.plan, SCHEMA_NAME);
  if (!compiled.ok) {
    return {
      ok: false,
      stage: "compile",
      detail: compiled.reason,
      model: designed.model,
      confidence: designed.confidence,
    };
  }

  const validation = validateCompiledDdl(compiled.statements);
  if (!validation.ok) {
    return {
      ok: false,
      stage: "validate",
      detail: validation.reason,
      model: designed.model,
      confidence: designed.confidence,
    };
  }

  const batch = await buildWidenBatch({
    schemaName: SCHEMA_NAME,
    tenantId: TENANT,
    plan: designed.plan,
    insert: { sql: shape.writeSql },
  });
  if (!batch.ok) {
    return {
      ok: false,
      stage: "build",
      detail: batch.reason,
      model: designed.model,
      confidence: designed.confidence,
    };
  }

  const ops = [
    ...designed.plan.create_tables.map((t) => `create_table:${t.name}`),
    ...designed.plan.add_columns.map((c) => `add_column:${c.table}.${c.column.name}`),
  ].join(", ");
  return {
    ok: true,
    stage: "built",
    detail: ops,
    model: designed.model,
    confidence: designed.confidence,
  };
}

describeKpi(
  "agent-side KPI-1 — first-insert inference over the representative shape set (GLOBAL-041 Phase A)",
  () => {
    it("designs, compiles, allow-lists, and builds a widen batch for each first-insert shape", async () => {
      const llm = buildFreeRouter();
      expect(llm, "no free-tier LLM keys in env — set GROQ/GEMINI/CEREBRAS keys").not.toBeNull();
      if (!llm) return;

      let ok = 0;
      let failed = 0;
      const lines: string[] = [];
      for (const shape of SHAPES) {
        const r = await walkShape(llm, shape);
        if (r.ok) ok += 1;
        else failed += 1;
        const conf = r.confidence !== undefined ? ` conf=${r.confidence.toFixed(2)}` : "";
        const model = r.model ? ` [${r.model}]` : "";
        lines.push(
          `  ${r.ok ? "✓ ok  " : "✗ miss"} ${shape.name.padEnd(12)} stage=${r.stage.padEnd(8)}${model}${conf}  ${r.detail}`,
        );
      }

      const rate = ok / (ok + failed);
      // The number the weekly focus tracks — greppable in the run log.
      // `console.info` (not `log`) is the allow-listed console method
      // (biome.json `noConsole.allow`), matching the eval runner's idiom.
      console.info(
        [
          "",
          "=== agent-side KPI-1 (first-insert inference rate) ===",
          ...lines,
          `  asks_extend_ok=${ok} asks_extend_failed=${failed} rate=${(rate * 100).toFixed(1)}% (n=${SHAPES.length})`,
          "  (commit stage proven 3/3 on real Postgres by widen-walk.integration.test.ts, run 206)",
          "",
        ].join("\n"),
      );

      expect(ok + failed).toBe(SHAPES.length);
      expect(rate).toBeGreaterThanOrEqual(REGRESSION_FLOOR);
    }, 120_000);
  },
);
