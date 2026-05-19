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
import { _testing, runEval } from "../src/runner.ts";
import type { EvalReport } from "../src/types.ts";

const { parseDatasetFlag } = _testing;

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

  it("dispatches `--dataset spider2-lite-sqlite` to the multi-CSV scorer for rows with a spider2 payload (SK-QUAL-008)", async () => {
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
