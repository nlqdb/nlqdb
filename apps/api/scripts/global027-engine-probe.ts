// GLOBAL-027 engine self-consistency probe — the FAST half of the opencheck Suite-A signal.
//
// Why this exists: opencheck Suite-A's `#authed-state-preserved` couples two
// independent things into one ~15-min Playwright-agent run — (1) the browser UX
// bootstrap (sign-in, adopt, pin) and (2) the *engine* round-trip: NL-create
// "create a users table…" then NL-query "how many users are there?". The recurring
// ~50% flake ("references a table this database doesn't have") is (2) — the
// GLOBAL-027 free-chain NL→SQL quality signal, NOT a harness bug. But the agent loop
// (gpt-oss-120b at ~3s/snapshot) makes every measurement of (2) cost an hour, which
// is why "no sense of progress": you can't iterate on an engine flake at 1 run/hour.
//
// This probe measures (2) ALONE in seconds by calling one staging-chain provider
// directly (no Neon, no Workers, no browser) for both `schema_infer` and `plan`. The
// staging `/v1/ask` planner+schema_infer chain is cerebras → gemini → groq → … with a
// HEDGE on the head (SK-LLM-023 / SK-LLM-014), so PROBE_PROVIDER isolates each model:
// run it per provider to see which is self-consistent and whether the Suite-A flake is
// cross-provider variance (a fallback served create vs query on different models), not
// lead-model NL→SQL quality. It does NOT paper over the engine signal (no API-seed): it
// reproduces the orchestrator's SK-ASK-016 pre-flight check (does the planned SQL
// reference a table the compiled schema has?) and reports a pass-rate + the distinct
// table names the create step emits, so create-side naming variance vs plan-side
// reference can be told apart. Finding 2026-06-12: cerebras (the head) = 8/8.
//
// Run:  PROBE_PROVIDER=cerebras CEREBRAS_API_KEY=… bun run apps/api/scripts/global027-engine-probe.ts [iterations]
//       (PROBE_PROVIDER ∈ cerebras|gemini|groq; default cerebras)
// FREE MODELS ONLY (GLOBAL-013): all three are free-tier; ~1-2K tokens/call. Check the
// DAILY budget first per opencheck-operations.md — TPD/RPD, not the per-minute headers.

import { SchemaPlanSchema } from "@nlqdb/db/types";
import {
  createCerebrasProvider,
  createGeminiProvider,
  createGroqProvider,
  type Provider,
} from "@nlqdb/llm";
import { compileDdl } from "../src/db-create/compile-ddl.ts";

const CREATE_GOAL = "create a users table with id, name, email";
const QUERY_GOAL = "how many users are there?";
const SCHEMA_NAME = "app"; // stand-in for the per-DB Postgres schema

const iterations = Number(process.argv[2] ?? 8);
// Which chain provider to probe in isolation. The staging `/v1/ask`
// planner+schema_infer chain is cerebras → gemini → groq → … (SK-LLM-023),
// hedged on the head — so isolating each provider tells us which model is
// self-consistent and whether cross-provider variance is the flake source.
const which = (process.env.PROBE_PROVIDER ?? "cerebras").toLowerCase();
// Min ms between LLM calls to respect the provider's RPM (Cerebras = 5 RPM).
const PACE_MS = which === "cerebras" ? 13_000 : 1_000;

function buildProvider(): Provider {
  if (which === "groq") return createGroqProvider({ apiKey: env("GROQ_API_KEY") });
  if (which === "gemini") return createGeminiProvider({ apiKey: env("GEMINI_API_KEY") });
  return createCerebrasProvider({ apiKey: env("CEREBRAS_API_KEY") });
}
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} required`);
  return v;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const provider = buildProvider();
console.info(`probing provider=${which} (the staging chain head is cerebras; SK-LLM-023)\n`);

// Every identifier the SQL reads after FROM/JOIN, normalised (unquoted,
// lowercased, schema-prefix stripped) — the only question that matters is
// whether the query references a table the schema actually has.
function referencedTables(sql: string): string[] {
  const out = new Set<string>();
  const re = /\b(?:from|join)\s+([a-zA-Z0-9_."]+)/gi;
  for (const m of sql.matchAll(re)) {
    const raw = m[1].replace(/"/g, "");
    const bare = raw.includes(".") ? raw.slice(raw.lastIndexOf(".") + 1) : raw;
    out.add(bare.toLowerCase());
  }
  return [...out];
}

type Row = {
  i: number;
  tables: string[];
  sql: string;
  referenced: string[];
  pass: boolean;
  note: string;
};
const rows: Row[] = [];

for (let i = 1; i <= iterations; i++) {
  const row: Row = { i, tables: [], sql: "", referenced: [], pass: false, note: "" };
  try {
    // Stage 1 — NL-create (the call the hosted db-create path makes).
    const inferRaw = await provider.schemaInfer({ goal: CREATE_GOAL });
    await sleep(PACE_MS);
    const parsed = SchemaPlanSchema.safeParse(inferRaw.plan);
    if (!parsed.success) {
      row.note = `schema_infer plan_invalid (${parsed.error.issues.length} issues)`;
    } else {
      const plan = parsed.data;
      row.tables = plan.tables.map((t) => t.name);
      const compiled = compileDdl(plan, SCHEMA_NAME);
      if (!compiled.ok) {
        row.note = `compile_ddl failed: ${compiled.reason}`;
      } else {
        const schemaText = compiled.statements.join("\n");
        // Stage 2 — NL-query against the compiled DDL (exactly what the planner sees).
        const planResp = await provider.plan({
          dialect: "postgres",
          schema: schemaText,
          goal: QUERY_GOAL,
        });
        row.sql = planResp.sql.trim();
        row.referenced = referencedTables(row.sql);
        // Pass = every referenced table exists in the schema (case-insensitive) —
        // the orchestrator's SK-ASK-016 pre-flight gate that throws schema_mismatch.
        const schemaTables = new Set(row.tables.map((t) => t.toLowerCase()));
        const missing = row.referenced.filter((t) => !schemaTables.has(t));
        row.pass = row.referenced.length > 0 && missing.length === 0;
        row.note = row.pass
          ? "ok"
          : missing.length > 0
            ? `references non-schema table(s): ${missing.join(", ")}`
            : "no FROM table in plan SQL";
      }
    }
  } catch (err) {
    row.note = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  rows.push(row);
  console.info(
    `#${i} ${row.pass ? "PASS" : "FAIL"} | created=[${row.tables.join(",")}] ref=[${row.referenced.join(",")}] | ${row.note}\n    SQL: ${row.sql.replace(/\s+/g, " ")}`,
  );
  if (i < iterations) await sleep(PACE_MS);
}

const passes = rows.filter((r) => r.pass).length;
const created = new Set(rows.flatMap((r) => r.tables));
console.info(`\n=== GLOBAL-027 engine round-trip: ${passes}/${iterations} pass ===`);
console.info(`distinct created table names across runs: ${[...created].join(", ") || "(none)"}`);
