// quality-eval harness — multi-dataset driver. Usage:
//   bun src/runner.ts --dataset bird-mini-dev-sqlite --data-dir ./bird_data --limit 500
//   bun src/runner.ts --dataset spider2-lite-sqlite --data-dir ./spider2-lite
//   bun src/runner.ts --dataset persona-bench [--persona P1|P2]   # SK-QUAL-018 ICP fixture
// All real provider calls require env vars (see lanes.ts); no key → one-sentence error per GLOBAL-012.

import { parseArgs } from "node:util";

import { AllProvidersFailedError } from "@nlqdb/llm";

import { compareToBaseline, readBaseline } from "./baseline.ts";
import {
  appendCheckpoint,
  checkpointKey,
  checkpointPath,
  completeCheckpoint,
  loadCheckpoint,
} from "./checkpoint.ts";
import { loadBirdMini } from "./datasets/bird-mini.ts";
import { loadPersonaBench, type Persona } from "./datasets/persona-bench.ts";
import { loadSpider2Lite } from "./datasets/spider2-lite.ts";
import { emitEvalReport } from "./emit.ts";
import { type AttemptScore, withExecRetry } from "./exec-retry.ts";
import { buildLanes, type Lane } from "./lanes.ts";
import { DEFAULT_RESULTS_DIR, writeReport } from "./output.ts";
import { executeRows, hasOrderBy, scoreOne, scoreOneSpider2 } from "./score.ts";
import { samplePlans, voteOverSamples } from "./self-consistency.ts";
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

// SK-QUAL-013 — per-run cap on capacity waits. Bounds the added
// wall-clock to ~5×capacityWaitMs so a tight-quota run budget-stops
// instead of crawling into the job's timeout-minutes ceiling (observed:
// the 2026-06-12 Spider smoke was runner-cancelled at its 30-min cap).
const CAPACITY_WAITS_PER_RUN = 5;

export type RunOptions = {
  // Defaults to `bird-mini-dev-sqlite` for back-compat with slice-1 callers.
  dataset?: EvalDataset;
  dataDir?: string;
  // SK-QUAL-018 — persona-bench only: narrow to P1 (Solo Builder) or P2
  // (Agent Builder). Ignored by BIRD/Spider. Unset ⇒ both personas.
  persona?: Persona;
  questionsJsonPath?: string;
  questionsJsonUrl?: string;
  limit?: number;
  // SK-QUAL-011 — deterministic sample seed for a sampled run. When
  // set, the runner picks `limit` questions from the *full* dataset via a
  // seeded shuffle, so the same questions are compared run-to-run (a
  // fixed seed turns the sampled EX into a stable signal, not noise from a
  // different slice each run). Unset ⇒ the prior first-`limit` behaviour.
  sampleSeed?: number;
  outDir?: string;
  sqlTimeoutMs?: number;
  // Inter-question pause (ms). Spaces the offered load so a low-RPM free
  // chain (e.g. the Cerebras 5-RPM planner head, SK-LLM-023) stays under
  // its per-minute limits and the rate-limit-aware failover / breaker can
  // recover between questions instead of cascading every provider open
  // into a `no_sql` wall. Default 0 ⇒ unchanged (PR CI / mocked router).
  throttleMs?: number;
  // SK-QUAL-013 — one bounded in-run wait (ms) when the whole chain is
  // rate-limit exhausted, before budget-stopping. Long enough to outlast
  // the default 60 s breaker cooldown, a per-minute quota window recovers
  // and the run keeps measuring; a daily-cap exhaustion doesn't, and the
  // second consecutive exhaustion budget-stops. Default 0 ⇒ immediate
  // budget-stop (PR CI / mocked router unchanged).
  capacityWaitMs?: number;
  // Test-injection point for the report timestamp so a resumed run and a
  // single-shot run can be compared deterministically. Production leaves
  // it unset (wall-clock now).
  runAt?: string;
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
  // SK-QUAL-017 — self-consistency dispatch. When set (samples >= 2), each
  // (question, lane) is answered by drawing N plans at `temperature` > 0,
  // executing each, and majority-voting by result set (the modal cluster's
  // SQL is the one scored). Unset ⇒ the greedy single-plan path (the
  // SK-LLM-024 invariant, the default everywhere); this is the §4 #3
  // reasoning lever's runner half, the EX delta measured by the next
  // canonical dispatch (SK-QUAL-002 forbids a back-to-back dispatch while a
  // baseline is < 7 days old).
  selfConsistency?: { samples: number; temperature: number };
  // SK-LLM-041 half (b) — similarity-retrieved few-shot dispatch. When > 0,
  // every plan() request carries `retrieveExemplars: k`, so the planner SYSTEM
  // prompt swaps the static SK-LLM-026 3-shot prefix for the k pool exemplars
  // whose masked skeleton is closest to the goal (`buildPlanSystem`). Unset/0 ⇒
  // the static prefix everywhere (the SK-LLM-024 invariant, prod default). This
  // is the §4 #1 DAIL-SQL retrieval lever's prod-wiring half; the EX delta is
  // the greedy-static-vs-greedy-retrieved gap on the next canonical dispatch
  // (SK-QUAL-002 forbids a back-to-back dispatch while a baseline is < 7 days
  // old). Orthogonal to selfConsistency — both can be set on one dispatch.
  retrieveExemplars?: number;
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
  if (name === "persona-bench") {
    // SK-QUAL-018 — ICP fixture; schemas materialise to SQLite under
    // `--data-dir` (or an OS temp dir). `--persona` narrows to P1/P2.
    return loadPersonaBench({ persona: opts.persona, limit: opts.limit, dbDir: opts.dataDir });
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

// SK-QUAL-011 — raised when a `plan()` throw means the whole provider
// chain is rate-limited (free-tier daily cap), as opposed to a genuine
// per-question failure. The runner catches it, checkpoints, and exits
// resumable rather than recording a spurious `no_sql`.
class BudgetStopError extends Error {
  constructor() {
    super("budget stop: whole provider chain rate-limited");
    this.name = "BudgetStopError";
  }
}

// SK-QUAL-013 / SK-LLM-030 — a chain exhausted purely by rate limits
// surfaces as `AllProvidersFailedError` where every attempt is
// `rate_limited` or `circuit_open` (a 429 opens the breaker for the
// server's `Retry-After` window, so the questions *after* the first 429
// see `circuit_open`, not `rate_limited` — the 2026-06-11 500-q run
// recorded 246 all-`circuit_open` rows as `no_sql` without a single LLM
// call). Capacity exhaustion is a pause (wait, then budget-stop +
// resume), never a scored `no_sql`. Mixed reasons (some 5xx / network /
// parse) are genuine failures, not a budget stop.
function isChainCapacityExhausted(err: unknown): boolean {
  return (
    err instanceof AllProvidersFailedError &&
    err.attempts.length > 0 &&
    err.attempts.every((a) => a.reason === "rate_limited" || a.reason === "circuit_open")
  );
}

// SK-QUAL-020 — `FailoverReason`s that mean the chain was never *reachable
// or usable*, so a row scored `no_sql` under one of them carries zero
// engine signal: `network`/`timeout` (transport), `not_configured` (no key
// registered), `auth_denied` (401/403 — key revoked/billing unlinked,
// SK-LLM-039). The capacity pair (`rate_limited`/`circuit_open`) is
// deliberately excluded — SK-QUAL-013's budget-stop owns it and it never
// reaches a scored `no_sql`. The answer-signal reasons (`parse`,
// `http_4xx`, `http_5xx`, `provider_error`, `unknown`) are NOT here, so a
// run that fails because the model returned non-SQL is never misread as an
// outage.
const NON_ENGINE_REASONS = new Set(["network", "timeout", "not_configured", "auth_denied"]);

// SK-QUAL-020 — a transport collapse: every lane that ran produced *zero*
// engine signal (no match / mismatch / exec_error) and every one of its
// `no_sql` rows was a `NON_ENGINE_REASONS` failure. The chain was
// unreachable end-to-end, so the run measured an outage, not SQL quality —
// recording its EX=0% would overwrite the baseline / emit a false
// regression. Pure over the assembled lane summaries so it's unit-testable
// without a live chain. Conservative by construction: any answered question
// (or any `parse`/`http_*` reason) makes it `false`, so a genuine engine
// regression is never suppressed.
function isTransportCollapse(lanes: LaneSummary[]): boolean {
  const ran = lanes.filter((l) => l.attempted > 0);
  if (ran.length === 0) return false;
  return ran.every((l) => {
    if (l.match + l.mismatch + l.exec_error !== 0) return false;
    if (l.no_sql === 0) return false;
    const tags = Object.keys(l.no_sql_reasons ?? {});
    if (tags.length === 0) return false;
    return tags.every((tag) => {
      const reason = tag.includes(":") ? tag.slice(tag.indexOf(":") + 1) : tag;
      return NON_ENGINE_REASONS.has(reason);
    });
  });
}

// Seeded PRNG (mulberry32) — tiny, dependency-free, deterministic per seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function byQuestionId(a: EvalQuestion, b: EvalQuestion): number {
  if (a.question_id !== b.question_id) return a.question_id - b.question_id;
  return (a.instance_id ?? "").localeCompare(b.instance_id ?? "");
}

// SK-QUAL-011 — pick `limit` questions deterministically from the full
// set (seeded partial Fisher-Yates), then sort by id so the iteration
// order is stable run-to-run regardless of the shuffle. Same (seed,
// limit) ⇒ same slice in the same order ⇒ resumable + comparable.
export function sampleQuestions(
  questions: EvalQuestion[],
  limit: number,
  seed: number,
): EvalQuestion[] {
  if (questions.length <= limit) return [...questions].sort(byQuestionId);
  const rng = mulberry32(seed);
  const idx = questions.map((_, i) => i);
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rng() * (idx.length - i));
    const tmp = idx[i] as number;
    idx[i] = idx[j] as number;
    idx[j] = tmp;
  }
  return idx
    .slice(0, limit)
    .map((i) => questions[i] as EvalQuestion)
    .sort(byQuestionId);
}

// SK-QUAL-013 follow-up — bucket the persisted per-question `no_sql` error
// strings into a `provider:reason` tally. The runner records the
// `AllProvidersFailedError` summary verbatim in `error`
// (`llm.plan: all providers in chain failed (cerebras:rate_limited,
// gemini:http_4xx, …, mistral:network)`); here we lift each tag back out
// and count it, so a run surfaces *why* the chain produced no SQL instead
// of leaving 30+ raw strings for a reviewer to eyeball. A scored `no_sql`
// always carries at least one non-capacity reason — a chain exhausted
// purely by rate-limit/circuit-open budget-stops (SK-QUAL-013) and never
// scores `no_sql` — so the buckets isolate the genuine failures.
function noSqlReasons(rows: QuestionResult[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const r of rows) {
    if (r.outcome !== "no_sql") continue;
    const err = r.error ?? "";
    // Tags live inside the trailing `(…)`; the closing paren is optional in
    // case the 240-char cap truncated mid-list. A non-chain throw (no
    // `failed (`) buckets under `other` rather than minting a noisy key.
    const m = err.match(/failed \(([^)]*)\)?/);
    const tags = m
      ? (m[1] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["other"];
    for (const tag of tags) tally[tag] = (tally[tag] ?? 0) + 1;
  }
  return tally;
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
  const reasons = noSqlReasons(filtered);
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
    // Omit on a clean lane so the summary stays byte-identical to a pre-existing baseline.
    ...(Object.keys(reasons).length > 0 ? { no_sql_reasons: reasons } : {}),
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
  capacityWaitMs = 0,
  waitBudget: { remaining: number } = { remaining: 0 },
  selfConsistency?: { samples: number; temperature: number },
  retrieveExemplars = 0,
): Promise<QuestionResult> {
  let start = Date.now();
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

  // SK-QUAL-017 — self-consistency dispatch. Draw N plans at temperature > 0,
  // execute each, majority-vote by result set, then score the modal cluster's
  // SQL exactly as the greedy path scores its single plan. A separate code
  // path from `withExecRetry` so the greedy SK-LLM-024 baseline is untouched.
  if (selfConsistency && selfConsistency.samples >= 2) {
    // `samplePlans` swallows a per-draw throw into a no-vote empty sample so
    // N-1 good draws still reach consensus; we count the draws that failed
    // because the *whole* chain is capacity-exhausted (SK-LLM-030). If every
    // draw hit that, the chain is down — budget-stop + resume (SK-QUAL-013)
    // rather than scoring a spurious no_sql.
    let samples: Awaited<ReturnType<typeof samplePlans>> = [];
    let waitedForCapacity = false;
    for (;;) {
      let capacityFails = 0;
      samples = await samplePlans(
        async (req) => {
          try {
            return await lane.router.plan(req);
          } catch (err) {
            if (isChainCapacityExhausted(err)) capacityFails++;
            throw err;
          }
        },
        {
          goal: enrichedGoal,
          schema,
          dialect: "sqlite",
          ...(retrieveExemplars > 0 ? { retrieveExemplars } : {}),
        },
        selfConsistency,
      );
      if (capacityFails < selfConsistency.samples) break;
      // Every draw hit a capacity-exhausted chain (SK-LLM-030). Honour the
      // SK-QUAL-013 one bounded wait-and-retry, then budget-stop + resume —
      // the same capacity-honest contract the greedy path uses below.
      if (capacityWaitMs > 0 && !waitedForCapacity && waitBudget.remaining > 0) {
        waitedForCapacity = true;
        waitBudget.remaining--;
        await new Promise((r) => setTimeout(r, capacityWaitMs));
        start = Date.now(); // the wait is harness pacing, not question latency
        continue;
      }
      throw new BudgetStopError();
    }
    // Cluster the vote under the same order-sensitivity the scorer applies to
    // the winner — otherwise an unordered cluster can elect a mis-ordered
    // member that then fails the strict scorer, understating the EX gain.
    const ordered = question.spider2 ? !question.spider2.ignore_order : hasOrderBy(question.sql);
    const vote = await voteOverSamples(samples, (sql) => executeRows(dbPath, sql, sqlTimeoutMs), {
      ordered,
    });
    const latency_ms = Date.now() - start;
    if (vote.sql.trim().length === 0) {
      // No sample produced executable SQL — the same no_sql outcome the greedy
      // path records for an empty plan, with the N-sample count surfaced.
      return {
        ...ids,
        outcome: "no_sql",
        predicted_sql: "",
        model: lane.modelHint,
        latency_ms,
        attempts: selfConsistency.samples,
        error: "self-consistency: no sample produced executable SQL",
      };
    }
    const score = await scoreSql(vote.sql);
    return {
      ...ids,
      outcome: score.outcome,
      predicted_sql: vote.sql.slice(0, PREDICTED_SQL_CAP),
      model: vote.model || lane.modelHint,
      latency_ms,
      // The N draws are real plan() calls — surface the cost in total_attempts.
      attempts: selfConsistency.samples,
      ...(score.error ? { error: score.error } : {}),
    };
  }

  let retryResult: Awaited<ReturnType<typeof withExecRetry>>;
  let waitedForCapacity = false;
  for (;;) {
    try {
      retryResult = await withExecRetry({
        maxAttempts: lane.maxAttempts,
        plan: (req) => lane.router.plan(req),
        request: {
          goal: enrichedGoal,
          schema,
          dialect: "sqlite",
          ...(retrieveExemplars > 0 ? { retrieveExemplars } : {}),
        },
        score: scoreSql,
      });
      break;
    } catch (err) {
      // SK-QUAL-013 — a rate-limit-exhausted chain is a capacity pause,
      // not a question failure: wait once (a per-minute window + the 60 s
      // breaker cooldown recover), then budget-stop so the runner
      // checkpoints and resumes on the next dispatch rather than
      // recording a spurious no_sql.
      if (isChainCapacityExhausted(err)) {
        if (capacityWaitMs > 0 && !waitedForCapacity && waitBudget.remaining > 0) {
          waitedForCapacity = true;
          waitBudget.remaining--;
          await new Promise((r) => setTimeout(r, capacityWaitMs));
          start = Date.now(); // the wait is harness pacing, not question latency
          continue;
        }
        throw new BudgetStopError();
      }
      // Any other plan() throw bubbles out of the retry helper. Production's
      // chain failover already exhausted; surface as no_sql with the
      // original error — same shape as a pre-3c first-attempt throw.
      return {
        ...ids,
        outcome: "no_sql",
        predicted_sql: "",
        model: lane.modelHint,
        latency_ms: Date.now() - start,
        error: trimErr(err),
      };
    }
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
  if (opts.selfConsistency) {
    console.info(
      `quality-eval: self-consistency dispatch — N=${opts.selfConsistency.samples} @ temperature=${opts.selfConsistency.temperature} (SK-QUAL-017)`,
    );
  }
  if (opts.retrieveExemplars && opts.retrieveExemplars > 0) {
    console.info(
      `quality-eval: retrieved few-shot dispatch — k=${opts.retrieveExemplars} (SK-LLM-041; replaces the static T9 prefix)`,
    );
  }
  const datasetName: EvalDataset = opts.dataset ?? "bird-mini-dev-sqlite";
  const loader = opts.loadDataset ?? loadDatasetByName;
  // Deterministic sampling pulls from the full set, so don't pre-truncate
  // in the loader when a seed is given.
  const loadOpts =
    opts.sampleSeed !== undefined ? ({ ...opts, limit: undefined } as RunOptions) : opts;
  const dataset = await loader(loadOpts);
  const questions =
    opts.sampleSeed !== undefined && opts.limit !== undefined
      ? sampleQuestions(dataset.questions, opts.limit, opts.sampleSeed)
      : dataset.questions;

  // SK-QUAL-011 — resume from a checkpoint if one exists. Already-scored
  // (question_id, lane) pairs are skipped and replayed verbatim into the
  // final report.
  const outDir = opts.outDir ?? DEFAULT_RESULTS_DIR;
  // Sampled runs checkpoint separately from full runs so a sampled run and
  // a full run never share a partial file; a self-consistency run keys on N
  // too, so a greedy run's scores never replay into an `--self-consistency N`
  // resume (different dispatch, different answers).
  const variant = `${opts.sampleSeed !== undefined ? "smoke" : "full"}${
    opts.selfConsistency ? `.sc${opts.selfConsistency.samples}` : ""
  }`;
  const cpPath = checkpointPath(outDir, datasetName, variant);
  const checkpoint = await loadCheckpoint(cpPath);
  const scored = new Map<string, QuestionResult>();
  for (const r of checkpoint.results) scored.set(checkpointKey(r.question_id, r.lane), r);

  const schemaCache = new Map<string, string>();
  const throttleMs = opts.throttleMs ?? 0;
  // SK-QUAL-013 — shared across questions and lanes: one run gets at most
  // CAPACITY_WAITS_PER_RUN waits before exhaustion budget-stops outright.
  const waitBudget = { remaining: (opts.capacityWaitMs ?? 0) > 0 ? CAPACITY_WAITS_PER_RUN : 0 };
  let budgetStopped = false;
  let firstScored = true;
  for (const question of questions) {
    const pending = lanes.filter(
      (lane) => !scored.has(checkpointKey(question.question_id, lane.lane)),
    );
    if (pending.length === 0) continue;
    // Space the offered load on a low-RPM free chain (opt-in; default 0).
    if (throttleMs > 0 && !firstScored) await new Promise((r) => setTimeout(r, throttleMs));
    firstScored = false;
    const dbPath = await dataset.resolveDbPath(question.db_id);
    // Lanes use distinct providers (no shared rate limit) so running them
    // concurrently halves wall-time without doubling provider RPS. A
    // BudgetStopError on one lane is caught and surfaced as a sentinel so
    // the other lanes' completed work for this question is still kept.
    const settled = await Promise.all(
      pending.map(async (lane) => {
        try {
          const result = await runOneQuestion(
            lane,
            question,
            dbPath,
            schemaCache,
            opts.sqlTimeoutMs,
            opts.capacityWaitMs ?? 0,
            waitBudget,
            opts.selfConsistency,
            opts.retrieveExemplars ?? 0,
          );
          return { result };
        } catch (err) {
          if (err instanceof BudgetStopError) return { budgetStop: true as const };
          throw err;
        }
      }),
    );
    for (const s of settled) {
      if ("budgetStop" in s) {
        budgetStopped = true;
        continue;
      }
      await appendCheckpoint(cpPath, s.result);
      scored.set(checkpointKey(s.result.question_id, s.result.lane), s.result);
    }
    if (budgetStopped) break;
  }

  // Assemble in deterministic (question, lane) order so a resumed run's
  // report scoring is identical to a single-shot run's.
  const results: QuestionResult[] = [];
  for (const question of questions) {
    for (const lane of lanes) {
      const r = scored.get(checkpointKey(question.question_id, lane.lane));
      if (r) results.push(r);
    }
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
    run_at: opts.runAt ?? new Date().toISOString(),
    dataset: datasetName,
    question_count: questions.length,
    lanes: laneSummaries,
    free_vs_frontier_delta: deltaPp(frontier, free),
    // SK-QUAL-009 — headline KPI per GLOBAL-025. Null when either lane
    // didn't run; the gate / event consumers tolerate null.
    free_vs_agentic_frontier_delta: deltaPp(agenticFrontier, free),
    results,
  };

  const writer = opts.writeReport ?? writeReport;

  // SK-QUAL-011/SK-QUAL-013 — budget stop: the chain is capacity-exhausted
  // (rate-limited / breaker-walled). Keep the checkpoint, mark the report
  // resumable, write it for inspection, and DON'T emit. The next dispatch
  // loads the checkpoint and finishes the remaining pairs.
  if (budgetStopped) {
    report.resumable = true;
    await writer(report, opts.outDir);
    return report;
  }

  // SK-QUAL-020 — transport collapse: the whole chain was unreachable
  // (every scored row a network/timeout/config failure, never an LLM
  // answer). Unlike the capacity stop above, these rows ARE scored `no_sql`
  // and so are already in the checkpoint — a resume would replay them and
  // re-report 0%. Write the report for inspection, DROP the poisoned
  // checkpoint so the re-dispatch starts fresh, and DON'T compare to the
  // baseline or emit: the run measured an outage, not engine quality.
  if (isTransportCollapse(laneSummaries)) {
    report.transport_failed = true;
    await writer(report, opts.outDir);
    await completeCheckpoint(cpPath);
    return report;
  }

  // Baseline diff + McNemar. Failures are converted to console warnings;
  // a missing or unreadable baseline must not block the run summary —
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
  // Run complete — drop the checkpoint so the next dispatch starts fresh.
  await completeCheckpoint(cpPath);
  return report;
}

const KNOWN_DATASETS: readonly EvalDataset[] = [
  "bird-mini-dev-sqlite",
  "spider2-lite-sqlite",
  "persona-bench",
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
      // SK-QUAL-018 — persona-bench persona filter (P1|P2); ignored otherwise.
      persona: { type: "string" },
      "data-dir": { type: "string" },
      "questions-json": { type: "string" },
      limit: { type: "string" },
      // SK-QUAL-011 — deterministic smoke-slice seed.
      "sample-seed": { type: "string" },
      out: { type: "string" },
      "sql-timeout-ms": { type: "string" },
      // Inter-question pacing for low-RPM free chains (default 0).
      "throttle-ms": { type: "string" },
      // SK-QUAL-013 — one bounded wait before a capacity budget-stop (default 0).
      "capacity-wait-ms": { type: "string" },
      // SK-QUAL-017 — self-consistency dispatch: draw N plans at
      // `--sc-temperature` and majority-vote (N >= 2; absent/< 2 ⇒ greedy).
      "self-consistency": { type: "string" },
      "sc-temperature": { type: "string" },
      // SK-LLM-041 half (b) — retrieve k pool exemplars per goal (replaces the
      // static T9 prefix); absent/0 ⇒ the static prefix (SK-LLM-024 default).
      "retrieve-exemplars": { type: "string" },
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
  if (values.persona === "P1" || values.persona === "P2") out.persona = values.persona;
  if (values["data-dir"]) out.dataDir = values["data-dir"];
  if (values["questions-json"]) out.questionsJsonPath = values["questions-json"];
  if (values.limit) out.limit = Number.parseInt(values.limit, 10);
  if (values["sample-seed"]) out.sampleSeed = Number.parseInt(values["sample-seed"], 10);
  if (values.out) out.outDir = values.out;
  if (values["sql-timeout-ms"]) out.sqlTimeoutMs = Number.parseInt(values["sql-timeout-ms"], 10);
  if (values["throttle-ms"]) out.throttleMs = Number.parseInt(values["throttle-ms"], 10);
  if (values["capacity-wait-ms"])
    out.capacityWaitMs = Number.parseInt(values["capacity-wait-ms"], 10);
  // N < 2 is the greedy path — leave selfConsistency unset rather than
  // sampling a single plan and "voting" over one candidate.
  if (values["self-consistency"]) {
    const samples = Number.parseInt(values["self-consistency"], 10);
    if (samples >= 2) {
      // Wang et al. 2022 (arXiv:2203.11171) sample at T≈0.7 for
      // self-consistency; override per dispatch with --sc-temperature.
      const t = values["sc-temperature"];
      out.selfConsistency = { samples, temperature: t ? Number.parseFloat(t) : 0.7 };
    }
  }
  // N < 1 ⇒ leave unset so the request shape is byte-identical to a pre-lever
  // greedy run (the static T9 prefix, SK-LLM-024).
  if (values["retrieve-exemplars"]) {
    const k = Number.parseInt(values["retrieve-exemplars"], 10);
    if (k >= 1) out.retrieveExemplars = k;
  }
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
        // Surface why the chain produced no SQL, busiest tag first, so the
        // GH-Actions log carries the diagnosis without opening the artifact.
        if (ls.no_sql_reasons && Object.keys(ls.no_sql_reasons).length > 0) {
          const buckets = Object.entries(ls.no_sql_reasons)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, n]) => `${tag}×${n}`)
            .join(", ");
          console.info(`  ${"".padEnd(20)}  no_sql reasons: ${buckets}`);
        }
      };
      console.info(`nlqdb quality-eval — ${r.dataset}`);
      console.info(`  questions           : ${r.question_count}`);
      if (r.resumable) {
        // SK-QUAL-011 — budget stop. The workflow keys off this line (and
        // the report's `resumable: true`) to keep the checkpoint and
        // re-dispatch instead of treating the partial run as final.
        console.info("  resumable           : true (chain rate-limited — checkpoint kept)");
      }
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
      if (r.transport_failed) {
        // SK-QUAL-020 — the chain was unreachable end-to-end; the EX=0% is
        // an outage, not a measurement. Fail loud so the dispatch re-runs
        // fresh instead of recording 0% / overwriting the baseline.
        console.error(
          "quality-eval: transport collapse — whole chain unreachable (network/timeout/config), EX is an outage not a measurement; checkpoint dropped, re-dispatch when connectivity is back",
        );
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(`quality-eval: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}

export const _testing = {
  summariseLane,
  noSqlReasons,
  percentile,
  introspectSchema,
  parseDatasetFlag,
  sampleQuestions,
  isChainCapacityExhausted,
  isTransportCollapse,
};
