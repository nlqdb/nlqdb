// quality-eval harness — BIRD Mini-Dev driver. Walks the question
// list, asks each configured dispatch lane (free / frontier) for SQL,
// scores execution accuracy on the SQLite fixture, and writes a
// report JSON to `results/`.
//
// Usage (from repo root):
//   bun run --filter tools/eval bird-mini -- \
//     --data-dir ./bird_data \
//     --limit 500 \
//     --out tools/eval/results
//
// All real provider calls require env vars (see lanes.ts). Without
// any provider key the runner exits 1 with a one-sentence error per
// GLOBAL-012.

import { parseArgs } from "node:util";

import { loadBirdMini } from "./datasets/bird-mini.ts";
import { buildLanes, type Lane } from "./lanes.ts";
import { writeReport } from "./output.ts";
import { scoreOne } from "./score.ts";
import type {
  BirdQuestion,
  DispatchLane,
  EvalReport,
  LaneSummary,
  QuestionResult,
  ScoreOutcome,
} from "./types.ts";

const PREDICTED_SQL_CAP = 4096;

export type RunOptions = {
  dataDir?: string;
  questionsJsonPath?: string;
  questionsJsonUrl?: string;
  limit?: number;
  outDir?: string;
  // Per-question SQL execution timeout. Defaults to 5 s in score.ts.
  sqlTimeoutMs?: number;
  // Test injection — keeps the unit tests from hitting HuggingFace.
  buildLanes?: typeof buildLanes;
  // Test injection — short-circuit the writer so unit tests don't
  // touch the file system.
  writeReport?: typeof writeReport;
};

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 10_000) / 10_000;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  // biome-ignore lint/style/noNonNullAssertion: idx is bounded by sorted.length above
  return sorted[idx]!;
}

function summariseLane(lane: DispatchLane, results: QuestionResult[]): LaneSummary {
  const filtered = results.filter((r) => r.lane === lane);
  const tally: Record<ScoreOutcome, number> = {
    match: 0,
    mismatch: 0,
    exec_error: 0,
    no_sql: 0,
    gold_error: 0,
  };
  for (const r of filtered) tally[r.outcome] += 1;
  const attempted = filtered.length;
  const scoreable = attempted - tally.gold_error;
  const ea = pct(tally.match, scoreable);
  const sortedLatencies = filtered.map((r) => r.latency_ms).sort((a, b) => a - b);
  return {
    lane,
    attempted,
    match: tally.match,
    mismatch: tally.mismatch,
    exec_error: tally.exec_error,
    no_sql: tally.no_sql,
    gold_error: tally.gold_error,
    execution_accuracy: ea,
    p50_latency_ms: percentile(sortedLatencies, 50),
    p95_latency_ms: percentile(sortedLatencies, 95),
  };
}

async function introspectSchema(dbPath: string): Promise<string> {
  // Lazy import keeps node-only consumers from crashing on bun:sqlite.
  const mod = (await import(/* @vite-ignore */ "bun:sqlite")) as {
    Database: new (
      filename: string,
      opts?: { readonly?: boolean },
    ) => {
      query: (sql: string) => { all: () => unknown[] };
      close: () => void;
    };
  };
  const db = new mod.Database(dbPath, { readonly: true });
  try {
    const rows = db
      .query(
        "SELECT sql FROM sqlite_master WHERE type IN ('table','view') AND sql IS NOT NULL ORDER BY name",
      )
      .all() as Array<{ sql: string | null }>;
    return rows
      .map((r) => r.sql ?? "")
      .filter(Boolean)
      .join(";\n\n");
  } finally {
    db.close();
  }
}

async function runOneQuestion(
  lane: Lane,
  question: BirdQuestion,
  dbPath: string | null,
  schemaCache: Map<string, string>,
  sqlTimeoutMs?: number,
): Promise<QuestionResult> {
  const start = Date.now();
  if (!dbPath) {
    return {
      question_id: question.question_id,
      db_id: question.db_id,
      lane: lane.lane,
      outcome: "gold_error",
      predicted_sql: "",
      model: lane.modelHint,
      latency_ms: 0,
      error: `missing SQLite fixture for db_id=${question.db_id}`,
    };
  }
  let schema = schemaCache.get(question.db_id);
  if (!schema) {
    try {
      schema = await introspectSchema(dbPath);
      schemaCache.set(question.db_id, schema);
    } catch (err) {
      return {
        question_id: question.question_id,
        db_id: question.db_id,
        lane: lane.lane,
        outcome: "gold_error",
        predicted_sql: "",
        model: lane.modelHint,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
  // BIRD's `evidence` is annotator-provided context — append to the
  // goal so the LLM sees the same hint a human would. Without it,
  // published BIRD scores aren't comparable.
  const enrichedGoal = question.evidence
    ? `${question.question}\n\nEvidence: ${question.evidence}`
    : question.question;

  let predicted = "";
  let model = lane.modelHint;
  let llmError: string | undefined;
  try {
    const plan = await lane.router.plan({
      goal: enrichedGoal,
      schema,
      dialect: "sqlite",
    });
    predicted = plan.sql ?? "";
    model = plan.model || lane.modelHint;
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err);
  }
  const latency_ms = Date.now() - start;
  if (llmError) {
    return {
      question_id: question.question_id,
      db_id: question.db_id,
      lane: lane.lane,
      outcome: "no_sql",
      predicted_sql: "",
      model,
      latency_ms,
      error: llmError.slice(0, 240),
    };
  }
  const score = await scoreOne({
    dbPath,
    goldSql: question.sql,
    predictedSql: predicted,
    timeoutMs: sqlTimeoutMs,
  });
  return {
    question_id: question.question_id,
    db_id: question.db_id,
    lane: lane.lane,
    outcome: score.outcome,
    predicted_sql: predicted.slice(0, PREDICTED_SQL_CAP),
    model,
    latency_ms,
    ...(score.error ? { error: score.error } : {}),
  };
}

export async function runEval(opts: RunOptions = {}): Promise<EvalReport> {
  const lanesBuilder = opts.buildLanes ?? buildLanes;
  const lanes = lanesBuilder(process.env as Record<string, string | undefined>);
  if (lanes.length === 0) {
    throw new Error(
      "no dispatch lanes configured — set at least one of GEMINI_API_KEY/GROQ_API_KEY/OPENROUTER_API_KEY (free) or OPENROUTER_FRONTIER_API_KEY",
    );
  }
  const dataset = await loadBirdMini({
    dataDir: opts.dataDir,
    questionsJsonPath: opts.questionsJsonPath,
    questionsJsonUrl: opts.questionsJsonUrl,
    limit: opts.limit,
  });
  const schemaCache = new Map<string, string>();
  const results: QuestionResult[] = [];
  for (const question of dataset.questions) {
    const dbPath = await dataset.resolveDbPath(question.db_id);
    for (const lane of lanes) {
      const r = await runOneQuestion(lane, question, dbPath, schemaCache, opts.sqlTimeoutMs);
      results.push(r);
    }
  }
  const laneSummaries = lanes.map((l) => summariseLane(l.lane, results));
  const free = laneSummaries.find((l) => l.lane === "free");
  const frontier = laneSummaries.find((l) => l.lane === "frontier");
  const delta =
    free && frontier
      ? Math.round((frontier.execution_accuracy - free.execution_accuracy) * 10_000) / 10_000
      : null;
  const report: EvalReport = {
    run_at: new Date().toISOString(),
    dataset: "bird-mini-dev-sqlite",
    question_count: dataset.questions.length,
    lanes: laneSummaries,
    free_vs_frontier_delta: delta,
    results,
  };
  const writer = opts.writeReport ?? writeReport;
  await writer(report, opts.outDir);
  return report;
}

function parseCliArgs(): RunOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "data-dir": { type: "string" },
      "questions-json": { type: "string" },
      limit: { type: "string" },
      out: { type: "string" },
      "sql-timeout-ms": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const out: RunOptions = {};
  if (values["data-dir"]) out.dataDir = values["data-dir"];
  if (values["questions-json"]) out.questionsJsonPath = values["questions-json"];
  if (values.limit) out.limit = Number.parseInt(values.limit, 10);
  if (values.out) out.outDir = values.out;
  if (values["sql-timeout-ms"]) out.sqlTimeoutMs = Number.parseInt(values["sql-timeout-ms"], 10);
  return out;
}

// CLI entry — only runs when executed directly (not when imported by
// tests). Bun's `import.meta.main` is true for the entry module.
if (import.meta.main) {
  runEval(parseCliArgs())
    .then((r) => {
      const free = r.lanes.find((l) => l.lane === "free");
      const frontier = r.lanes.find((l) => l.lane === "frontier");
      console.info("nlqdb quality-eval — BIRD Mini-Dev SQLite");
      console.info(`  questions   : ${r.question_count}`);
      if (free) {
        console.info(
          `  free        : EA=${(free.execution_accuracy * 100).toFixed(2)}% (match=${free.match}/${free.attempted}, p50=${free.p50_latency_ms}ms)`,
        );
      }
      if (frontier) {
        console.info(
          `  frontier    : EA=${(frontier.execution_accuracy * 100).toFixed(2)}% (match=${frontier.match}/${frontier.attempted}, p50=${frontier.p50_latency_ms}ms)`,
        );
      }
      if (r.free_vs_frontier_delta !== null) {
        console.info(`  delta       : ${(r.free_vs_frontier_delta * 100).toFixed(2)} pts`);
      }
    })
    .catch((err) => {
      console.error(`quality-eval: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}

export const _testing = { summariseLane, percentile, introspectSchema };
