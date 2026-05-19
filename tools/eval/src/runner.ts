// quality-eval harness — multi-dataset driver. Usage:
//   bun src/runner.ts --dataset bird-mini-dev-sqlite --data-dir ./bird_data --limit 500
//   bun src/runner.ts --dataset spider2-lite-sqlite --data-dir ./spider2-lite
// All real provider calls require env vars (see lanes.ts); no key → one-sentence error per GLOBAL-012.

import { parseArgs } from "node:util";

import { compareToBaseline, readBaseline } from "./baseline.ts";
import { loadBirdMini } from "./datasets/bird-mini.ts";
import { loadSpider2Lite } from "./datasets/spider2-lite.ts";
import { emitEvalReport } from "./emit.ts";
import { type AttemptScore, withExecRetry } from "./exec-retry.ts";
import { buildLanes, type Lane } from "./lanes.ts";
import { writeReport } from "./output.ts";
import { scoreOne, scoreOneSpider2 } from "./score.ts";
import type {
  DispatchLane,
  EvalDataset,
  EvalQuestion,
  EvalReport,
  LaneSummary,
  QuestionResult,
  ScoreOutcome,
} from "./types.ts";

const PREDICTED_SQL_CAP = 4096;
const ERROR_MSG_CAP = 240;

export type RunOptions = {
  // Defaults to `bird-mini-dev-sqlite` for back-compat with slice-1 callers.
  dataset?: EvalDataset;
  dataDir?: string;
  questionsJsonPath?: string;
  questionsJsonUrl?: string;
  limit?: number;
  outDir?: string;
  sqlTimeoutMs?: number;
  // SK-QUAL-002 / SK-QUAL-005 — when set, the runner loads the baseline
  // JSON, attaches `report.baseline` with per-lane deltas + McNemar
  // results, and (if `emitUrl` is also set) emits one `feature.eval.weekly`
  // plus one `feature.eval.regression` per (lane, trigger) tuple.
  baselinePath?: string;
  // SK-QUAL-002 — fan-out target for the typed event pipeline. When
  // unset (PR-CI / local), the runner just writes the report JSON.
  emitUrl?: string;
  emitToken?: string;
  // Test injection points — production callers leave these unset so unit tests can stub the router and writer.
  buildLanes?: typeof buildLanes;
  writeReport?: typeof writeReport;
  readBaseline?: typeof readBaseline;
  emitEvalReport?: typeof emitEvalReport;
  loadDataset?: (opts: RunOptions) => Promise<LoadedDataset>;
};

// Common loader shape so the runner doesn't bind to one dataset's option-bag — `loadBirdMini` / `loadSpider2Lite` both adapt to this.
export type LoadedDataset = {
  questions: EvalQuestion[];
  resolveDbPath: (db_id: string) => Promise<string | null>;
};

async function loadDatasetByName(opts: RunOptions): Promise<LoadedDataset> {
  const name: EvalDataset = opts.dataset ?? "bird-mini-dev-sqlite";
  if (name === "spider2-lite-sqlite") {
    return loadSpider2Lite({
      dataDir: opts.dataDir,
      questionsJsonlPath: opts.questionsJsonPath,
      questionsJsonlUrl: opts.questionsJsonUrl,
      limit: opts.limit,
    });
  }
  // BIRD Mini-Dev — the default.
  return loadBirdMini({
    dataDir: opts.dataDir,
    questionsJsonPath: opts.questionsJsonPath,
    questionsJsonUrl: opts.questionsJsonUrl,
    limit: opts.limit,
  });
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 10_000) / 10_000;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  // biome-ignore lint/style/noNonNullAssertion: idx is bounded by sorted.length above
  return sorted[idx]!;
}

function trimErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, ERROR_MSG_CAP);
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
  // Exclude `gold_error` rows from the latency percentile — Spider 2.0-lite's `latency_ms: 0` short-circuit (SK-QUAL-007) would otherwise collapse p50 to zero.
  const sortedLatencies = filtered
    .filter((r) => r.outcome !== "gold_error")
    .map((r) => r.latency_ms)
    .sort((a, b) => a - b);
  // SK-QUAL-009 — questions without an `attempts` field never went through
  // the retry helper (gold_error short-circuits, or pre-3c baselines); count
  // them as 1 so `total_attempts` always lower-bounds `attempted`.
  const total_attempts = filtered.reduce((acc, r) => acc + (r.attempts ?? 1), 0);
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
    total_attempts,
  };
}

async function introspectSchema(dbPath: string): Promise<string> {
  // Dynamic specifier so tsc (which doesn't know bun:* schemes) still resolves the module.
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
  question: EvalQuestion,
  dbPath: string | null,
  schemaCache: Map<string, string>,
  sqlTimeoutMs?: number,
): Promise<QuestionResult> {
  const start = Date.now();
  const ids = {
    question_id: question.question_id,
    db_id: question.db_id,
    lane: lane.lane,
    ...(question.instance_id ? { instance_id: question.instance_id } : {}),
  } as const;
  if (!dbPath) {
    return {
      ...ids,
      outcome: "gold_error",
      predicted_sql: "",
      model: lane.modelHint,
      latency_ms: 0,
      error: `missing SQLite fixture for db_id=${question.db_id}`,
    };
  }
  // Short-circuit rows that carry no gold of any shape — neither BIRD gold
  // SQL (slice 3a) nor Spider 2.0 multi-CSV gold (slice 3b / SK-QUAL-008).
  // We do this before the LLM call so a row that can't be scored never burns
  // free-tier quota.
  const hasSpider2Gold = Boolean(question.spider2 && question.spider2.gold_tables.length > 0);
  if (question.sql.trim().length === 0 && !hasSpider2Gold) {
    return {
      ...ids,
      outcome: "gold_error",
      predicted_sql: "",
      model: lane.modelHint,
      latency_ms: 0,
      error: "no gold SQL or gold CSV available for this instance",
    };
  }
  let schema = schemaCache.get(question.db_id);
  if (!schema) {
    try {
      schema = await introspectSchema(dbPath);
      schemaCache.set(question.db_id, schema);
    } catch (err) {
      return {
        ...ids,
        outcome: "gold_error",
        predicted_sql: "",
        model: lane.modelHint,
        latency_ms: Date.now() - start,
        error: trimErr(err),
      };
    }
  }
  // BIRD's `evidence` is annotator-provided context — published scores aren't comparable without feeding it in.
  const enrichedGoal = question.evidence
    ? `${question.question}\n\nEvidence: ${question.evidence}`
    : question.question;

  // SK-QUAL-009 — score wrapper. A throw from scoreOne (corrupt SQLite,
  // I/O error) becomes a terminal gold_error inside the retry loop;
  // exec_error from the SQL itself is the only retryable outcome.
  const scoreSql = async (predictedSql: string): Promise<AttemptScore> => {
    try {
      return question.spider2
        ? await scoreOneSpider2({
            dbPath,
            predictedSql,
            goldTables: question.spider2.gold_tables,
            conditionCols: question.spider2.condition_cols,
            ignoreOrder: question.spider2.ignore_order,
            timeoutMs: sqlTimeoutMs,
          })
        : await scoreOne({
            dbPath,
            goldSql: question.sql,
            predictedSql,
            timeoutMs: sqlTimeoutMs,
          });
    } catch (err) {
      return { outcome: "gold_error", error: trimErr(err) };
    }
  };

  let retryResult: Awaited<ReturnType<typeof withExecRetry>>;
  try {
    retryResult = await withExecRetry({
      maxAttempts: lane.maxAttempts,
      plan: (req) => lane.router.plan(req),
      request: { goal: enrichedGoal, schema, dialect: "sqlite" },
      score: scoreSql,
    });
  } catch (err) {
    // A plan() throw bubbles out of the retry helper. Production's chain
    // failover already exhausted; surface as no_sql with the original
    // error — same shape as the pre-3c behaviour on a first-attempt throw.
    return {
      ...ids,
      outcome: "no_sql",
      predicted_sql: "",
      model: lane.modelHint,
      latency_ms: Date.now() - start,
      error: trimErr(err),
    };
  }
  const latency_ms = Date.now() - start;
  return {
    ...ids,
    outcome: retryResult.finalScore.outcome,
    predicted_sql: retryResult.finalSql.slice(0, PREDICTED_SQL_CAP),
    model: retryResult.finalModel || lane.modelHint,
    latency_ms,
    // Omit `attempts` when 1 so a single-attempt lane's result stays
    // byte-identical to pre-3c rows in the baseline JSON.
    ...(retryResult.attempts > 1 ? { attempts: retryResult.attempts } : {}),
    ...(retryResult.finalScore.error ? { error: retryResult.finalScore.error } : {}),
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
  const datasetName: EvalDataset = opts.dataset ?? "bird-mini-dev-sqlite";
  const loader = opts.loadDataset ?? loadDatasetByName;
  const dataset = await loader(opts);
  const schemaCache = new Map<string, string>();
  const results: QuestionResult[] = [];
  for (const question of dataset.questions) {
    const dbPath = await dataset.resolveDbPath(question.db_id);
    // Lanes use distinct providers (no shared rate limit) so running them concurrently halves wall-time without doubling provider RPS.
    const laneResults = await Promise.all(
      lanes.map((lane) => runOneQuestion(lane, question, dbPath, schemaCache, opts.sqlTimeoutMs)),
    );
    results.push(...laneResults);
  }
  const laneSummaries = lanes.map((l) => summariseLane(l.lane, results));
  const free = laneSummaries.find((l) => l.lane === "free");
  const frontier = laneSummaries.find((l) => l.lane === "frontier");
  const agenticFrontier = laneSummaries.find((l) => l.lane === "agentic-frontier");
  const deltaPp = (paid: LaneSummary | undefined, base: LaneSummary | undefined): number | null =>
    paid && base
      ? Math.round((paid.execution_accuracy - base.execution_accuracy) * 10_000) / 10_000
      : null;
  const report: EvalReport = {
    run_at: new Date().toISOString(),
    dataset: datasetName,
    question_count: dataset.questions.length,
    lanes: laneSummaries,
    free_vs_frontier_delta: deltaPp(frontier, free),
    // SK-QUAL-009 — headline KPI per GLOBAL-025. Null when either lane
    // didn't run; the gate / event consumers tolerate null.
    free_vs_agentic_frontier_delta: deltaPp(agenticFrontier, free),
    results,
  };
  // Baseline diff + McNemar. Failures are converted to console warnings;
  // a missing or unreadable baseline must not block the weekly summary —
  // the operator sees the warning in the GH-Actions log and re-runs.
  if (opts.baselinePath) {
    const reader = opts.readBaseline ?? readBaseline;
    try {
      const baseline = await reader(opts.baselinePath);
      report.baseline = compareToBaseline(baseline, report);
    } catch (err) {
      console.warn(`quality-eval: baseline ${opts.baselinePath} skipped: ${trimErr(err)}`);
    }
  }
  const writer = opts.writeReport ?? writeReport;
  await writer(report, opts.outDir);
  // Event emission is last so an emit failure can never lose the JSON
  // report (the cron's primary artifact). Per SK-QUAL-002 the emission
  // is opt-in via flag; PR CI never sets it.
  if (opts.emitUrl && opts.emitToken) {
    const emit = opts.emitEvalReport ?? emitEvalReport;
    const result = await emit(report, { apiUrl: opts.emitUrl, token: opts.emitToken });
    if (!result.accepted) {
      console.warn(
        `quality-eval: event emit failed (status=${result.status}${
          result.errorBody ? `, body=${result.errorBody}` : ""
        })`,
      );
    }
  }
  return report;
}

const KNOWN_DATASETS: readonly EvalDataset[] = [
  "bird-mini-dev-sqlite",
  "spider2-lite-sqlite",
] as const;

function parseDatasetFlag(raw: string | undefined): EvalDataset | undefined {
  if (!raw) return undefined;
  if ((KNOWN_DATASETS as readonly string[]).includes(raw)) return raw as EvalDataset;
  throw new Error(`unknown --dataset: ${raw} (expected one of: ${KNOWN_DATASETS.join(", ")})`);
}

function parseCliArgs(): RunOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      dataset: { type: "string" },
      "data-dir": { type: "string" },
      "questions-json": { type: "string" },
      limit: { type: "string" },
      out: { type: "string" },
      "sql-timeout-ms": { type: "string" },
      // SK-QUAL-002 / SK-QUAL-005 — baseline comparison + event emission.
      baseline: { type: "string" },
      // `emit-url` and `emit-token` go together; either both set (cron)
      // or neither (PR CI / local). The runner verifies the pair before
      // calling out.
      "emit-url": { type: "string" },
      "emit-token": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const out: RunOptions = {};
  const dataset = parseDatasetFlag(values.dataset);
  if (dataset) out.dataset = dataset;
  if (values["data-dir"]) out.dataDir = values["data-dir"];
  if (values["questions-json"]) out.questionsJsonPath = values["questions-json"];
  if (values.limit) out.limit = Number.parseInt(values.limit, 10);
  if (values.out) out.outDir = values.out;
  if (values["sql-timeout-ms"]) out.sqlTimeoutMs = Number.parseInt(values["sql-timeout-ms"], 10);
  if (values.baseline) out.baselinePath = values.baseline;
  // Both flags must be set together — fail loud per GLOBAL-012 if only
  // one is provided, so a typo in the workflow doesn't silently drop the
  // weekly emit.
  if (values["emit-url"] || values["emit-token"]) {
    if (!values["emit-url"] || !values["emit-token"]) {
      throw new Error("--emit-url and --emit-token must be provided together");
    }
    out.emitUrl = values["emit-url"];
    out.emitToken = values["emit-token"];
  }
  return out;
}

if (import.meta.main) {
  runEval(parseCliArgs())
    .then((r) => {
      const summarise = (label: string, ls: LaneSummary | undefined) => {
        if (!ls) return;
        const total = ls.total_attempts ?? ls.attempted;
        const retried = total > ls.attempted ? ` retries=${total - ls.attempted}` : "";
        console.info(
          `  ${label.padEnd(20)}: EA=${(ls.execution_accuracy * 100).toFixed(2)}% (match=${ls.match}/${ls.attempted}, p50=${ls.p50_latency_ms}ms${retried})`,
        );
      };
      console.info(`nlqdb quality-eval — ${r.dataset}`);
      console.info(`  questions           : ${r.question_count}`);
      summarise(
        "free",
        r.lanes.find((l) => l.lane === "free"),
      );
      summarise(
        "frontier",
        r.lanes.find((l) => l.lane === "frontier"),
      );
      summarise(
        "agentic-frontier",
        r.lanes.find((l) => l.lane === "agentic-frontier"),
      );
      if (r.free_vs_frontier_delta !== null) {
        console.info(`  delta (single)      : ${(r.free_vs_frontier_delta * 100).toFixed(2)} pts`);
      }
      const ag = r.free_vs_agentic_frontier_delta;
      if (ag !== null && ag !== undefined) {
        console.info(`  delta (agentic, KPI): ${(ag * 100).toFixed(2)} pts`);
      }
    })
    .catch((err) => {
      console.error(`quality-eval: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}

export const _testing = { summariseLane, percentile, introspectSchema, parseDatasetFlag };
