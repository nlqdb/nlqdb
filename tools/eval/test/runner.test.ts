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
import type { Lane } from "../src/lanes.ts";
import { runEval } from "../src/runner.ts";
import type { EvalReport } from "../src/types.ts";

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

  it("reports no_sql when the router throws", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
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

  it("dispatches `--dataset spider2-lite-sqlite` through the injected loader and tags the report (SK-QUAL-007)", async () => {
    const report = await runEval({
      dataset: "spider2-lite-sqlite",
      outDir,
      buildLanes: () => [
        {
          lane: "free",
          modelHint: "free-fake",
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
      // Tiny Spider-shaped fixture: one row with gold SQL (matches the
      // 24-of-135 path), one without (matches the 111-of-135 path).
      loadDataset: async () => ({
        questions: [
          {
            question_id: 0,
            instance_id: "local003",
            db_id: "pets",
            question: "How many cats?",
            evidence: "",
            sql: "SELECT COUNT(*) FROM pet WHERE species='cat'",
          },
          {
            question_id: 1,
            instance_id: "local007",
            db_id: "pets",
            question: "Career batting averages",
            evidence: "",
            // Empty gold SQL → SK-QUAL-007 short-circuit to gold_error.
            sql: "",
          },
        ],
        resolveDbPath: async () => join(dir, "dev_databases", "pets", "pets.sqlite"),
      }),
      writeReport: async () => "stub.json",
    });
    expect(report.dataset).toBe("spider2-lite-sqlite");
    const free = report.lanes.find((l) => l.lane === "free");
    // 1 match + 1 short-circuited gold_error → EA over the 1 scoreable row.
    expect(free?.match).toBe(1);
    expect(free?.gold_error).toBe(1);
    expect(free?.execution_accuracy).toBe(1);
    expect(report.results.find((r) => r.question_id === 0)?.instance_id).toBe("local003");
    expect(report.results.find((r) => r.question_id === 1)?.error).toMatch(/no gold SQL/);
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
