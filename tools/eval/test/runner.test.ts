import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EngineClassifyRequest,
  PlanRequest,
  PlanResponse,
  RouteRequest,
  SchemaInferRequest,
  SummarizeRequest,
} from "@nlqdb/llm";
import { AllProvidersFailedError } from "@nlqdb/llm";
import type { Lane } from "../src/lanes.ts";
import { _testing, runEval } from "../src/runner.ts";
import type { EvalReport } from "../src/types.ts";

const { parseDatasetFlag, noSqlReasons, summariseLane } = _testing;

type StubRouter = Lane["router"];

// Minimal router stub — only `plan()` is exercised by the runner.
// Other methods throw so any accidental call surfaces in tests.
function fakeRouter(predicted: string, model = "stub-model"): StubRouter {
  const notUsed = (op: string) => () => {
    throw new Error(`${op} should not be called by the runner`);
  };
  return {
    plan: async (_req: PlanRequest): Promise<PlanResponse> => ({
      sql: predicted,
      model,
      confidence: 1,
    }),
    route: notUsed("route") as never as (r: RouteRequest) => Promise<never>,
    summarize: notUsed("summarize") as never as (r: SummarizeRequest) => Promise<never>,
    schemaInfer: notUsed("schemaInfer") as never as (r: SchemaInferRequest) => Promise<never>,
    engineClassify: notUsed("engineClassify") as never as (
      r: EngineClassifyRequest,
    ) => Promise<never>,
  };
}

const QUESTIONS = [
  {
    question_id: 0,
    db_id: "pets",
    question: "How many cats?",
    evidence: "",
    SQL: "SELECT COUNT(*) FROM pet WHERE species='cat'",
  },
  {
    question_id: 1,
    db_id: "pets",
    question: "Newest pet name",
    evidence: "",
    SQL: "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
  },
];

describe("runEval — end-to-end with mocked routers", () => {
  let dir: string;
  let dbDir: string;
  let questionsPath: string;
  let outDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-runner-"));
    dbDir = join(dir, "dev_databases", "pets");
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, "pets.sqlite");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE pet (id INTEGER PRIMARY KEY, name TEXT, species TEXT);");
    db.exec("INSERT INTO pet VALUES (1,'whisk','cat'),(2,'rex','dog'),(3,'milo','cat');");
    db.close();
    questionsPath = join(dir, "questions.json");
    writeFileSync(questionsPath, JSON.stringify(QUESTIONS));
    outDir = join(dir, "out");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("counts matches and mismatches across two lanes", async () => {
    const reports: EvalReport[] = [];
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        // Free lane returns correct SQL for both questions.
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT COUNT(*) FROM pet WHERE species='cat'"),
            plan: async (req: PlanRequest): Promise<PlanResponse> => {
              if (req.goal.includes("How many")) {
                return {
                  sql: "SELECT COUNT(*) FROM pet WHERE species='cat'",
                  model: "free-m",
                  confidence: 1,
                };
              }
              return {
                sql: "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
                model: "free-m",
                confidence: 1,
              };
            },
          },
        },
        // Frontier lane returns one correct and one wrong → 50% EA.
        {
          lane: "frontier",
          modelHint: "frontier-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (req: PlanRequest): Promise<PlanResponse> => {
              if (req.goal.includes("How many")) {
                return {
                  sql: "SELECT COUNT(*) FROM pet WHERE species='cat'",
                  model: "front-m",
                  confidence: 1,
                };
              }
              return {
                sql: "SELECT name FROM pet ORDER BY id ASC LIMIT 1",
                model: "front-m",
                confidence: 1,
              };
            },
          },
        },
      ],
      writeReport: async (r) => {
        reports.push(r);
        return "stub.json";
      },
    });
    expect(report.question_count).toBe(2);
    expect(report.dataset).toBe("bird-mini-dev-sqlite");
    const free = report.lanes.find((l) => l.lane === "free");
    const frontier = report.lanes.find((l) => l.lane === "frontier");
    expect(free?.execution_accuracy).toBe(1);
    expect(frontier?.execution_accuracy).toBe(0.5);
    expect(report.free_vs_frontier_delta).toBe(-0.5);
    expect(reports).toHaveLength(1);
  });

  it("throttleMs pauses between questions (SK-QUAL-012)", async () => {
    // Two questions, one fast lane → exactly one inter-question pause
    // (the first scored question is not delayed). Default 0 (every other
    // test) takes no pause, so this isolates the throttle path.
    const start = Date.now();
    await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      throttleMs: 200,
      buildLanes: () => [
        { lane: "free", modelHint: "f", maxAttempts: 1, router: fakeRouter("SELECT 1") },
      ],
      writeReport: async () => "stub.json",
    });
    expect(Date.now() - start).toBeGreaterThanOrEqual(180);
  });

  it("reports no_sql when the router throws", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter(""),
            plan: async (): Promise<PlanResponse> => {
              throw new Error("provider 503");
            },
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.no_sql).toBe(2);
    expect(free?.match).toBe(0);
    expect(free?.execution_accuracy).toBe(0);
    expect(report.free_vs_frontier_delta).toBeNull();
  });

  it("throws when no lane is configured", async () => {
    await expect(
      runEval({
        dataDir: dir,
        questionsJsonPath: questionsPath,
        outDir,
        buildLanes: () => [],
      }),
    ).rejects.toThrow(/no dispatch lanes/);
  });

  it("converts a corrupt SQLite fixture into a per-question gold_error (run continues)", async () => {
    // Overwrite the fixture with garbage so scoreOne throws on Database open.
    writeFileSync(join(dir, "dev_databases", "pets", "pets.sqlite"), "not a sqlite db");
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (): Promise<PlanResponse> => ({
              sql: "SELECT 1",
              model: "fake",
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.gold_error).toBe(2);
    expect(free?.match).toBe(0);
    expect(free?.execution_accuracy).toBe(0);
  });

  it("attaches baseline comparison + emits when baseline+emit options are provided (SK-QUAL-002)", async () => {
    let emittedReport: EvalReport | undefined;
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          // Free lane: both questions correct on current run.
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (req: PlanRequest): Promise<PlanResponse> => ({
              sql: req.goal.includes("How many")
                ? "SELECT COUNT(*) FROM pet WHERE species='cat'"
                : "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
              model: "free-m",
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
      baselinePath: "/fake/baseline.json",
      // Baseline says: both questions failed (0/2 match) — current is +100 pp.
      readBaseline: async () => ({
        run_at: "2026-05-01T00:00:00Z",
        dataset: "bird-mini-dev-sqlite",
        question_count: 2,
        lanes: [
          {
            lane: "free",
            attempted: 2,
            match: 0,
            mismatch: 2,
            exec_error: 0,
            no_sql: 0,
            gold_error: 0,
            execution_accuracy: 0,
            p50_latency_ms: 0,
            p95_latency_ms: 0,
          },
        ],
        free_vs_frontier_delta: null,
        results: [
          {
            question_id: 0,
            db_id: "pets",
            lane: "free",
            outcome: "mismatch",
            predicted_sql: "",
            model: "x",
            latency_ms: 0,
          },
          {
            question_id: 1,
            db_id: "pets",
            lane: "free",
            outcome: "mismatch",
            predicted_sql: "",
            model: "x",
            latency_ms: 0,
          },
        ],
      }),
      emitUrl: "https://api.test",
      emitToken: "tok_abc",
      emitEvalReport: async (r) => {
        emittedReport = r;
        return { accepted: true, status: 202, emitted: 1 };
      },
    });
    expect(report.baseline).toBeDefined();
    expect(report.baseline?.lanes[0]?.delta_pp).toBeCloseTo(1, 5); // +100 pp improvement
    expect(report.baseline?.lanes[0]?.regressions).toEqual([]); // no regression on improvement
    expect(emittedReport).toBeDefined();
    expect(emittedReport?.baseline).toBeDefined();
  });

  it("skips baseline + continues run when baseline read fails (SK-QUAL-002 fail-soft)", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (): Promise<PlanResponse> => ({
              sql: "SELECT COUNT(*) FROM pet WHERE species='cat'",
              model: "fake",
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
      baselinePath: "/does/not/exist.json",
      readBaseline: async () => {
        throw new Error("ENOENT");
      },
    });
    // Baseline read failed → no baseline attached, run still completes.
    expect(report.baseline).toBeUndefined();
    expect(report.lanes[0]?.attempted).toBe(2);
  });

  it("dispatches `--dataset spider2-lite-sqlite` to the multi-CSV scorer for rows with a spider2 payload (SK-QUAL-008)", async () => {
    const report = await runEval({
      dataset: "spider2-lite-sqlite",
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (): Promise<PlanResponse> => ({
              sql: "SELECT name FROM pet WHERE species='cat'",
              model: "fake",
              confidence: 1,
            }),
          },
        },
      ],
      // Two Spider-shaped rows: one with a spider2 payload (multi-CSV path)
      // matches the prediction; the other has no gold of any kind and
      // short-circuits to gold_error.
      loadDataset: async () => ({
        questions: [
          {
            question_id: 0,
            instance_id: "local003",
            db_id: "pets",
            question: "Cat names?",
            evidence: "",
            sql: "",
            spider2: {
              gold_tables: [{ columns: ["name"], cells: [["whisk", "milo"]] }],
              condition_cols: [],
              ignore_order: true,
            },
          },
          {
            question_id: 1,
            instance_id: "local007",
            db_id: "pets",
            question: "No gold",
            evidence: "",
            sql: "",
          },
        ],
        resolveDbPath: async () => join(dir, "dev_databases", "pets", "pets.sqlite"),
      }),
      writeReport: async () => "stub.json",
    });
    expect(report.dataset).toBe("spider2-lite-sqlite");
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.match).toBe(1);
    expect(free?.gold_error).toBe(1);
    expect(free?.execution_accuracy).toBe(1);
    expect(report.results.find((r) => r.question_id === 0)?.instance_id).toBe("local003");
    expect(report.results.find((r) => r.question_id === 1)?.error).toMatch(
      /no gold SQL or gold CSV/,
    );
  });

  it("returns mismatch when the prediction doesn't match any gold CSV variant (multi-gold path)", async () => {
    const report = await runEval({
      dataset: "spider2-lite-sqlite",
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (): Promise<PlanResponse> => ({
              sql: "SELECT name FROM pet",
              model: "fake",
              confidence: 1,
            }),
          },
        },
      ],
      loadDataset: async () => ({
        questions: [
          {
            question_id: 0,
            instance_id: "local003",
            db_id: "pets",
            question: "Cat names?",
            evidence: "",
            sql: "",
            spider2: {
              gold_tables: [
                { columns: ["name"], cells: [["nope1"]] },
                { columns: ["name"], cells: [["nope2"]] },
              ],
              condition_cols: [],
              ignore_order: true,
            },
          },
        ],
        resolveDbPath: async () => join(dir, "dev_databases", "pets", "pets.sqlite"),
      }),
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.match).toBe(0);
    expect(free?.mismatch).toBe(1);
  });

  it("SK-QUAL-009: agentic-frontier lane retries on exec_error and records the new headline KPI", async () => {
    // Attempt 1 returns malformed SQL → bun:sqlite throws → exec_error.
    // Attempt 2 returns valid SQL → match. We assert: (a) two plan calls
    // landed; (b) the second received `previousAttempt`; (c) the final
    // outcome is match; (d) `attempts: 2` lands on the result row;
    // (e) `free_vs_agentic_frontier_delta` is set (+pp because free
    // returned wrong SQL).
    const planCalls: Array<{ withPrev: boolean }> = [];
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 3,
          router: {
            ...fakeRouter("SELECT 0"),
            plan: async (): Promise<PlanResponse> => ({
              // Free always returns wrong SQL — predictable mismatch.
              sql: "SELECT id FROM pet WHERE 1=2",
              model: "free-m",
              confidence: 1,
            }),
          },
        },
        {
          lane: "agentic-frontier",
          modelHint: "agentic-fake",
          maxAttempts: 3,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (req: PlanRequest): Promise<PlanResponse> => {
              planCalls.push({ withPrev: req.previousAttempt !== undefined });
              if (req.previousAttempt) {
                // Second attempt: produce the correct SQL.
                return req.goal.includes("How many")
                  ? {
                      sql: "SELECT COUNT(*) FROM pet WHERE species='cat'",
                      model: "ag-m",
                      confidence: 1,
                    }
                  : {
                      sql: "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
                      model: "ag-m",
                      confidence: 1,
                    };
              }
              // First attempt: syntactically broken SQL → bun:sqlite throws → exec_error.
              return { sql: "SELECT BROKEN FROM nope", model: "ag-m", confidence: 1 };
            },
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    expect(planCalls.length).toBeGreaterThanOrEqual(4); // 2 questions × 2 attempts on agentic
    expect(planCalls.filter((c) => c.withPrev).length).toBeGreaterThanOrEqual(2);
    const agentic = report.lanes.find((l) => l.lane === "agentic-frontier");
    expect(agentic?.match).toBe(2);
    expect(agentic?.execution_accuracy).toBe(1);
    expect(agentic?.total_attempts).toBe(4); // 2 questions × 2 attempts
    // Every agentic-lane row landed with attempts=2 (single retry resolved).
    const agenticRows = report.results.filter((r) => r.lane === "agentic-frontier");
    expect(agenticRows.every((r) => r.attempts === 2)).toBe(true);
    // Headline KPI: agentic - free = 1.0 - 0.0 = 1.0.
    expect(report.free_vs_agentic_frontier_delta).toBeCloseTo(1, 5);
    // Single-model frontier delta stays null (lane didn't run).
    expect(report.free_vs_frontier_delta).toBeNull();
  });

  it("SK-QUAL-009: agentic-frontier exhausts its budget and lands the final exec_error on the row", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "agentic-frontier",
          modelHint: "agentic-fake",
          maxAttempts: 3,
          router: {
            ...fakeRouter("BROKEN"),
            // Every attempt returns broken SQL — retry never resolves.
            plan: async (): Promise<PlanResponse> => ({
              sql: "SELECT * FROM nonexistent_table_xyz",
              model: "ag-m",
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    const agentic = report.lanes.find((l) => l.lane === "agentic-frontier");
    expect(agentic?.exec_error).toBe(2);
    expect(agentic?.match).toBe(0);
    expect(agentic?.total_attempts).toBe(6); // 2 questions × 3 attempts (full budget)
    const rows = report.results.filter((r) => r.lane === "agentic-frontier");
    expect(rows.every((r) => r.attempts === 3)).toBe(true);
  });

  it("SK-QUAL-009: omits `attempts` on the result row when only one attempt ran (back-compat)", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 3,
          // Single-attempt success — no retry, so `attempts` must not
          // appear on the result row (pre-3c baseline JSONs don't have it).
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (req: PlanRequest): Promise<PlanResponse> => ({
              sql: req.goal.includes("How many")
                ? "SELECT COUNT(*) FROM pet WHERE species='cat'"
                : "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
              model: "free-m",
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.total_attempts).toBe(2); // 2 questions × 1 attempt
    expect(report.results.every((r) => r.attempts === undefined)).toBe(true);
  });

  it("does not emit when only one of emit-url/emit-token is set (caller forgot one)", async () => {
    const emitMock = mock(async () => ({ accepted: true, status: 202 }));
    await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (): Promise<PlanResponse> => ({
              sql: "SELECT COUNT(*) FROM pet WHERE species='cat'",
              model: "fake",
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
      emitUrl: "https://api.test",
      // emitToken intentionally omitted
      emitEvalReport: emitMock as unknown as typeof import("../src/emit.ts").emitEvalReport,
    });
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe("runEval — self-consistency dispatch (SK-QUAL-017)", () => {
  let dir: string;
  let questionsPath: string;
  let outDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-runner-sc-"));
    const dbDir = join(dir, "dev_databases", "pets");
    mkdirSync(dbDir, { recursive: true });
    const db = new Database(join(dbDir, "pets.sqlite"));
    db.exec("CREATE TABLE pet (id INTEGER PRIMARY KEY, name TEXT, species TEXT);");
    db.exec("INSERT INTO pet VALUES (1,'whisk','cat'),(2,'rex','dog'),(3,'milo','cat');");
    db.close();
    questionsPath = join(dir, "questions.json");
    writeFileSync(questionsPath, JSON.stringify(QUESTIONS));
    outDir = join(dir, "out");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("votes the modal answer across N sampled plans and scores the winner", async () => {
    const temps: Array<number | undefined> = [];
    // Per-question draw sequence: two correct phrasings out-vote one wrong
    // draw — the modal result-set cluster wins, so the winning SQL scores match.
    const draws: Record<string, string[]> = {
      "How many": [
        "SELECT COUNT(*) FROM pet WHERE species='cat'",
        "SELECT COUNT(*) FROM pet WHERE species = 'cat'", // same answer, different phrasing
        "SELECT COUNT(*) FROM pet", // wrong (counts all) → minority
      ],
      Newest: [
        "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
        "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
        "SELECT name FROM pet ORDER BY id ASC LIMIT 1", // wrong → minority
      ],
    };
    const cursor: Record<string, number> = {};
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      selfConsistency: { samples: 3, temperature: 0.7 },
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (req: PlanRequest): Promise<PlanResponse> => {
              temps.push(req.temperature);
              const key = req.goal.includes("How many") ? "How many" : "Newest";
              const i = cursor[key] ?? 0;
              cursor[key] = i + 1;
              // biome-ignore lint/style/noNonNullAssertion: i is bounded by the 3-element draw arrays
              return { sql: draws[key]![i]!, model: `m${i}`, confidence: 1 };
            },
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.match).toBe(2);
    expect(free?.execution_accuracy).toBe(1);
    // Every draw carried the sampling temperature (the greedy path never sets it).
    expect(temps).toHaveLength(6); // 2 questions × 3 draws
    expect(temps.every((t) => t === 0.7)).toBe(true);
    // The N draws surface as attempts=N so total_attempts reflects the cost.
    const rows = report.results.filter((r) => r.lane === "free");
    expect(rows.every((r) => r.attempts === 3)).toBe(true);
    expect(free?.total_attempts).toBe(6);
  });

  it("records no_sql when no sampled plan produces executable SQL", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      selfConsistency: { samples: 3, temperature: 0.5 },
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter(""),
            // Every draw is broken SQL → executeRows returns null → no vote.
            plan: async (): Promise<PlanResponse> => ({
              sql: "SELECT BROKEN FROM nope",
              model: "m",
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.no_sql).toBe(2);
    expect(free?.match).toBe(0);
    const rows = report.results.filter((r) => r.lane === "free");
    expect(rows.every((r) => r.attempts === 3)).toBe(true);
    expect(rows.every((r) => r.error?.includes("no sample produced executable SQL"))).toBe(true);
  });

  it("budget-stops (resumable) when every draw hits a capacity-exhausted chain", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      selfConsistency: { samples: 3, temperature: 0.7 },
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter(""),
            // Whole chain rate-limited on every draw → budget-stop, not no_sql.
            plan: async (): Promise<PlanResponse> => {
              throw new AllProvidersFailedError("chain rate-limited", [
                { provider: "gemini", reason: "rate_limited", error: new Error("429") },
                { provider: "groq", reason: "circuit_open", error: undefined },
              ]);
            },
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    expect(report.resumable).toBe(true);
    // Budget stop before any row scored — the checkpoint resumes next dispatch.
    expect(report.results).toHaveLength(0);
  });

  it("waits once then recovers when an early capacity-exhausted batch later succeeds (SK-QUAL-013)", async () => {
    // First full batch is whole-chain rate-limited; with a capacity-wait
    // budget the SC path waits once and re-draws instead of budget-stopping,
    // so the recovered batch scores rather than the run reading as resumable.
    let batch = 0;
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      selfConsistency: { samples: 3, temperature: 0.7 },
      capacityWaitMs: 1,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter(""),
            plan: async (req: PlanRequest): Promise<PlanResponse> => {
              // First N draws (one question's batch) all fail capacity; after
              // the one wait, every later draw answers.
              if (batch++ < 3) {
                throw new AllProvidersFailedError("chain rate-limited", [
                  { provider: "gemini", reason: "rate_limited", error: new Error("429") },
                ]);
              }
              return req.goal.includes("How many")
                ? { sql: "SELECT COUNT(*) FROM pet WHERE species='cat'", model: "m", confidence: 1 }
                : {
                    sql: "SELECT name FROM pet ORDER BY id DESC LIMIT 1",
                    model: "m",
                    confidence: 1,
                  };
            },
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    expect(report.resumable).toBeFalsy();
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.match).toBe(2);
  });

  it("clusters the vote ordered when the gold has ORDER BY, so a mis-ordered draw can't win", async () => {
    // Gold is sequence-strict (ORDER BY name DESC → milo, whisk). Two draws
    // return the correct order; one returns the same rows reversed (same
    // multiset, wrong sequence). An *unordered* vote would cluster all three
    // and elect the earliest member (the reversed one) → mismatch; an ordered
    // vote keeps the reversed draw out of the winning cluster → match.
    const orderQuestions = [
      {
        question_id: 0,
        db_id: "pets",
        question: "Cat names, newest first",
        evidence: "",
        SQL: "SELECT name FROM pet WHERE species='cat' ORDER BY name DESC",
      },
    ];
    writeFileSync(questionsPath, JSON.stringify(orderQuestions));
    const draws = [
      "SELECT name FROM pet WHERE species='cat' ORDER BY name ASC", // reversed → wrong sequence, drawn first
      "SELECT name FROM pet WHERE species='cat' ORDER BY name DESC",
      "SELECT name FROM pet WHERE species='cat' ORDER BY name DESC",
    ];
    let i = 0;
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      selfConsistency: { samples: 3, temperature: 0.7 },
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (): Promise<PlanResponse> => ({
              // biome-ignore lint/style/noNonNullAssertion: i is bounded by the 3-element draws array
              sql: draws[i++]!,
              model: `m${i}`,
              confidence: 1,
            }),
          },
        },
      ],
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.match).toBe(1);
    expect(free?.execution_accuracy).toBe(1);
  });
});

describe("summariseLane — latency stats exclude gold_error (SK-QUAL-007)", () => {
  let dir: string;
  let outDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-lane-"));
    const dbDir = join(dir, "dev_databases", "pets");
    mkdirSync(dbDir, { recursive: true });
    const db = new Database(join(dbDir, "pets.sqlite"));
    db.exec("CREATE TABLE pet (id INTEGER PRIMARY KEY, name TEXT);");
    db.exec("INSERT INTO pet VALUES (1,'whisk');");
    db.close();
    outDir = join(dir, "out");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not let SK-QUAL-007 short-circuits with latency_ms=0 collapse the percentile", async () => {
    // Mixed dataset: one row with gold SQL (latency = LLM call time),
    // three rows without gold SQL (SK-QUAL-007 short-circuit → latency_ms=0).
    // p50 across all four would be 0; the fix should report the LLM call's
    // latency instead.
    const report = await runEval({
      dataset: "spider2-lite-sqlite",
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
          maxAttempts: 1,
          router: {
            ...fakeRouter("SELECT 1"),
            plan: async (): Promise<PlanResponse> => {
              // Simulated p50-equivalent latency on the one scoreable row.
              await new Promise((r) => setTimeout(r, 5));
              return { sql: "SELECT id FROM pet", model: "fake", confidence: 1 };
            },
          },
        },
      ],
      loadDataset: async () => ({
        questions: [
          {
            question_id: 0,
            instance_id: "local003",
            db_id: "pets",
            question: "ids?",
            evidence: "",
            sql: "SELECT id FROM pet",
          },
          ...[1, 2, 3].map((i) => ({
            question_id: i,
            instance_id: `local00${i + 3}`,
            db_id: "pets",
            question: "no gold",
            evidence: "",
            sql: "",
          })),
        ],
        resolveDbPath: async () => join(dir, "dev_databases", "pets", "pets.sqlite"),
      }),
      writeReport: async () => "stub.json",
    });
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.gold_error).toBe(3);
    expect(free?.match).toBe(1);
    // The single scoreable row's latency drives the percentile; the three
    // short-circuited rows are filtered out before sorting.
    expect(free?.p50_latency_ms).toBeGreaterThan(0);
    expect(free?.p95_latency_ms).toBeGreaterThan(0);
  });
});

describe("noSqlReasons — bucket the persisted no_sql error tags (SK-QUAL-013 follow-up)", () => {
  const noSqlRow = (question_id: number, error: string) => ({
    question_id,
    db_id: "x",
    lane: "free" as const,
    outcome: "no_sql" as const,
    predicted_sql: "",
    model: "free-chain",
    latency_ms: 1,
    error,
  });

  it("lifts each provider:reason tag out of the AllProvidersFailedError summary", () => {
    const rows = [
      noSqlRow(
        1,
        "llm.plan: all providers in chain failed (cerebras:rate_limited, gemini:rate_limited, groq:circuit_open, workers-ai:rate_limited, openrouter:rate_limited, mistral:network)",
      ),
      noSqlRow(
        2,
        "llm.plan: all providers in chain failed (cerebras:circuit_open, gemini:circuit_open, groq:circuit_open, workers-ai:circuit_open, openrouter:circuit_open, mistral:network)",
      ),
    ];
    const tally = noSqlReasons(rows);
    // mistral:network is the terminal failure in both rows — the signal the
    // bucketing exists to surface (a scored no_sql always carries a
    // non-capacity reason; a pure rate-limit wall budget-stops instead).
    expect(tally["mistral:network"]).toBe(2);
    expect(tally["cerebras:rate_limited"]).toBe(1);
    expect(tally["cerebras:circuit_open"]).toBe(1);
  });

  it("ignores non-no_sql rows and buckets a non-chain throw under `other`", () => {
    const rows = [
      { ...noSqlRow(1, "boom — not a chain error"), outcome: "no_sql" as const },
      { ...noSqlRow(2, "irrelevant"), outcome: "mismatch" as const },
    ];
    const tally = noSqlReasons(rows);
    expect(tally["other"]).toBe(1);
    expect(Object.values(tally).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("is omitted from a lane summary with zero no_sql rows", () => {
    const summary = summariseLane("free", [
      {
        question_id: 1,
        db_id: "x",
        lane: "free",
        outcome: "match",
        predicted_sql: "SELECT 1",
        model: "m",
        latency_ms: 1,
      },
    ]);
    expect(summary.no_sql_reasons).toBeUndefined();
  });
});

describe("parseDatasetFlag — CLI guard", () => {
  it("returns undefined when the flag is absent so the runner defaults to BIRD", () => {
    expect(parseDatasetFlag(undefined)).toBeUndefined();
    expect(parseDatasetFlag("")).toBeUndefined();
  });

  it("passes a known dataset name through verbatim", () => {
    expect(parseDatasetFlag("bird-mini-dev-sqlite")).toBe("bird-mini-dev-sqlite");
    expect(parseDatasetFlag("spider2-lite-sqlite")).toBe("spider2-lite-sqlite");
  });

  it("throws on an unknown dataset (fail-loud per GLOBAL-012, not silent fall-through to BIRD)", () => {
    expect(() => parseDatasetFlag("bogus")).toThrow(/unknown --dataset: bogus/);
    // Error message lists the valid options so an operator can fix their command.
    expect(() => parseDatasetFlag("bogus")).toThrow(/bird-mini-dev-sqlite/);
    expect(() => parseDatasetFlag("bogus")).toThrow(/spider2-lite-sqlite/);
  });
});
