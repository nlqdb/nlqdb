// SK-QUAL-020 — transport-collapse guard: a run where the whole provider
// chain was unreachable end-to-end (every scored row a network/timeout/
// config failure, never an LLM answer) is an outage, not an engine
// measurement. It must not compare to the baseline, must not emit, must
// drop the poisoned all-`no_sql` checkpoint, and must exit non-zero.

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlanRequest, PlanResponse } from "@nlqdb/llm";
import { AllProvidersFailedError } from "@nlqdb/llm";
import { checkpointPath } from "../src/checkpoint.ts";
import type { Lane } from "../src/lanes.ts";
import { _testing, runEval } from "../src/runner.ts";
import type { EvalReport, LaneSummary } from "../src/types.ts";

const { isTransportCollapse } = _testing;

// Minimal LaneSummary builder — only the fields the guard reads matter.
function lane(over: Partial<LaneSummary>): LaneSummary {
  return {
    lane: "free",
    attempted: 0,
    match: 0,
    mismatch: 0,
    exec_error: 0,
    no_sql: 0,
    gold_error: 0,
    execution_accuracy: 0,
    p50_latency_ms: 0,
    p95_latency_ms: 0,
    ...over,
  };
}

describe("SK-QUAL-020 — isTransportCollapse", () => {
  it("is true when every ran lane is all-no_sql with only transport/config reasons", () => {
    expect(
      isTransportCollapse([
        lane({
          attempted: 20,
          no_sql: 20,
          no_sql_reasons: {
            "gemini:network": 12,
            "groq:network": 6,
            "workers-ai:not_configured": 2,
          },
        }),
      ]),
    ).toBe(true);
    // auth_denied (revoked key / unlinked billing) is a config outage too.
    expect(
      isTransportCollapse([
        lane({ attempted: 5, no_sql: 5, no_sql_reasons: { "openrouter:auth_denied": 5 } }),
        lane({
          lane: "frontier",
          attempted: 5,
          no_sql: 5,
          no_sql_reasons: { "openrouter:timeout": 5 },
        }),
      ]),
    ).toBe(true);
  });

  it("is false when any question got an engine answer (match / mismatch / exec_error)", () => {
    expect(
      isTransportCollapse([
        lane({ attempted: 20, match: 1, no_sql: 19, no_sql_reasons: { "gemini:network": 19 } }),
      ]),
    ).toBe(false);
    expect(
      isTransportCollapse([
        lane({ attempted: 20, mismatch: 3, no_sql: 17, no_sql_reasons: { "gemini:network": 17 } }),
      ]),
    ).toBe(false);
    expect(
      isTransportCollapse([
        lane({
          attempted: 20,
          exec_error: 2,
          no_sql: 18,
          no_sql_reasons: { "gemini:network": 18 },
        }),
      ]),
    ).toBe(false);
  });

  it("is false when a no_sql reason is real engine signal (parse / http_4xx / http_5xx)", () => {
    // The model returned non-SQL — a genuine engine failure, never suppressed.
    expect(
      isTransportCollapse([
        lane({ attempted: 20, no_sql: 20, no_sql_reasons: { "gemini:parse": 20 } }),
      ]),
    ).toBe(false);
    // A 4xx mixed in with network must still surface (not auto-suppressed).
    expect(
      isTransportCollapse([
        lane({
          attempted: 20,
          no_sql: 20,
          no_sql_reasons: { "gemini:network": 18, "groq:http_4xx": 2 },
        }),
      ]),
    ).toBe(false);
  });

  it("is false for a clean / empty run and for a lane with no no_sql rows", () => {
    expect(isTransportCollapse([])).toBe(false);
    expect(isTransportCollapse([lane({ attempted: 0 })])).toBe(false);
    expect(isTransportCollapse([lane({ attempted: 20, match: 18, mismatch: 2 })])).toBe(false);
    // All gold_error, no no_sql — a dataset problem, not a transport outage.
    expect(isTransportCollapse([lane({ attempted: 4, gold_error: 4 })])).toBe(false);
  });

  it("requires EVERY ran lane to collapse — a single answering lane vetoes", () => {
    expect(
      isTransportCollapse([
        lane({ attempted: 20, no_sql: 20, no_sql_reasons: { "gemini:network": 20 } }),
        lane({ lane: "frontier", attempted: 20, match: 15, mismatch: 5 }),
      ]),
    ).toBe(false);
  });
});

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

// The real router stamps this exact message; `noSqlReasons` parses the tags
// out of the trailing `(...)`, so the e2e path exercises the real parse.
// A CONFIG outage (revoked keys), not a transient one — an all-`network`
// wall now pauses per-question (isChainTransientWall, SK-QUAL-013) and
// never reaches the run-level collapse.
function unreachable(): AllProvidersFailedError {
  return new AllProvidersFailedError(
    "llm.plan: all providers in chain failed (cerebras:auth_denied, gemini:auth_denied, groq:not_configured, openrouter:auth_denied, mistral:auth_denied)",
    [
      { provider: "cerebras", reason: "auth_denied", error: new Error("401") },
      { provider: "gemini", reason: "auth_denied", error: new Error("401") },
      { provider: "groq", reason: "not_configured", error: undefined },
      { provider: "openrouter", reason: "auth_denied", error: new Error("401") },
      { provider: "mistral", reason: "auth_denied", error: new Error("401") },
    ],
  );
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

describe("SK-QUAL-020 — runEval transport collapse", () => {
  let dir: string;
  let questionsPath: string;
  let outDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-transport-"));
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

  it("flags transport_failed, never compares the baseline, and drops the checkpoint", async () => {
    let baselineRead = false;
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      // A baseline path is set — the guard must skip the comparison.
      baselinePath: join(dir, "baseline.json"),
      readBaseline: async (): Promise<EvalReport> => {
        baselineRead = true;
        throw new Error("baseline should not be read on a transport collapse");
      },
      buildLanes: () => [
        freeLane(async () => {
          throw unreachable();
        }),
      ],
    });

    expect(report.transport_failed).toBe(true);
    expect(report.baseline).toBeUndefined();
    expect(baselineRead).toBe(false);
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.execution_accuracy).toBe(0);
    expect(free?.no_sql).toBe(2);
    expect(free?.no_sql_reasons?.["gemini:auth_denied"]).toBe(2);
    // The poisoned all-no_sql checkpoint must be dropped so the re-run is fresh.
    expect(existsSync(checkpointPath(outDir, "bird-mini-dev-sqlite", "full"))).toBe(false);
  });

  it("an all-`network` wall pauses (SK-QUAL-013 budget-stop), never scoring no_sql", async () => {
    // The transient-transport sibling of the capacity wall: the chain was
    // unreachable for a moment, not misconfigured — resumable, checkpoint
    // kept, no transport_failed flag, nothing scored.
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        freeLane(async () => {
          throw new AllProvidersFailedError(
            "llm.plan: all providers in chain failed (gemini:network, groq:network)",
            [
              { provider: "gemini", reason: "network", error: new Error("ECONNRESET") },
              { provider: "groq", reason: "network", error: new Error("ECONNRESET") },
            ],
          );
        }),
      ],
    });
    expect(report.resumable).toBe(true);
    expect(report.transport_failed).toBeUndefined();
    const free = report.lanes.find((l) => l.lane === "free");
    expect(free?.no_sql ?? 0).toBe(0);
    // Nothing was scored, so there is no poisoned row to replay on resume.
    expect(report.results).toHaveLength(0);
  });

  it("does NOT flag a run that produced engine signal (one real mismatch)", async () => {
    const report = await runEval({
      dataDir: dir,
      questionsJsonPath: questionsPath,
      outDir,
      buildLanes: () => [
        freeLane(async (req) =>
          // Answer one question wrong (engine signal), the chain is up.
          req.goal.includes("How many")
            ? { sql: "SELECT 999", model: "m", confidence: 1 }
            : { sql: "SELECT name FROM pet ORDER BY id DESC LIMIT 1", model: "m", confidence: 1 },
        ),
      ],
    });
    expect(report.transport_failed).toBeUndefined();
    const free = report.lanes.find((l) => l.lane === "free");
    expect((free?.match ?? 0) + (free?.mismatch ?? 0)).toBe(2);
  });
});
