// SK-QUAL-011 — resumable runner: deterministic sampling, budget-stop on
// a whole-chain rate-limit, and resume-to-completion producing the same
// scoring as a single-shot run.

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlanRequest, PlanResponse } from "@nlqdb/llm";
import { AllProvidersFailedError } from "@nlqdb/llm";
import { checkpointPath } from "../src/checkpoint.ts";
import type { Lane } from "../src/lanes.ts";
import { _testing, runEval } from "../src/runner.ts";
import type { EvalQuestion, EvalReport } from "../src/types.ts";

const { sampleQuestions, isChainTransientWall } = _testing;

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

// Always-correct planner for the BIRD fixture above.
function correctSql(goal: string): string {
  return goal.includes("How many")
    ? "SELECT COUNT(*) FROM pet WHERE species='cat'"
    : "SELECT name FROM pet ORDER BY id DESC LIMIT 1";
}

function freeLane(plan: (req: PlanRequest) => Promise<PlanResponse>): Lane {
  const notUsed = (op: string) => () => {
    throw new Error(`${op} should not be called`);
  };
  return {
    lane: "free",
    modelHint: "free-fake",
    maxAttempts: 1,
    router: {
      plan,
      route: notUsed("route") as never,
      summarize: notUsed("summarize") as never,
      schemaInfer: notUsed("schemaInfer") as never,
      engineClassify: notUsed("engineClassify") as never,
    },
  };
}

const RATE_LIMITED = new AllProvidersFailedError("chain rate-limited", [
  { provider: "gemini", reason: "rate_limited", error: new Error("429") },
  { provider: "groq", reason: "rate_limited", error: new Error("429") },
]);

// Zero the wall-clock-variant fields so a resumed run and a single-shot
// run can be compared for identical *scoring*.
function normalize(r: EvalReport): EvalReport {
  return {
    ...r,
    run_at: "X",
    lanes: r.lanes.map((l) => ({ ...l, p50_latency_ms: 0, p95_latency_ms: 0 })),
    results: r.results.map((x) => ({ ...x, latency_ms: 0 })),
  };
}

describe("SK-QUAL-011 — sampleQuestions", () => {
  const qs: EvalQuestion[] = Array.from({ length: 10 }, (_, i) => ({
    question_id: i,
    db_id: "d",
    question: `q${i}`,
    evidence: "",
    sql: "",
  }));

  it("is deterministic for a fixed seed and returns `limit` questions in id order", () => {
    const a = sampleQuestions(qs, 4, 42);
    const b = sampleQuestions(qs, 4, 42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    const ids = a.map((q) => q.question_id);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
    // Every picked question is from the source set.
    expect(ids.every((id) => id >= 0 && id < 10)).toBe(true);
  });

  it("returns the whole set (sorted) when limit >= length", () => {
    expect(sampleQuestions(qs, 100, 1).map((q) => q.question_id)).toEqual(
      qs.map((q) => q.question_id),
    );
  });
});

describe("SK-QUAL-013 — isChainTransientWall", () => {
  it("is true when every attempt is rate_limited or circuit_open", () => {
    expect(isChainTransientWall(RATE_LIMITED)).toBe(true);
    // The post-429 shape: the breaker opened on an earlier question, so
    // later questions see circuit_open — same capacity exhaustion.
    const breakerWall = new AllProvidersFailedError("wall", [
      { provider: "gemini", reason: "circuit_open", error: undefined },
      { provider: "groq", reason: "circuit_open", error: undefined },
    ]);
    expect(isChainTransientWall(breakerWall)).toBe(true);
    const mixedCapacity = new AllProvidersFailedError("mixed-capacity", [
      { provider: "gemini", reason: "rate_limited", error: new Error("429") },
      { provider: "groq", reason: "circuit_open", error: undefined },
    ]);
    expect(isChainTransientWall(mixedCapacity)).toBe(true);
  });

  it("is true when transport reasons (SK-QUAL-020) mix into a capacity wall", () => {
    // The 2026-07-08 Spider shape: breaker-walled chain with one provider
    // failing on `network` — zero engine signal end-to-end, so it must
    // pause, not score no_sql.
    const capacityPlusTransport = new AllProvidersFailedError("wall+transport", [
      { provider: "cerebras", reason: "circuit_open", error: undefined },
      { provider: "gemini", reason: "rate_limited", error: new Error("429") },
      { provider: "workers-ai", reason: "network", error: new Error("fetch failed") },
      { provider: "mistral", reason: "timeout", error: new Error("timed out") },
    ]);
    expect(isChainTransientWall(capacityPlusTransport)).toBe(true);
    const allTransport = new AllProvidersFailedError("transport-only", [
      { provider: "gemini", reason: "network", error: new Error("fetch failed") },
      { provider: "groq", reason: "timeout", error: new Error("timed out") },
    ]);
    expect(isChainTransientWall(allTransport)).toBe(true);
  });

  it("is false for config reasons (never self-recover — must stay loud, SK-QUAL-020)", () => {
    const capacityPlusConfig = new AllProvidersFailedError("wall+config", [
      { provider: "cerebras", reason: "circuit_open", error: undefined },
      { provider: "groq", reason: "not_configured", error: undefined },
    ]);
    expect(isChainTransientWall(capacityPlusConfig)).toBe(false);
    const authWall = new AllProvidersFailedError("auth-wall", [
      { provider: "openrouter", reason: "auth_denied", error: new Error("401") },
    ]);
    expect(isChainTransientWall(authWall)).toBe(false);
  });

  it("is false for genuine failures (any answer-signal reason) and non-chain errors", () => {
    const mixed = new AllProvidersFailedError("mixed", [
      { provider: "gemini", reason: "rate_limited", error: new Error("429") },
      { provider: "groq", reason: "http_5xx", error: new Error("503") },
    ]);
    expect(isChainTransientWall(mixed)).toBe(false);
    // A `parse` attempt means a model was reached and answered non-SQL —
    // engine signal, so the row scores no_sql instead of pausing.
    const capacityPlusParse = new AllProvidersFailedError("wall+parse", [
      { provider: "cerebras", reason: "circuit_open", error: undefined },
      { provider: "workers-ai", reason: "parse", error: new Error("not SQL") },
    ]);
    expect(isChainTransientWall(capacityPlusParse)).toBe(false);
    expect(isChainTransientWall(new Error("plain"))).toBe(false);
  });
});

describe("SK-QUAL-011 — runner resume + budget stop", () => {
  let dir: string;
  let questionsPath: string;
  let outDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-resume-"));
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

  it("budget-stops on a whole-chain rate-limit: resumable, keeps the checkpoint, does NOT emit", async () => {
    const emitMock = mock(async () => ({ accepted: true, status: 202 }));
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      runAt: "2026-06-07T00:00:00Z",
      // Q0 scores; Q1 rate-limits the whole chain → budget stop.
      buildLanes: () =>
        [
          freeLane(async (req) => {
            if (req.goal.includes("Newest")) throw RATE_LIMITED;
            return { sql: correctSql(req.goal), model: "free-m", confidence: 1 };
          }),
        ] as Lane[],
      writeReport: async () => "stub.json",
      emitUrl: "https://api.test",
      emitToken: "tok",
      emitEvalReport: emitMock as unknown as typeof import("../src/emit.ts").emitEvalReport,
    });

    expect(report.resumable).toBe(true);
    expect(emitMock).not.toHaveBeenCalled();
    // Q0 was scored and checkpointed; Q1 is not in the report yet.
    expect(report.results).toHaveLength(1);
    expect(report.results[0]?.question_id).toBe(0);
    // Checkpoint kept for the next dispatch.
    expect(existsSync(checkpointPath(outDir, "bird-mini-dev-sqlite"))).toBe(true);
  });

  it("SK-QUAL-013: waits once on capacity exhaustion and keeps measuring when the chain recovers", async () => {
    let planCalls = 0;
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      runAt: "2026-06-07T00:00:00Z",
      capacityWaitMs: 5,
      // Q1's first plan() hits a breaker wall; the post-wait retry recovers.
      buildLanes: () =>
        [
          freeLane(async (req) => {
            planCalls++;
            if (req.goal.includes("Newest") && planCalls === 2) {
              throw new AllProvidersFailedError("wall", [
                { provider: "gemini", reason: "circuit_open", error: undefined },
                { provider: "groq", reason: "rate_limited", error: new Error("429") },
              ]);
            }
            return { sql: correctSql(req.goal), model: "free-m", confidence: 1 };
          }),
        ] as Lane[],
      writeReport: async () => "stub.json",
    });

    expect(report.resumable).toBeUndefined();
    expect(report.lanes.find((l) => l.lane === "free")?.match).toBe(2);
    expect(report.lanes.find((l) => l.lane === "free")?.no_sql).toBe(0);
  });

  it("SK-QUAL-013: capacity waits are capped per run — the 6th wall budget-stops without waiting", async () => {
    // 7 questions; every question's FIRST plan() hits a wall, the
    // post-wait retry recovers. Budget = 5 waits ⇒ q0..q4 recover, q5's
    // wall finds an empty budget and budget-stops the run.
    const sevenPath = join(dir, "seven.json");
    writeFileSync(
      sevenPath,
      JSON.stringify(
        Array.from({ length: 7 }, (_, i) => ({
          question_id: i,
          db_id: "pets",
          question: `How many cats? v${i}`,
          evidence: "",
          SQL: "SELECT COUNT(*) FROM pet WHERE species='cat'",
        })),
      ),
    );
    const walled = new Set<string>();
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: sevenPath,
      outDir,
      runAt: "2026-06-07T00:00:00Z",
      capacityWaitMs: 5,
      buildLanes: () =>
        [
          freeLane(async (req) => {
            if (!walled.has(req.goal)) {
              walled.add(req.goal);
              throw new AllProvidersFailedError("wall", [
                { provider: "gemini", reason: "circuit_open", error: undefined },
              ]);
            }
            return { sql: correctSql(req.goal), model: "free-m", confidence: 1 };
          }),
        ] as Lane[],
      writeReport: async () => "stub.json",
    });
    expect(report.resumable).toBe(true);
    expect(report.results).toHaveLength(5); // q0..q4 scored via budgeted waits
    expect(report.lanes.find((l) => l.lane === "free")?.match).toBe(5);
  });

  it("SK-QUAL-013: budget-stops when the chain is still exhausted after the one wait", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      runAt: "2026-06-07T00:00:00Z",
      capacityWaitMs: 5,
      buildLanes: () =>
        [
          freeLane(async (req) => {
            if (req.goal.includes("Newest")) {
              throw new AllProvidersFailedError("wall", [
                { provider: "gemini", reason: "circuit_open", error: undefined },
                { provider: "groq", reason: "circuit_open", error: undefined },
              ]);
            }
            return { sql: correctSql(req.goal), model: "free-m", confidence: 1 };
          }),
        ] as Lane[],
      writeReport: async () => "stub.json",
    });

    expect(report.resumable).toBe(true);
    // Q0 scored; Q1 paused for the next dispatch — never recorded as no_sql.
    expect(report.results).toHaveLength(1);
    expect(existsSync(checkpointPath(outDir, "bird-mini-dev-sqlite"))).toBe(true);
  });

  it("resumes from the checkpoint and completes with the same scoring as a single-shot run", async () => {
    const fixed = "2026-06-07T00:00:00Z";
    const base = {
      dataDir: dir,
      questionsJsonPath: questionsPath,
      runAt: fixed,
      writeReport: async () => "stub.json",
    };

    // Single-shot: always-correct planner over a fresh dir.
    const singleShot = await runEval({
      ...base,
      outDir: join(dir, "single"),
      buildLanes: () =>
        [
          freeLane(async (req) => ({ sql: correctSql(req.goal), model: "free-m", confidence: 1 })),
        ] as Lane[],
    });
    expect(singleShot.resumable).toBeUndefined();

    // Two-phase over a shared dir: phase 1 budget-stops on Q1.
    const resumeDir = join(dir, "resume");
    const phase1 = await runEval({
      ...base,
      outDir: resumeDir,
      buildLanes: () =>
        [
          freeLane(async (req) => {
            if (req.goal.includes("Newest")) throw RATE_LIMITED;
            return { sql: correctSql(req.goal), model: "free-m", confidence: 1 };
          }),
        ] as Lane[],
    });
    expect(phase1.resumable).toBe(true);
    expect(existsSync(checkpointPath(resumeDir, "bird-mini-dev-sqlite"))).toBe(true);

    // Phase 2: chain recovered → resume skips Q0, finishes Q1, completes.
    const phase2 = await runEval({
      ...base,
      outDir: resumeDir,
      buildLanes: () =>
        [
          freeLane(async (req) => ({ sql: correctSql(req.goal), model: "free-m", confidence: 1 })),
        ] as Lane[],
    });

    expect(phase2.resumable).toBeUndefined();
    // Completed run drops the checkpoint.
    expect(existsSync(checkpointPath(resumeDir, "bird-mini-dev-sqlite"))).toBe(false);
    // Resume produces identical scoring to the single-shot run.
    expect(normalize(phase2)).toEqual(normalize(singleShot));
    expect(phase2.lanes.find((l) => l.lane === "free")?.match).toBe(2);
  });
});
