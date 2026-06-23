// persona-bench — nlqdb's OWN ICP-shaped NL→SQL benchmark (SK-QUAL-018).
//
// BIRD/Spider measure messy public schemas; neither looks like what an
// nlqdb user actually creates. persona-bench is the third, user-relevant
// quality number the GLOBAL-027 §Lifecycle resolution kept as agent work:
// ~NL questions over the 4–8-table schemas the `docs/research/personas.md`
// P1 (Solo Builder) + P2 (Agent Builder) actually build, with executable
// gold SQL drawn from each persona's "Representative queries".
//
// v0 ships the **fixture + gold-executability invariant only** — the data
// half. The runner-wiring (a `persona-bench` EvalDataset + `resolveDbPath`
// that materialises these schemas to a `.sqlite` so the free chain scores
// EX against them) is the staged follow-on, the same offline-first split
// SK-LLM-041 / SK-QUAL-017 used. So no prod path imports this and no
// `runner.ts` edit lands here — BIRD/Spider baselines are untouched; the
// free-chain EX delta is the next canonical dispatch.
//
// Determinism: gold SQL uses **literal date bounds**, never `date('now')`,
// so a "signups this month" persona phrasing compiles to a time-stable
// gold the test can assert forever. The seed is sized so every gold
// returns a non-empty, hand-checked result set.
//
// Sibling: `docs/features/quality-eval/decisions/SK-QUAL-018-persona-bench.md`.

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { EvalQuestion } from "../types.ts";

export type Persona = "P1" | "P2";

export type PersonaSchema = {
  db_id: string;
  persona: Persona;
  // one-line description of the ICP shape this schema stands in for
  shape: string;
  // executable SQLite DDL + seed, applied in order (one statement each)
  setup: string[];
};

export type PersonaQuestion = {
  question_id: number;
  db_id: string;
  persona: Persona;
  question: string;
  sql: string;
  // the SK-QUAL-014 structural bucket the question exercises (so a future
  // mismatch analysis can attribute persona-bench losses the same way)
  bucket: string;
  difficulty: "simple" | "moderate" | "challenging";
};

// ── P1 — Solo Builder: a typical side-project SaaS (plans / referrers /
//    users / orders). The "how many signups this week, who hasn't logged
//    in, export last month's orders" shape from personas.md §P1.
const SAAS_APP: PersonaSchema = {
  db_id: "saas_app",
  persona: "P1",
  shape: "side-project SaaS — plans, referral source, users, orders",
  setup: [
    "CREATE TABLE plans (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL)",
    "CREATE TABLE referrers (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, name TEXT, plan_id INTEGER REFERENCES plans(id), referrer_id INTEGER REFERENCES referrers(id), signup_date TEXT NOT NULL, last_login_at TEXT)",
    "CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), amount_cents INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
    "INSERT INTO plans (id, name, price_cents) VALUES (1,'Free',0),(2,'Pro',2000),(3,'Team',5000)",
    "INSERT INTO referrers (id, name) VALUES (1,'hackernews'),(2,'twitter'),(3,'google')",
    "INSERT INTO users (id, email, name, plan_id, referrer_id, signup_date, last_login_at) VALUES " +
      "(1,'maya@x.com','Maya',2,1,'2026-03-02','2026-06-01 09:00')," +
      "(2,'sam@x.com','Sam',1,2,'2026-03-10',NULL)," +
      "(3,'lee@x.com','Lee',2,2,'2026-03-15','2026-06-10 12:00')," +
      "(4,'ana@x.com','Ana',3,3,'2026-04-05','2026-06-15 08:00')," +
      "(5,'rob@x.com','Rob',1,1,'2026-02-20',NULL)," +
      "(6,'kim@x.com','Kim',2,3,'2026-03-28','2026-06-18 18:00')",
    "INSERT INTO orders (id, user_id, amount_cents, status, created_at) VALUES " +
      "(1,1,2000,'paid','2026-03-05')," +
      "(2,1,2000,'paid','2026-04-05')," +
      "(3,3,2000,'paid','2026-03-20')," +
      "(4,4,5000,'refunded','2026-04-10')," +
      "(5,6,2000,'paid','2026-04-01')," +
      "(6,6,2000,'paid','2026-05-01')",
  ],
};

// ── P2 — Agent Builder: the analytical-memory wedge (GLOBAL-036). Agents
//    write facts/episodes; the queries are the GROUP BY / top-N / TTL
//    *analytics over memory* a vector store structurally can't answer.
const AGENT_MEMORY: PersonaSchema = {
  db_id: "agent_memory",
  persona: "P2",
  shape: "agent memory — agents, facts (with TTL), episodes, recalls",
  setup: [
    "CREATE TABLE agents (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "CREATE TABLE facts (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL REFERENCES agents(id), subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT)",
    "CREATE TABLE episodes (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL REFERENCES agents(id), content TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE recalls (id INTEGER PRIMARY KEY, fact_id INTEGER NOT NULL REFERENCES facts(id), recalled_at TEXT NOT NULL)",
    "INSERT INTO agents (id, name) VALUES (1,'support-bot'),(2,'sales-bot'),(3,'ops-bot')",
    "INSERT INTO facts (id, agent_id, subject, predicate, object, created_at, expires_at) VALUES " +
      "(1,1,'user:42','prefers','email','2026-06-01',NULL)," +
      "(2,1,'user:42','timezone','PST','2026-06-02',NULL)," +
      "(3,1,'user:99','prefers','sms','2026-06-03','2026-06-10')," +
      "(4,2,'lead:7','status','qualified','2026-06-04',NULL)," +
      "(5,2,'lead:7','budget','5000','2026-06-05','2026-07-01')," +
      "(6,1,'user:42','plan','pro','2026-06-06',NULL)," +
      "(7,3,'job:1','state','done','2026-06-07','2026-06-15')",
    "INSERT INTO episodes (id, agent_id, content, created_at) VALUES (1,1,'greeted user','2026-06-01'),(2,2,'sent quote','2026-06-04')",
    // Recall counts per fact are kept DISTINCT (fact 1→4, 2→3, 6→2, 4→1) so the
    // q8 "most-recalled facts" ranking has no count-tie: an ORDER BY-only gold is
    // scored sequence-strict (score.ts `hasOrderBy`), and an unbroken rank-key tie
    // false-mismatches a semantically-correct prediction that orders the tie
    // differently (SK-QUAL-019 tie-free-ranked-gold invariant). The recalled-fact
    // SET is unchanged ({1,2,4,6}) so the "never recalled" gold (q12-shape) holds.
    "INSERT INTO recalls (id, fact_id, recalled_at) VALUES " +
      "(1,1,'2026-06-08'),(2,1,'2026-06-09'),(3,1,'2026-06-10'),(9,1,'2026-06-11')," +
      "(4,2,'2026-06-09'),(5,2,'2026-06-11'),(10,2,'2026-06-12')," +
      "(6,4,'2026-06-12'),(7,6,'2026-06-13'),(8,6,'2026-06-14')",
  ],
};

export const PERSONA_BENCH_SCHEMAS: PersonaSchema[] = [SAAS_APP, AGENT_MEMORY];

// Gold SQL is hand-checked against the seed above — every query returns a
// non-empty result. Buckets mirror SK-QUAL-014's structural classes.
export const PERSONA_BENCH_QUESTIONS: PersonaQuestion[] = [
  {
    question_id: 0,
    db_id: "saas_app",
    persona: "P1",
    question: "Show the 10 most recent signups — email and signup date.",
    sql: "SELECT email, signup_date FROM users ORDER BY signup_date DESC LIMIT 10",
    bucket: "order-by-limit",
    difficulty: "simple",
  },
  {
    question_id: 1,
    db_id: "saas_app",
    persona: "P1",
    question: "How many users are on each plan?",
    sql: "SELECT p.name, COUNT(*) FROM users u JOIN plans p ON u.plan_id = p.id GROUP BY p.name",
    bucket: "group-by-count-join",
    difficulty: "moderate",
  },
  {
    question_id: 2,
    db_id: "saas_app",
    persona: "P1",
    question: "How many users signed up in March 2026, grouped by referral source?",
    sql:
      "SELECT r.name, COUNT(*) FROM users u JOIN referrers r ON u.referrer_id = r.id " +
      "WHERE u.signup_date >= '2026-03-01' AND u.signup_date < '2026-04-01' GROUP BY r.name",
    bucket: "group-by-count-date-range",
    difficulty: "moderate",
  },
  {
    question_id: 3,
    db_id: "saas_app",
    persona: "P1",
    question: "Which users signed up but have never logged in? List their emails.",
    sql: "SELECT email FROM users WHERE last_login_at IS NULL",
    bucket: "null-filter",
    difficulty: "simple",
  },
  {
    question_id: 4,
    db_id: "saas_app",
    persona: "P1",
    question: "What is the total revenue from paid orders, in dollars?",
    sql: "SELECT SUM(amount_cents) / 100.0 FROM orders WHERE status = 'paid'",
    bucket: "aggregate-real-cast",
    difficulty: "simple",
  },
  {
    question_id: 5,
    db_id: "saas_app",
    persona: "P1",
    question: "List the email of every user who has placed more than one order.",
    sql:
      "SELECT u.email FROM users u JOIN orders o ON o.user_id = u.id " +
      "GROUP BY u.id, u.email HAVING COUNT(*) > 1",
    bucket: "having",
    difficulty: "moderate",
  },
  {
    question_id: 6,
    db_id: "saas_app",
    persona: "P1",
    question: "What is the average order amount, in dollars, for users on the Pro plan?",
    sql:
      "SELECT AVG(o.amount_cents) / 100.0 FROM orders o JOIN users u ON o.user_id = u.id " +
      "JOIN plans p ON u.plan_id = p.id WHERE p.name = 'Pro'",
    bucket: "join-aggregate-real-cast",
    difficulty: "moderate",
  },
  {
    question_id: 7,
    db_id: "agent_memory",
    persona: "P2",
    question: "How many facts does each agent have? Show the agent name and the count.",
    sql: "SELECT a.name, COUNT(*) FROM facts f JOIN agents a ON f.agent_id = a.id GROUP BY a.name",
    bucket: "group-by-count-join",
    difficulty: "moderate",
  },
  {
    question_id: 8,
    db_id: "agent_memory",
    persona: "P2",
    question:
      "What are the 5 most-recalled facts? Show the fact object and how many times it was recalled.",
    sql:
      "SELECT f.object, COUNT(*) AS recall_count FROM recalls r JOIN facts f ON r.fact_id = f.id " +
      "GROUP BY f.id, f.object ORDER BY recall_count DESC LIMIT 5",
    bucket: "group-max-top-n",
    difficulty: "moderate",
  },
  {
    question_id: 9,
    db_id: "agent_memory",
    persona: "P2",
    question: "How many facts had expired as of 2026-06-21?",
    sql: "SELECT COUNT(*) FROM facts WHERE expires_at IS NOT NULL AND expires_at < '2026-06-21'",
    bucket: "ttl-date-range",
    difficulty: "simple",
  },
  {
    question_id: 10,
    db_id: "agent_memory",
    persona: "P2",
    question: "Which predicates does the agent named 'support-bot' use, and how often?",
    sql:
      "SELECT f.predicate, COUNT(*) FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' GROUP BY f.predicate",
    bucket: "filtered-group-by-count",
    difficulty: "moderate",
  },
  {
    question_id: 11,
    db_id: "agent_memory",
    persona: "P2",
    question: "List the agents that have stored more than two facts.",
    sql:
      "SELECT a.name FROM agents a JOIN facts f ON f.agent_id = a.id " +
      "GROUP BY a.id, a.name HAVING COUNT(*) > 2",
    bucket: "having",
    difficulty: "moderate",
  },
  // ── Batch 2 (SK-QUAL-018 growth follow-on): the negation / anti-join and
  //    challenging multi-join shapes v0 lacked. Buckets chosen to match the
  //    SK-QUAL-014 loss mass BIRD/Spider analysis flagged (subquery-negation,
  //    multi-join grain) — exactly the shapes SK-LLM-041's new pool exemplars
  //    target, so persona-bench can measure whether those exemplars help.
  {
    question_id: 12,
    db_id: "saas_app",
    persona: "P1",
    question: "Which users have never placed an order? List their emails.",
    sql: "SELECT email FROM users WHERE id NOT IN (SELECT user_id FROM orders)",
    bucket: "anti-join",
    difficulty: "moderate",
  },
  {
    question_id: 13,
    db_id: "saas_app",
    persona: "P1",
    question:
      "Which plan generates the most total paid revenue? Show the plan name and revenue in dollars.",
    sql:
      "SELECT p.name, SUM(o.amount_cents) / 100.0 AS revenue FROM orders o " +
      "JOIN users u ON o.user_id = u.id JOIN plans p ON u.plan_id = p.id " +
      "WHERE o.status = 'paid' GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 1",
    bucket: "group-order-limit-multi-join",
    difficulty: "challenging",
  },
  {
    question_id: 14,
    db_id: "saas_app",
    persona: "P1",
    question:
      "Which users have spent more than $30 on paid orders? Show their email and total spent in dollars.",
    sql:
      "SELECT u.email, SUM(o.amount_cents) / 100.0 AS total_dollars FROM users u " +
      "JOIN orders o ON o.user_id = u.id WHERE o.status = 'paid' " +
      "GROUP BY u.id, u.email HAVING SUM(o.amount_cents) > 3000",
    bucket: "having-aggregate-threshold",
    difficulty: "moderate",
  },
  {
    question_id: 15,
    db_id: "saas_app",
    persona: "P1",
    question: "How much paid revenue came in during April 2026, in dollars?",
    sql:
      "SELECT SUM(amount_cents) / 100.0 FROM orders " +
      "WHERE status = 'paid' AND created_at >= '2026-04-01' AND created_at < '2026-05-01'",
    bucket: "aggregate-date-range-filter",
    difficulty: "moderate",
  },
  {
    question_id: 16,
    db_id: "agent_memory",
    persona: "P2",
    question: "Which facts have never been recalled? Show the fact id and its object.",
    sql: "SELECT id, object FROM facts WHERE id NOT IN (SELECT fact_id FROM recalls)",
    bucket: "anti-join",
    difficulty: "moderate",
  },
  {
    question_id: 17,
    db_id: "agent_memory",
    persona: "P2",
    question: "How many facts were still active — not expired — as of 2026-06-12?",
    sql: "SELECT COUNT(*) FROM facts WHERE expires_at IS NULL OR expires_at >= '2026-06-12'",
    bucket: "ttl-active-or-null",
    difficulty: "moderate",
  },
  {
    question_id: 18,
    db_id: "agent_memory",
    persona: "P2",
    question:
      "For each agent, how many times have its facts been recalled in total? Show the agent name and total, most recalled first.",
    sql:
      "SELECT ag.name, COUNT(*) AS total_recalls FROM recalls r " +
      "JOIN facts f ON r.fact_id = f.id JOIN agents ag ON f.agent_id = ag.id " +
      "GROUP BY ag.id, ag.name ORDER BY total_recalls DESC",
    bucket: "group-by-count-multi-join-order",
    difficulty: "challenging",
  },
  {
    question_id: 19,
    db_id: "agent_memory",
    persona: "P2",
    question:
      "Which subjects have more than one fact stored about them? Show the subject and the fact count.",
    sql: "SELECT subject, COUNT(*) FROM facts GROUP BY subject HAVING COUNT(*) > 1",
    bucket: "having",
    difficulty: "moderate",
  },
  // ── Batch 3 (SK-QUAL-018 growth follow-on): three shapes batches 1–2 lacked,
  //    each mapping to an existing DAIL-SQL pool bucket (so the SK-LLM-041
  //    retrieval instrument stays clean) — scalar-subquery and COUNT(DISTINCT),
  //    plus the **multi-predicate-retention** filter shape the 2026-06-23 greedy
  //    run flagged as an engine miss (q13 dropped a `status = 'paid'` predicate on
  //    a "which X has the most Y"). Buckets mirror SK-QUAL-014's classes.
  {
    question_id: 20,
    db_id: "saas_app",
    persona: "P1",
    question: "Which plans cost more than the average plan price? List the plan names.",
    sql: "SELECT name FROM plans WHERE price_cents > (SELECT AVG(price_cents) FROM plans)",
    bucket: "scalar-subquery",
    difficulty: "moderate",
  },
  {
    question_id: 21,
    db_id: "saas_app",
    persona: "P1",
    question: "How many different referral sources have brought in at least one user?",
    sql: "SELECT COUNT(DISTINCT referrer_id) FROM users WHERE referrer_id IS NOT NULL",
    bucket: "count-distinct",
    difficulty: "simple",
  },
  {
    question_id: 22,
    db_id: "agent_memory",
    persona: "P2",
    question: "How many of the agent 'support-bot' facts have no expiry date?",
    sql:
      "SELECT COUNT(*) FROM facts f JOIN agents a ON f.agent_id = a.id " +
      "WHERE a.name = 'support-bot' AND f.expires_at IS NULL",
    bucket: "join-aggregate-filter",
    difficulty: "moderate",
  },
];

export function schemaFor(db_id: string): PersonaSchema | undefined {
  return PERSONA_BENCH_SCHEMAS.find((s) => s.db_id === db_id);
}

// ── Runner wiring (SK-QUAL-018 staged follow-on) — make persona-bench a
//    dispatchable `EvalDataset` so the free chain scores EX against the ICP
//    schemas. The runner opens fixtures by **file path** (`introspectSchema`
//    + `executeRows` both `new Database(path, { readonly: true })`), so the
//    loader materialises each in-memory schema to a real `.sqlite` on first
//    request and caches the path. bun:sqlite stays a dynamic import (the
//    bun-runtime-only dependency) so this module is still importable from a
//    plain type context; `node:{os,fs,path}` are portable. Structurally
//    identical to BIRD/Spider's `LoadedDataset` so `loadDatasetByName` adds
//    one branch and nothing in the bird/spider paths changes.
export async function loadPersonaBench(
  opts: { persona?: Persona; limit?: number; dbDir?: string } = {},
): Promise<{
  questions: EvalQuestion[];
  resolveDbPath: (db_id: string) => Promise<string | null>;
}> {
  const questions = toEvalQuestions({ persona: opts.persona, limit: opts.limit });
  const { Database } = (await import(/* @vite-ignore */ "bun:sqlite")) as {
    Database: new (filename: string) => { run: (sql: string) => void; close: () => void };
  };
  const dir = opts.dbDir ?? mkdtempSync(join(tmpdir(), "persona-bench-"));
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

// Project to the canonical harness type so the staged runner-wiring is a
// pure adapter — `evidence` is empty (BIRD-only) like Spider rows.
export function toEvalQuestions(opts: { persona?: Persona; limit?: number } = {}): EvalQuestion[] {
  let qs = PERSONA_BENCH_QUESTIONS;
  if (opts.persona) qs = qs.filter((q) => q.persona === opts.persona);
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
// `bun:sqlite` (the runner / test inject a real one), mirroring score.ts.
export type PersonaDb = { run: (sql: string) => void; query: (sql: string) => unknown[] };

export type GoldCheck = {
  question_id: number;
  db_id: string;
  ok: boolean;
  rows: number;
  error?: string;
};

// The v0 invariant: every gold SQL executes against its seeded schema and
// returns at least one row. `openDb` builds a fresh, isolated handle per
// schema; setup is applied once, then each gold runs read-only. Pure given
// the injected `openDb`, so the test and the `import.meta.main` CLI share it.
export function checkGoldExecutability(
  openDb: (schema: PersonaSchema) => PersonaDb,
  opts: { persona?: Persona } = {},
): GoldCheck[] {
  const out: GoldCheck[] = [];
  for (const schema of PERSONA_BENCH_SCHEMAS) {
    if (opts.persona && schema.persona !== opts.persona) continue;
    const db = openDb(schema);
    for (const stmt of schema.setup) db.run(stmt);
    for (const q of PERSONA_BENCH_QUESTIONS.filter((x) => x.db_id === schema.db_id)) {
      try {
        const rows = db.query(q.sql);
        out.push({
          question_id: q.question_id,
          db_id: q.db_id,
          ok: rows.length > 0,
          rows: rows.length,
        });
      } catch (err) {
        out.push({
          question_id: q.question_id,
          db_id: q.db_id,
          ok: false,
          rows: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return out;
}

// `bun persona-bench` — runs the gold-executability check over an
// in-memory bun:sqlite db and prints the v0 number. Read-only, no network,
// no LLM; the offline-instrument shape SK-QUAL-014/015/017 established.
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
    if (!c.ok) console.error(`  ✗ ${c.db_id} q${c.question_id}: ${c.error ?? "0 rows"}`);
  }
  console.info(
    `persona-bench v0: ${PERSONA_BENCH_SCHEMAS.length} ICP schemas, ${ok}/${checks.length} golds execute (non-empty).`,
  );
  if (ok !== checks.length) process.exit(1);
}
