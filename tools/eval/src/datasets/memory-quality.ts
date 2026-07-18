// memory-quality — nlqdb's agent-memory-quality benchmark (SK-QUAL-023).
//
// persona-bench (SK-QUAL-018) measures NL→SQL EX over an ICP schema.
// memory-quality measures whether the *memory itself is good*: it seeds one
// `agent_memory_v1`-shaped corpus deliberately built to exercise the four
// quality axes the research landscape names
// (`docs/research/agent-memory-quality-landscape.md`), then scores each
// question with the existing result-set EX comparator (`score.ts`):
//
//   - retrieval    — return the correct SET of memory rows, and only those
//                    (cross-agent isolation = precision).
//   - temporal     — most-recent-wins, time-scoped ranges, event ordering.
//   - forgetting   — TTL expiry visibility + contradiction/supersession
//                    (a newer fact stales an older one).
//   - consolidation— dedup / distinct-entity counting over duplicate facts.
//   - analytical   — GROUP BY / top-N aggregation over memory (the wedge a
//                    vector store structurally can't answer).
//
// This module ships the four offline, EX-scorable axes. The
// analytical-memory-vs-vector head-to-head (SK-QUAL-023) needs an embedding
// baseline, pending E-05 (the free-chain embedding provider — LLM-router
// work, not infra) — a documented follow-on, not here.
// BIRD/Spider/persona-bench baselines are untouched.
//
// Determinism (mirrors persona-bench): gold SQL uses literal date bounds,
// never `date('now')`; the seed is sized so every gold returns a non-empty,
// hand-checked result and every ranked gold is tie-free (SK-QUAL-019).
//
// Sibling: `docs/features/quality-eval/decisions/SK-QUAL-023-agent-memory-quality-eval.md`.

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { EvalQuestion } from "../types.ts";

// The four measured quality axes plus the analytical-over-memory showcase.
export type MemoryAxis = "retrieval" | "temporal" | "forgetting" | "consolidation" | "analytical";

export type MemorySchema = {
  db_id: string;
  shape: string;
  // executable SQLite DDL + seed, applied in order (one statement each)
  setup: string[];
};

export type MemoryQuestion = {
  question_id: number;
  db_id: string;
  axis: MemoryAxis;
  question: string;
  sql: string;
  difficulty: "simple" | "moderate" | "challenging";
};

// One `agent_memory_v1`-shaped schema (agents / facts / episodes / entities),
// seeded so each axis has a hand-verifiable gold. Two agents (support-bot,
// sales-bot) exist so retrieval precision can be tested by cross-agent
// isolation. user:42's `city` changes NYC→SF→LA and `plan` free→pro
// (contradiction/supersession); user:99 carries an expired promo + active
// facts (TTL); `likes:coffee` is stored twice (dedup).
const AGENT_MEMORY_V1: MemorySchema = {
  db_id: "agent_memory_v1",
  shape: "agent memory — agents, facts (with TTL + supersession), episodes, entities",
  setup: [
    "CREATE TABLE agents (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "CREATE TABLE facts (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL REFERENCES agents(id), subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT)",
    "CREATE TABLE episodes (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL REFERENCES agents(id), content TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE entities (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL REFERENCES agents(id), kind TEXT NOT NULL, canonical_name TEXT NOT NULL)",
    "INSERT INTO agents (id, name) VALUES (1,'support-bot'),(2,'sales-bot')",
    "INSERT INTO facts (id, agent_id, subject, predicate, object, created_at, expires_at) VALUES " +
      // user:42 city — three values over time; current = LA (2026-06-15)
      "(1,1,'user:42','city','NYC','2026-05-01',NULL)," +
      "(2,1,'user:42','city','SF','2026-06-01',NULL)," +
      "(3,1,'user:42','city','LA','2026-06-15',NULL)," +
      // user:42 plan — superseded free → pro
      "(4,1,'user:42','plan','free','2026-05-10',NULL)," +
      "(5,1,'user:42','plan','pro','2026-06-20',NULL)," +
      // user:42 likes — coffee stored twice (a duplicate), tea once
      "(6,1,'user:42','likes','coffee','2026-05-02',NULL)," +
      "(7,1,'user:42','likes','coffee','2026-05-20',NULL)," +
      "(8,1,'user:42','likes','tea','2026-06-02',NULL)," +
      // user:99 — TTL: promo expired 06-10, trial active until 06-30, status permanent
      "(9,1,'user:99','promo','SAVE10','2026-06-01','2026-06-10')," +
      "(10,1,'user:99','status','active','2026-06-02',NULL)," +
      "(11,1,'user:99','trial','ends','2026-06-05','2026-06-30')," +
      // sales-bot knows user:42 too — must NOT leak into support-bot's recall
      "(12,2,'user:42','owner','sales','2026-06-05',NULL)",
    "INSERT INTO episodes (id, agent_id, content, created_at) VALUES " +
      "(1,1,'greeted user:42','2026-05-01')," +
      "(2,1,'updated city to SF','2026-06-01')," +
      "(3,1,'updated city to LA','2026-06-15')," +
      "(4,2,'sent quote to user:42','2026-06-05')",
    "INSERT INTO entities (id, agent_id, kind, canonical_name) VALUES " +
      "(1,1,'person','user:42'),(2,1,'person','user:99'),(3,1,'org','acme')," +
      "(4,2,'person','user:42')",
  ],
};

export const MEMORY_QUALITY_SCHEMAS: MemorySchema[] = [AGENT_MEMORY_V1];

// Gold SQL is hand-checked against the seed above — every query returns a
// non-empty result; every ORDER BY gold is tie-free (SK-QUAL-019).
export const MEMORY_QUALITY_QUESTIONS: MemoryQuestion[] = [
  // ── retrieval: the right rows, and only the right rows ──────────────────
  {
    question_id: 0,
    db_id: "agent_memory_v1",
    axis: "retrieval",
    question: "List every fact support-bot has stored about user:42 — its predicate and object.",
    sql:
      "SELECT f.predicate, f.object FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.subject = 'user:42'",
    difficulty: "simple",
  },
  {
    question_id: 1,
    db_id: "agent_memory_v1",
    axis: "retrieval",
    question: "What does support-bot know about user:99? Show predicate and object.",
    sql:
      "SELECT f.predicate, f.object FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.subject = 'user:99'",
    difficulty: "simple",
  },
  {
    question_id: 2,
    db_id: "agent_memory_v1",
    axis: "retrieval",
    question: "Which subjects does sales-bot have any fact about?",
    sql:
      "SELECT DISTINCT f.subject FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'sales-bot'",
    difficulty: "moderate",
  },
  // ── temporal: recency, time-scoping, ordering ───────────────────────────
  {
    question_id: 3,
    db_id: "agent_memory_v1",
    axis: "temporal",
    question: "According to support-bot, what is user:42's current city?",
    sql:
      "SELECT f.object FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.subject = 'user:42' AND f.predicate = 'city' " +
      "ORDER BY f.created_at DESC LIMIT 1",
    difficulty: "moderate",
  },
  {
    question_id: 4,
    db_id: "agent_memory_v1",
    axis: "temporal",
    question:
      "Which facts about user:42 did support-bot learn in June 2026? Show predicate, object, and when.",
    sql:
      "SELECT f.predicate, f.object, f.created_at FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.subject = 'user:42' " +
      "AND f.created_at >= '2026-06-01' AND f.created_at < '2026-07-01'",
    difficulty: "moderate",
  },
  {
    question_id: 5,
    db_id: "agent_memory_v1",
    axis: "temporal",
    question: "List support-bot's episodes in chronological order — content and date.",
    sql:
      "SELECT e.content, e.created_at FROM episodes e JOIN agents a ON e.agent_id = a.id " +
      "WHERE a.name = 'support-bot' ORDER BY e.created_at",
    difficulty: "moderate",
  },
  // ── forgetting: TTL expiry + contradiction/supersession ─────────────────
  {
    question_id: 6,
    db_id: "agent_memory_v1",
    axis: "forgetting",
    question: "How many of support-bot's facts had expired as of 2026-06-21?",
    sql:
      "SELECT COUNT(*) FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.expires_at IS NOT NULL AND f.expires_at < '2026-06-21'",
    difficulty: "simple",
  },
  {
    question_id: 7,
    db_id: "agent_memory_v1",
    axis: "forgetting",
    question:
      "List support-bot's facts about user:99 that were still active — not expired — as of 2026-06-21. Show predicate and object.",
    sql:
      "SELECT f.predicate, f.object FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.subject = 'user:99' " +
      "AND (f.expires_at IS NULL OR f.expires_at >= '2026-06-21')",
    difficulty: "moderate",
  },
  {
    question_id: 8,
    db_id: "agent_memory_v1",
    axis: "forgetting",
    question:
      "How many of support-bot's user:42 city facts are stale — superseded by a more recent city fact?",
    sql:
      "SELECT COUNT(*) FROM facts f WHERE f.agent_id = 1 AND f.subject = 'user:42' " +
      "AND f.predicate = 'city' AND f.created_at < " +
      "(SELECT MAX(g.created_at) FROM facts g WHERE g.agent_id = 1 AND g.subject = 'user:42' AND g.predicate = 'city')",
    difficulty: "challenging",
  },
  // ── consolidation: dedup + distinct entities ────────────────────────────
  {
    question_id: 9,
    db_id: "agent_memory_v1",
    axis: "consolidation",
    question:
      "How many distinct things does user:42 like, according to support-bot? Ignore duplicates.",
    sql:
      "SELECT COUNT(DISTINCT f.object) FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.subject = 'user:42' AND f.predicate = 'likes'",
    difficulty: "moderate",
  },
  {
    question_id: 10,
    db_id: "agent_memory_v1",
    axis: "consolidation",
    question:
      "Which facts has support-bot stored more than once (same subject, predicate, object)? Show them with the count.",
    sql:
      "SELECT f.subject, f.predicate, f.object, COUNT(*) AS n FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' GROUP BY f.subject, f.predicate, f.object HAVING COUNT(*) > 1",
    difficulty: "challenging",
  },
  {
    question_id: 11,
    db_id: "agent_memory_v1",
    axis: "consolidation",
    question: "How many distinct entities does support-bot track?",
    sql: "SELECT COUNT(*) FROM entities e JOIN agents a ON e.agent_id = a.id WHERE a.name = 'support-bot'",
    difficulty: "simple",
  },
  // ── analytical: aggregation over memory (the wedge) ─────────────────────
  {
    question_id: 12,
    db_id: "agent_memory_v1",
    axis: "analytical",
    question: "For support-bot, how many facts are stored per predicate? Show predicate and count.",
    sql:
      "SELECT f.predicate, COUNT(*) FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' GROUP BY f.predicate",
    difficulty: "moderate",
  },
  {
    question_id: 13,
    db_id: "agent_memory_v1",
    axis: "analytical",
    question:
      "Which subject does support-bot know the most facts about? Show the subject and the fact count.",
    sql:
      "SELECT f.subject, COUNT(*) AS n FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' GROUP BY f.subject ORDER BY n DESC LIMIT 1",
    difficulty: "moderate",
  },
  {
    question_id: 14,
    db_id: "agent_memory_v1",
    axis: "analytical",
    question:
      "How many facts does each agent have? Show the agent name and count, most facts first.",
    sql:
      "SELECT a.name, COUNT(*) AS n FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "GROUP BY a.id, a.name ORDER BY n DESC",
    difficulty: "challenging",
  },
];

export function schemaFor(db_id: string): MemorySchema | undefined {
  return MEMORY_QUALITY_SCHEMAS.find((s) => s.db_id === db_id);
}

// question_id → axis, so a consumer of the runner's per-question results can
// break EX down by axis without re-importing the whole question list.
export function axisFor(question_id: number): MemoryAxis | undefined {
  return MEMORY_QUALITY_QUESTIONS.find((q) => q.question_id === question_id)?.axis;
}

// ── Runner wiring — make memory-quality a dispatchable `EvalDataset`, the
//    same shape as persona-bench: the one in-memory schema is materialised to
//    a real `.sqlite` on first request (the runner opens fixtures by path,
//    readonly) and cached. `bun:sqlite` stays a dynamic import so this module
//    is importable from a plain type context; nothing in the bird/spider
//    paths changes.
export async function loadMemoryQuality(
  opts: { axis?: MemoryAxis; limit?: number; dbDir?: string } = {},
): Promise<{
  questions: EvalQuestion[];
  resolveDbPath: (db_id: string) => Promise<string | null>;
}> {
  const questions = toEvalQuestions({ axis: opts.axis, limit: opts.limit });
  const { Database } = (await import(/* @vite-ignore */ "bun:sqlite")) as {
    Database: new (filename: string) => { run: (sql: string) => void; close: () => void };
  };
  const dir = opts.dbDir ?? mkdtempSync(join(tmpdir(), "memory-quality-"));
  mkdirSync(dir, { recursive: true });

  const cache = new Map<string, string>();
  return {
    questions,
    resolveDbPath: async (db_id) => {
      const cached = cache.get(db_id);
      if (cached) return cached;
      const schema = schemaFor(db_id);
      if (!schema) return null;
      const file = join(dir, `${db_id}.sqlite`);
      rmSync(file, { force: true }); // fresh, deterministic seed each load
      const db = new Database(file);
      for (const stmt of schema.setup) db.run(stmt);
      db.close();
      cache.set(db_id, file);
      return file;
    },
  };
}

// Project to the canonical harness type — `evidence` is empty (like persona
// rows). `axis` narrows to one quality axis for a lever-focused run.
export function toEvalQuestions(opts: { axis?: MemoryAxis; limit?: number } = {}): EvalQuestion[] {
  let qs = MEMORY_QUALITY_QUESTIONS;
  if (opts.axis) qs = qs.filter((q) => q.axis === opts.axis);
  if (opts.limit !== undefined) qs = qs.slice(0, Math.max(0, opts.limit));
  return qs.map((q) => ({
    question_id: q.question_id,
    db_id: q.db_id,
    question: q.question,
    evidence: "",
    sql: q.sql,
    difficulty: q.difficulty,
  }));
}

// A minimal SQLite handle — structural so this module never imports
// `bun:sqlite` directly (the runner / test inject a real one).
export type MemoryDb = { run: (sql: string) => void; query: (sql: string) => unknown[] };

export type GoldCheck = {
  question_id: number;
  db_id: string;
  axis: MemoryAxis;
  ok: boolean;
  rows: number;
  error?: string;
};

// The invariant: every gold SQL executes against its seeded schema and
// returns at least one row. Pure given the injected `openDb`, so the test and
// the `import.meta.main` CLI share it.
export function checkGoldExecutability(
  openDb: (schema: MemorySchema) => MemoryDb,
  opts: { axis?: MemoryAxis } = {},
): GoldCheck[] {
  const out: GoldCheck[] = [];
  for (const schema of MEMORY_QUALITY_SCHEMAS) {
    const db = openDb(schema);
    for (const stmt of schema.setup) db.run(stmt);
    for (const q of MEMORY_QUALITY_QUESTIONS.filter((x) => x.db_id === schema.db_id)) {
      if (opts.axis && q.axis !== opts.axis) continue;
      try {
        const rows = db.query(q.sql);
        out.push({
          question_id: q.question_id,
          db_id: q.db_id,
          axis: q.axis,
          ok: rows.length > 0,
          rows: rows.length,
        });
      } catch (err) {
        out.push({
          question_id: q.question_id,
          db_id: q.db_id,
          axis: q.axis,
          ok: false,
          rows: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return out;
}

// `bun memory-quality` — runs the gold-executability check over an in-memory
// bun:sqlite db and prints the axis coverage. Read-only, no network, no LLM.
if (import.meta.main) {
  const mod = (await import(/* @vite-ignore */ "bun:sqlite")) as {
    Database: new (
      filename: string,
    ) => {
      run: (sql: string) => void;
      query: (sql: string) => { all: () => unknown[] };
      close: () => void;
    };
  };
  const checks = checkGoldExecutability((_schema) => {
    const db = new mod.Database(":memory:");
    return { run: (sql) => db.run(sql), query: (sql) => db.query(sql).all() };
  });
  const ok = checks.filter((c) => c.ok).length;
  for (const c of checks) {
    if (!c.ok)
      console.error(`  ✗ ${c.db_id} q${c.question_id} (${c.axis}): ${c.error ?? "0 rows"}`);
  }
  const byAxis = new Map<MemoryAxis, number>();
  for (const q of MEMORY_QUALITY_QUESTIONS) byAxis.set(q.axis, (byAxis.get(q.axis) ?? 0) + 1);
  const axes = [...byAxis.entries()].map(([a, n]) => `${a} ${n}`).join(", ");
  console.info(`memory-quality: ${ok}/${checks.length} golds execute (non-empty). Axes: ${axes}.`);
  if (ok !== checks.length) process.exit(1);
}
