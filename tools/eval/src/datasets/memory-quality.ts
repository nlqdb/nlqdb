// memory-quality — nlqdb's agent-memory-quality benchmark (SK-QUAL-023).
//
// persona-bench (SK-QUAL-018) measures NL→SQL EX over an ICP schema.
// memory-quality measures whether the *memory itself is good*: it seeds
// `agent_memory_v1`-shaped corpora deliberately built to exercise the four
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

// Goal pack #1 — repo-ops (SK-PIVOT-018), the corpus the docs→memory skill
// (SK-PIVOT-017, `apps/web/public/agent-artifacts/nlqdb-docs-memory/SKILL.md`)
// produces: a repo's *structured* operational knowledge — decision ids +
// statuses, open questions with the date they appeared, queues, trackers, and
// the references between them. Never prose.
//
// Two fidelity notes vs `AGENT_MEMORY_V1` above:
//   • It mirrors the shipped preset's real shape (`presets/agent-memory-v1.ts`):
//     `agent_id` is a TEXT column on each row, not a FK to an `agents` table,
//     and facts carry `kind`/`content`/`tags`/`source` rather than
//     subject/predicate/object.
//   • `source` is JSONB in Postgres and plain TEXT here (SQLite); no gold
//     reads it, so the golds stay engine-portable. Links go through
//     `entity_facts` — the preset's real join table — which is what a
//     reference question ("which decisions reference GLOBAL-013") actually
//     traverses.
//
// The seed is a hand-authored, representative corpus, NOT a dump of nlqdb's
// `docs/` — that keeps every gold's answer hand-checkable and the run
// deterministic (the live-corpus run is the SK-PIVOT-016 dogfood measurement,
// a different instrument). Sync-run history is deliberate: three `episodes`
// rows and a re-written duplicate fact are what the append-only,
// converge-on-`source.key` protocol produces, so the temporal + consolidation
// axes measure the skill's actual output shape. `other-repo` is a second agent
// so retrieval precision is testable by cross-agent isolation.
const REPO_OPS_MEMORY: MemorySchema = {
  db_id: "repo_ops_memory_v1",
  shape:
    "repo-ops docs→memory pack — agent_memory_v1 shape (facts / episodes / entities / entity_facts) extracted from a repo's markdown",
  setup: [
    "CREATE TABLE facts (id INTEGER PRIMARY KEY, agent_id TEXT NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '', source TEXT, created_at TEXT NOT NULL, expires_at TEXT)",
    "CREATE TABLE episodes (id INTEGER PRIMARY KEY, agent_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, occurred_at TEXT NOT NULL)",
    "CREATE TABLE entities (id INTEGER PRIMARY KEY, agent_id TEXT NOT NULL, kind TEXT NOT NULL, canonical_name TEXT NOT NULL, first_seen_at TEXT, last_seen_at TEXT, UNIQUE (agent_id, kind, canonical_name))",
    "CREATE TABLE entity_facts (entity_id INTEGER NOT NULL REFERENCES entities(id), fact_id INTEGER NOT NULL REFERENCES facts(id), PRIMARY KEY (entity_id, fact_id))",
    "INSERT INTO entities (id, agent_id, kind, canonical_name, first_seen_at, last_seen_at) VALUES " +
      "(1,'repo-ops','feature','auth','2026-04-02','2026-07-27')," +
      "(2,'repo-ops','feature','ask-pipeline','2026-05-10','2026-07-27')," +
      "(3,'repo-ops','feature','billing','2026-06-01','2026-07-27')," +
      "(4,'repo-ops','decision','GLOBAL-013','2026-05-04','2026-07-25')," +
      "(5,'repo-ops','decision','SK-AUTH-004','2026-05-04','2026-07-25')," +
      "(6,'repo-ops','decision','SK-ASK-011','2026-05-10','2026-07-25')," +
      "(7,'repo-ops','decision','SK-BILL-002','2026-06-05','2026-07-25')," +
      "(8,'repo-ops','queue_item','launch-sequence','2026-06-15','2026-07-27')," +
      "(9,'repo-ops','queue_item','stripe-webhook-retry','2026-07-05','2026-07-27')," +
      "(10,'repo-ops','decision','GLOBAL-025','2026-05-10','2026-07-25')," +
      "(11,'repo-ops','decision','SK-AUTH-002','2026-04-02','2026-07-27')," +
      // A second repo's agent knows GLOBAL-013 too — must never leak.
      "(12,'other-repo','decision','GLOBAL-013','2026-06-01','2026-06-01')",
    "INSERT INTO facts (id, agent_id, kind, content, tags, source, created_at, expires_at) VALUES " +
      // open questions — the age spread is the point (as of 2026-07-27:
      // 116 / 77 / 37 / 7 / 5 / 56 days).
      "(101,'repo-ops','open_question','auth: should sessions rotate on IP change?','auth','{\"path\":\"docs/features/auth/FEATURE.md\"}','2026-04-02',NULL)," +
      "(102,'repo-ops','open_question','auth: do we expire refresh tokens on password change?','auth','{\"path\":\"docs/features/auth/FEATURE.md\"}','2026-05-11',NULL)," +
      "(103,'repo-ops','open_question','auth: is the device cap per browser or per account?','auth','{\"path\":\"docs/features/auth/FEATURE.md\"}','2026-06-20',NULL)," +
      "(104,'repo-ops','open_question','ask-pipeline: what caps plan-cache size?','ask-pipeline','{\"path\":\"docs/features/ask-pipeline/FEATURE.md\"}','2026-07-20',NULL)," +
      "(105,'repo-ops','open_question','ask-pipeline: should confidence be surfaced on reads?','ask-pipeline','{\"path\":\"docs/features/ask-pipeline/FEATURE.md\"}','2026-07-22',NULL)," +
      "(106,'repo-ops','open_question','billing: how do we prorate a downgrade?','billing','{\"path\":\"docs/features/billing/FEATURE.md\"}','2026-06-01',NULL)," +
      // Re-written verbatim by a later sync run (same source.key, same digest
      // would have been skipped — this row is the duplicate the dedup axis
      // must see through).
      "(107,'repo-ops','open_question','auth: should sessions rotate on IP change?','auth','{\"path\":\"docs/features/auth/FEATURE.md\"}','2026-07-27',NULL)," +
      // decision statuses — SK-ASK-011 was superseded, so its current status
      // is the most recent row, not the only one.
      "(108,'repo-ops','decision_status','SK-AUTH-004 status: implemented','SK-AUTH-004','{\"path\":\"docs/features/auth/FEATURE.md\"}','2026-05-04',NULL)," +
      "(109,'repo-ops','decision_status','SK-ASK-011 status: proposed','SK-ASK-011','{\"path\":\"docs/features/ask-pipeline/FEATURE.md\"}','2026-05-10',NULL)," +
      "(110,'repo-ops','decision_status','SK-ASK-011 status: superseded by SK-ASK-014','SK-ASK-011','{\"path\":\"docs/features/ask-pipeline/FEATURE.md\"}','2026-07-01',NULL)," +
      "(111,'repo-ops','decision_status','SK-BILL-002 status: implemented','SK-BILL-002','{\"path\":\"docs/features/billing/FEATURE.md\"}','2026-06-05',NULL)," +
      // cross-references — one row per edge, linked to both endpoints.
      "(112,'repo-ops','reference','SK-AUTH-004 references GLOBAL-013','SK-AUTH-004,GLOBAL-013','{\"path\":\"docs/features/auth/FEATURE.md\"}','2026-05-04',NULL)," +
      "(113,'repo-ops','reference','SK-BILL-002 references GLOBAL-013','SK-BILL-002,GLOBAL-013','{\"path\":\"docs/features/billing/FEATURE.md\"}','2026-06-05',NULL)," +
      "(114,'repo-ops','reference','SK-ASK-011 references GLOBAL-025','SK-ASK-011,GLOBAL-025','{\"path\":\"docs/features/ask-pipeline/FEATURE.md\"}','2026-05-10',NULL)," +
      "(115,'other-repo','reference','OTHER-001 references GLOBAL-013','OTHER-001,GLOBAL-013','{\"path\":\"docs/decisions.md\"}','2026-06-01',NULL)," +
      // queue state — 'since when' lives in created_at.
      "(116,'repo-ops','blocked','launch-sequence: blocked on the founder sitting','launch-sequence','{\"path\":\"docs/queue.md\"}','2026-06-15',NULL)," +
      "(117,'repo-ops','blocked','stripe-webhook-retry: blocked on a Stripe test key','stripe-webhook-retry','{\"path\":\"docs/queue.md\"}','2026-07-05',NULL)," +
      // tracker rows with a TTL — one already expired as of 2026-07-27.
      "(118,'repo-ops','tracker_row','icp-tracker: 12 candidate repos pending review','icp-tracker','{\"path\":\"docs/research/icp.md\"}','2026-06-10','2026-07-10')," +
      "(119,'repo-ops','tracker_row','icp-tracker: 3 verified ICP matches','icp-tracker','{\"path\":\"docs/research/icp.md\"}','2026-07-20','2026-08-20')," +
      // Tombstone: the decision left the markdown, so the sync retired it
      // instead of deleting history (the convergence rule).
      "(120,'repo-ops','retired','SK-AUTH-002: no longer present in docs/features/auth/FEATURE.md','SK-AUTH-002','{\"path\":\"docs/features/auth/FEATURE.md\"}','2026-07-25',NULL)," +
      "(121,'other-repo','open_question','other: should we cache the schema?','other','{\"path\":\"docs/notes.md\"}','2026-05-05',NULL)",
    "INSERT INTO entity_facts (entity_id, fact_id) VALUES " +
      // open questions → their feature
      "(1,101),(1,102),(1,103),(1,107),(2,104),(2,105),(3,106)," +
      // statuses → their decision
      "(5,108),(6,109),(6,110),(7,111)," +
      // references → both endpoints
      "(5,112),(4,112),(7,113),(4,113),(6,114),(10,114),(12,115)," +
      // queue state → its queue item; tombstone → its decision
      "(8,116),(9,117),(11,120)",
    "INSERT INTO episodes (id, agent_id, role, content, occurred_at) VALUES " +
      "(1,'repo-ops','sync','synced docs/ at commit a1b2c3d — 18 facts written, 0 changed','2026-07-20')," +
      "(2,'repo-ops','sync','synced docs/ at commit e4f5a6b — 2 facts written, 1 superseded','2026-07-25')," +
      "(3,'repo-ops','sync','synced docs/ at commit 9c8d7e6 — 1 fact written, 1 retired','2026-07-27')," +
      "(4,'other-repo','sync','synced docs/ at commit 000aaa1 — 1 fact written','2026-07-26')",
  ],
};

export const MEMORY_QUALITY_SCHEMAS: MemorySchema[] = [AGENT_MEMORY_V1, REPO_OPS_MEMORY];

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

  // ══ repo-ops pack (SK-PIVOT-017 / SK-PIVOT-018) ═════════════════════════
  // The questions the docs→memory skill exists to answer — the ones grep
  // structurally cannot, because each is an aggregate, a join, or date
  // arithmetic. 'as of' bounds are literal 2026-07-27 (the last sync run in
  // the seed), never date('now').
  // ── retrieval ───────────────────────────────────────────────────────────
  {
    question_id: 15,
    db_id: "repo_ops_memory_v1",
    axis: "retrieval",
    question: "Which decisions reference GLOBAL-013?",
    sql:
      "SELECT DISTINCT src.canonical_name FROM facts f " +
      "JOIN entity_facts eft ON eft.fact_id = f.id JOIN entities tgt ON tgt.id = eft.entity_id " +
      "JOIN entity_facts efs ON efs.fact_id = f.id JOIN entities src ON src.id = efs.entity_id " +
      "WHERE f.agent_id = 'repo-ops' AND f.kind = 'reference' " +
      "AND tgt.canonical_name = 'GLOBAL-013' AND src.canonical_name <> 'GLOBAL-013'",
    difficulty: "challenging",
  },
  {
    question_id: 16,
    db_id: "repo_ops_memory_v1",
    axis: "retrieval",
    question:
      "List every open question the repo-ops agent has recorded — the question and the date it was first seen.",
    sql:
      "SELECT f.content, f.created_at FROM facts f " +
      "WHERE f.agent_id = 'repo-ops' AND f.kind = 'open_question'",
    difficulty: "simple",
  },
  // ── temporal ────────────────────────────────────────────────────────────
  {
    question_id: 17,
    db_id: "repo_ops_memory_v1",
    axis: "temporal",
    question:
      "Which open questions were more than 30 days old as of 2026-07-27? Show the question and its age in days, oldest first.",
    sql:
      "SELECT f.content, CAST(julianday('2026-07-27') - julianday(f.created_at) AS INTEGER) AS age_days " +
      "FROM facts f WHERE f.agent_id = 'repo-ops' AND f.kind = 'open_question' " +
      "AND f.created_at < '2026-06-27' ORDER BY age_days DESC",
    difficulty: "challenging",
  },
  {
    question_id: 18,
    db_id: "repo_ops_memory_v1",
    axis: "temporal",
    question: "What is SK-ASK-011's current status?",
    sql:
      "SELECT f.content FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'repo-ops' AND f.kind = 'decision_status' " +
      "AND e.canonical_name = 'SK-ASK-011' ORDER BY f.created_at DESC LIMIT 1",
    difficulty: "moderate",
  },
  {
    question_id: 19,
    db_id: "repo_ops_memory_v1",
    axis: "temporal",
    question: "What is blocked, and since when? Show the item and the date, oldest first.",
    sql:
      "SELECT f.content, f.created_at FROM facts f " +
      "WHERE f.agent_id = 'repo-ops' AND f.kind = 'blocked' ORDER BY f.created_at",
    difficulty: "moderate",
  },
  {
    question_id: 20,
    db_id: "repo_ops_memory_v1",
    axis: "temporal",
    question:
      "List the repo-ops agent's doc-sync runs in chronological order — what each one did and when.",
    sql:
      "SELECT e.content, e.occurred_at FROM episodes e " +
      "WHERE e.agent_id = 'repo-ops' AND e.role = 'sync' ORDER BY e.occurred_at",
    difficulty: "moderate",
  },
  // ── forgetting ──────────────────────────────────────────────────────────
  {
    question_id: 21,
    db_id: "repo_ops_memory_v1",
    axis: "forgetting",
    question: "Which of the repo-ops agent's tracker facts had expired as of 2026-07-27?",
    sql:
      "SELECT f.content FROM facts f WHERE f.agent_id = 'repo-ops' " +
      "AND f.expires_at IS NOT NULL AND f.expires_at < '2026-07-27'",
    difficulty: "moderate",
  },
  {
    question_id: 22,
    db_id: "repo_ops_memory_v1",
    axis: "forgetting",
    question: "Which decisions has the repo-ops agent retired — no longer present in the docs?",
    sql:
      "SELECT e.canonical_name FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'repo-ops' AND f.kind = 'retired'",
    difficulty: "moderate",
  },
  // ── consolidation ───────────────────────────────────────────────────────
  {
    question_id: 23,
    db_id: "repo_ops_memory_v1",
    axis: "consolidation",
    question:
      "How many distinct open questions has the repo-ops agent recorded? Ignore duplicates re-written by a later sync.",
    sql:
      "SELECT COUNT(DISTINCT f.content) FROM facts f " +
      "WHERE f.agent_id = 'repo-ops' AND f.kind = 'open_question'",
    difficulty: "moderate",
  },
  {
    question_id: 24,
    db_id: "repo_ops_memory_v1",
    axis: "consolidation",
    question:
      "Which facts did the repo-ops agent store more than once with identical content? Show the content and how many times.",
    sql:
      "SELECT f.content, COUNT(*) AS n FROM facts f WHERE f.agent_id = 'repo-ops' " +
      "GROUP BY f.content HAVING COUNT(*) > 1",
    difficulty: "challenging",
  },
  // ── analytical ──────────────────────────────────────────────────────────
  {
    question_id: 25,
    db_id: "repo_ops_memory_v1",
    axis: "analytical",
    question:
      "How many distinct open questions does each feature have? Show the feature and the count, most first.",
    sql:
      "SELECT e.canonical_name, COUNT(DISTINCT f.content) AS n FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'repo-ops' AND f.kind = 'open_question' AND e.kind = 'feature' " +
      "GROUP BY e.id, e.canonical_name ORDER BY n DESC",
    difficulty: "challenging",
  },
  {
    question_id: 26,
    db_id: "repo_ops_memory_v1",
    axis: "analytical",
    question:
      "For the repo-ops agent, how many facts are stored per kind? Show the kind and the count.",
    sql: "SELECT f.kind, COUNT(*) FROM facts f WHERE f.agent_id = 'repo-ops' GROUP BY f.kind",
    difficulty: "moderate",
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

// The same map as JSON, for consumers outside TypeScript — the memory-eval
// workflow's `jq` per-axis breakdown reads it instead of guessing axes from id
// ranges (a guess that mislabelled every question the moment the repo-ops pack
// pushed ids past 14).
export function axisMapJson(): string {
  return JSON.stringify(
    Object.fromEntries(MEMORY_QUALITY_QUESTIONS.map((q) => [q.question_id, q.axis])),
  );
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
// `--axes` prints just the question_id → axis map (what the workflow's per-axis
// breakdown consumes) and exits.
if (import.meta.main) {
  if (process.argv.includes("--axes")) {
    console.info(axisMapJson());
    process.exit(0);
  }
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
