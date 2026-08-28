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
    // Structural hints ride in `-- comments`, which SQLite preserves in
    // sqlite_master.sql and the runner feeds to the planner as schema (not as
    // prose Evidence, which run 186 saw literal-injected). SK-QUAL-023 lever.
    "CREATE TABLE facts (\n" +
      "  id INTEGER PRIMARY KEY,\n" +
      "  agent_id INTEGER NOT NULL REFERENCES agents(id),\n" +
      "  subject TEXT NOT NULL,\n" +
      "  predicate TEXT NOT NULL,\n" +
      "  object TEXT NOT NULL,\n" +
      "  created_at TEXT NOT NULL, -- when the fact was recorded; the CURRENT value of a repeated (subject, predicate) is the row with the largest created_at (ORDER BY created_at DESC LIMIT 1)\n" +
      "  expires_at TEXT -- optional TTL; a fact is expired when expires_at is not null and in the past. A null expires_at does NOT make a superseded older value current\n" +
      ")",
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
    // Structural hints as `-- comments` (SQLite keeps them in sqlite_master.sql;
    // the runner feeds that to the planner as schema, not prose Evidence).
    "CREATE TABLE facts (\n" +
      "  id INTEGER PRIMARY KEY,\n" +
      "  agent_id TEXT NOT NULL, -- the owning agent; here 'repo-ops'. Multiple agents can share these tables, so every read must be scoped: WHERE agent_id = 'repo-ops'. A decision/feature/subject is an entity, never the agent_id\n" +
      "  kind TEXT NOT NULL, -- the fact's category label (see declared domain); the readable text is in content\n" +
      "  content TEXT NOT NULL, -- the fact's own text (the question, the status line). The decision/feature it is ABOUT is an entity reached via entity_facts, not parsed out of this string\n" +
      "  tags TEXT NOT NULL DEFAULT '',\n" +
      "  source TEXT,\n" +
      "  created_at TEXT NOT NULL, -- when first recorded; use for 'first seen'/age, and ORDER BY created_at DESC for the current row of a superseded fact\n" +
      "  expires_at TEXT)",
    "CREATE TABLE episodes (\n" +
      "  id INTEGER PRIMARY KEY,\n" +
      "  agent_id TEXT NOT NULL,\n" +
      "  role TEXT NOT NULL,\n" +
      "  content TEXT NOT NULL,\n" +
      "  occurred_at TEXT NOT NULL) -- episodes are the agent's interaction log (sync runs); durable knowledge (questions, statuses, references) lives in facts, not here",
    "CREATE TABLE entities (\n" +
      "  id INTEGER PRIMARY KEY,\n" +
      "  agent_id TEXT NOT NULL,\n" +
      "  kind TEXT NOT NULL, -- entity type: decision, feature, queue_item\n" +
      "  canonical_name TEXT NOT NULL, -- the entity's stable id (e.g. 'GLOBAL-013', 'SK-ASK-011', 'auth'); SELECT/GROUP BY this when a question asks WHICH decision/feature\n" +
      "  first_seen_at TEXT,\n" +
      "  last_seen_at TEXT,\n" +
      "  UNIQUE (agent_id, kind, canonical_name))",
    "CREATE TABLE entity_facts (\n" +
      "  -- M:N join: each row links one fact to one entity it is about. Traverse facts -> entity_facts -> entities to filter or name a fact's entity (a reference fact links to BOTH its endpoints)\n" +
      "  entity_id INTEGER NOT NULL REFERENCES entities(id),\n" +
      "  fact_id INTEGER NOT NULL REFERENCES facts(id),\n" +
      "  PRIMARY KEY (entity_id, fact_id))",
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

// The language-tutor expert pack (EK-04, SK-EKP-004) — the pilot "become AI"
// pack's public-rail half, on the same `agent_memory_v1` Graphiti shape as
// repo-ops (no new DDL, SK-PIVOT-007/018). Extraction categories the pack's
// interview produces: error taxonomy (`mistake` facts tagged by the word or
// grammar rule slipped on), vocabulary encounters (`vocab_encounter`, with the
// spaced-repetition review date in `expires_at`), student-profile facts
// (`student_profile`, level supersedes over time), lesson episodes, and the
// tutor's own pricing heuristics. Seed entities: word, grammar_rule, topic,
// student. A second `other-tutor` agent exists so cross-agent isolation
// (retrieval precision) is testable. Reference date for the temporal golds is
// 2026-08-01 ("this month" = July 2026); literal date bounds per SK-QUAL-023.
const LANGUAGE_TUTOR_MEMORY: MemorySchema = {
  db_id: "language_tutor_memory_v1",
  shape:
    "language-tutor expert pack — agent_memory_v1 shape (facts / episodes / entities / entity_facts): mistakes, vocabulary, student profile, lessons, pricing",
  setup: [
    // Structural hints as `-- comments` (SQLite keeps them in sqlite_master.sql;
    // the runner feeds that to the planner as schema, not prose Evidence).
    "CREATE TABLE facts (\n" +
      "  id INTEGER PRIMARY KEY,\n" +
      "  agent_id TEXT NOT NULL, -- the owning tutor agent; here 'tutor'. Multiple agents can share these tables, so every read must be scoped: WHERE agent_id = 'tutor'. The STUDENT (e.g. student:alex) is a subject/entity, never the agent_id\n" +
      "  kind TEXT NOT NULL, -- the fact's category (see declared domain: mistake, vocab_encounter, student_profile, ...); the readable text is in content\n" +
      "  content TEXT NOT NULL, -- the fact's own text (the mistake, the vocab card, 'level: B2'). The word/rule/topic it is ABOUT is an entity reached via entity_facts, not this string\n" +
      "  tags TEXT NOT NULL DEFAULT '',\n" +
      "  source TEXT,\n" +
      "  created_at TEXT NOT NULL, -- when recorded; ORDER BY created_at DESC for the current row of a superseded fact (e.g. the student's current level)\n" +
      "  expires_at TEXT)",
    "CREATE TABLE episodes (\n" +
      "  id INTEGER PRIMARY KEY,\n" +
      "  agent_id TEXT NOT NULL,\n" +
      "  role TEXT NOT NULL,\n" +
      "  content TEXT NOT NULL,\n" +
      "  occurred_at TEXT NOT NULL) -- episodes are the lesson-session log; vocabulary, mistakes and profiles are facts, not episodes",
    "CREATE TABLE entities (\n" +
      "  id INTEGER PRIMARY KEY,\n" +
      "  agent_id TEXT NOT NULL,\n" +
      "  kind TEXT NOT NULL, -- entity type: word, grammar_rule, topic, student\n" +
      "  canonical_name TEXT NOT NULL, -- the entity's stable id (e.g. 'effect', 'subjunctive', 'travel', 'student:alex'); SELECT/GROUP BY this when a question asks WHICH word/rule/topic\n" +
      "  first_seen_at TEXT,\n" +
      "  last_seen_at TEXT,\n" +
      "  UNIQUE (agent_id, kind, canonical_name))",
    "CREATE TABLE entity_facts (\n" +
      "  -- M:N join: each row links one fact to one entity it is about. Traverse facts -> entity_facts -> entities to name or group a fact by its word/rule/topic\n" +
      "  entity_id INTEGER NOT NULL REFERENCES entities(id),\n" +
      "  fact_id INTEGER NOT NULL REFERENCES facts(id),\n" +
      "  PRIMARY KEY (entity_id, fact_id))",
    "INSERT INTO entities (id, agent_id, kind, canonical_name, first_seen_at, last_seen_at) VALUES " +
      "(1,'tutor','word','effect','2026-07-02','2026-07-24')," +
      "(2,'tutor','word','loose','2026-07-06','2026-07-21')," +
      "(3,'tutor','word','advice','2026-07-11','2026-07-19')," +
      "(4,'tutor','word','ephemeral','2026-07-10','2026-07-28')," +
      "(5,'tutor','word','ubiquitous','2026-07-12','2026-07-12')," +
      "(6,'tutor','word','serendipity','2026-07-15','2026-07-15')," +
      "(7,'tutor','grammar_rule','subjunctive','2026-06-20','2026-07-22')," +
      "(8,'tutor','grammar_rule','article-usage','2026-07-05','2026-07-20')," +
      "(9,'tutor','grammar_rule','past-perfect','2026-07-10','2026-07-18')," +
      "(10,'tutor','grammar_rule','preposition-of-time','2026-06-10','2026-07-25')," +
      "(11,'tutor','topic','travel','2026-07-03','2026-07-24')," +
      "(12,'tutor','topic','business-email','2026-07-02','2026-07-22')," +
      "(13,'tutor','topic','small-talk','2026-07-08','2026-07-30')," +
      "(14,'tutor','student','student:alex','2026-04-01','2026-07-15')," +
      // A second tutor's agent knows the same word and rule — must never leak.
      "(15,'other-tutor','word','effect','2026-07-05','2026-07-05')," +
      "(16,'other-tutor','grammar_rule','subjunctive','2026-07-06','2026-07-06')",
    "INSERT INTO facts (id, agent_id, kind, content, tags, source, created_at, expires_at) VALUES " +
      // ── mistakes: grammar (error taxonomy, tagged by rule) ──
      "(101,'tutor','mistake','indicative used where subjunctive was required','subjunctive',NULL,'2026-07-03',NULL)," +
      "(102,'tutor','mistake','subjunctive missed in a wish clause','subjunctive',NULL,'2026-07-08',NULL)," +
      "(103,'tutor','mistake','subjunctive dropped after suggest-that','subjunctive',NULL,'2026-07-15',NULL)," +
      "(104,'tutor','mistake','subjunctive missed in a formal request','subjunctive',NULL,'2026-07-22',NULL)," +
      "(105,'tutor','mistake','wrong article a before a vowel sound','article-usage',NULL,'2026-07-05',NULL)," +
      "(106,'tutor','mistake','omitted the before a unique noun','article-usage',NULL,'2026-07-12',NULL)," +
      "(107,'tutor','mistake','used the with a generic plural','article-usage',NULL,'2026-07-20',NULL)," +
      "(108,'tutor','mistake','simple past used where past-perfect needed','past-perfect',NULL,'2026-07-10',NULL)," +
      "(109,'tutor','mistake','past-perfect missing in reported speech','past-perfect',NULL,'2026-07-18',NULL)," +
      "(110,'tutor','mistake','used in instead of on for a weekday','preposition-of-time',NULL,'2026-07-25',NULL)," +
      // two June mistakes — excluded from any this-month (July) window
      "(111,'tutor','mistake','subjunctive missed in a conditional','subjunctive',NULL,'2026-06-20',NULL)," +
      "(112,'tutor','mistake','used at instead of in for a month','preposition-of-time',NULL,'2026-06-10',NULL)," +
      // ── mistakes: vocabulary (error taxonomy, tagged by word) ──
      "(113,'tutor','mistake','wrote affect for the noun effect','effect',NULL,'2026-07-02',NULL)," +
      "(114,'tutor','mistake','used effect as a verb','effect',NULL,'2026-07-09',NULL)," +
      "(115,'tutor','mistake','spelled effect as efect','effect',NULL,'2026-07-16',NULL)," +
      "(116,'tutor','mistake','used affect for the noun effect again','effect',NULL,'2026-07-24',NULL)," +
      "(117,'tutor','mistake','wrote loose for lose','loose',NULL,'2026-07-06',NULL)," +
      "(118,'tutor','mistake','confused loose and lose again','loose',NULL,'2026-07-13',NULL)," +
      "(119,'tutor','mistake','used loose as a verb','loose',NULL,'2026-07-21',NULL)," +
      "(120,'tutor','mistake','used advice as a verb','advice',NULL,'2026-07-11',NULL)," +
      "(121,'tutor','mistake','spelled advise as advice','advice',NULL,'2026-07-19',NULL)," +
      // ── vocabulary encounters (spaced-repetition review date in expires_at) ──
      "(130,'tutor','vocab_encounter','introduced ephemeral — lasting a short time','ephemeral',NULL,'2026-07-10','2026-08-05')," +
      "(131,'tutor','vocab_encounter','introduced ubiquitous — found everywhere','ubiquitous',NULL,'2026-07-12','2026-08-07')," +
      "(132,'tutor','vocab_encounter','introduced serendipity — a happy accident','serendipity',NULL,'2026-07-15','2026-08-20')," +
      // a later session re-logged ephemeral verbatim — the duplicate the dedup axis must see through
      "(133,'tutor','vocab_encounter','introduced ephemeral — lasting a short time','ephemeral',NULL,'2026-07-28','2026-09-01')," +
      // ── student-profile facts (level supersedes over time) ──
      "(140,'tutor','student_profile','level: A2','student:alex',NULL,'2026-04-01',NULL)," +
      "(141,'tutor','student_profile','level: B1','student:alex',NULL,'2026-06-01',NULL)," +
      "(142,'tutor','student_profile','level: B2','student:alex',NULL,'2026-07-15',NULL)," +
      "(143,'tutor','student_profile','goal: pass B2 exam','student:alex',NULL,'2026-05-01',NULL)," +
      "(144,'tutor','student_profile','native language: Spanish','student:alex',NULL,'2026-04-01',NULL)," +
      // ── retired: a topic the student mastered, dropped from active rotation ──
      "(150,'tutor','retired','small-talk: mastered, dropped from active practice','small-talk',NULL,'2026-07-30',NULL)," +
      // ── pricing heuristics (the tutor's own lesson-pricing knowledge) ──
      "(160,'tutor','pricing_heuristic','charge a premium for exam-prep intensive lessons','pricing',NULL,'2026-05-20',NULL)," +
      "(161,'tutor','pricing_heuristic','offer a bundle discount for beginner packages','pricing',NULL,'2026-06-10',NULL)," +
      // ── a second tutor's rows — cross-agent isolation guard ──
      "(170,'other-tutor','mistake','other student confused effect','effect',NULL,'2026-07-05',NULL)," +
      "(171,'other-tutor','mistake','other student subjunctive slip','subjunctive',NULL,'2026-07-06',NULL)",
    "INSERT INTO entity_facts (entity_id, fact_id) VALUES " +
      // grammar mistakes → rule + topic
      "(7,101),(12,101),(7,102),(13,102),(7,103),(11,103),(7,104),(12,104)," +
      "(8,105),(11,105),(8,106),(11,106),(8,107),(12,107)," +
      "(9,108),(13,108),(9,109),(11,109),(10,110),(13,110)," +
      "(7,111),(11,111),(10,112),(11,112)," +
      // vocabulary mistakes → word + topic
      "(1,113),(12,113),(1,114),(12,114),(1,115),(13,115),(1,116),(11,116)," +
      "(2,117),(11,117),(2,118),(13,118),(2,119),(11,119)," +
      "(3,120),(12,120),(3,121),(12,121)," +
      // vocabulary encounters → word
      "(4,130),(5,131),(6,132),(4,133)," +
      // student-profile facts → student
      "(14,140),(14,141),(14,142),(14,143),(14,144)," +
      // retired topic → topic
      "(13,150)," +
      // second tutor rows → its own entities
      "(15,170),(16,171)",
    "INSERT INTO episodes (id, agent_id, role, content, occurred_at) VALUES " +
      "(1,'tutor','lesson','travel vocabulary and past-perfect drills','2026-07-10')," +
      "(2,'tutor','lesson','business-email subjunctive and article usage','2026-07-17')," +
      "(3,'tutor','lesson','small-talk fluency and prepositions of time','2026-07-24')," +
      "(4,'other-tutor','lesson','another students grammar review','2026-07-20')",
  ],
};

export const MEMORY_QUALITY_SCHEMAS: MemorySchema[] = [
  AGENT_MEMORY_V1,
  REPO_OPS_MEMORY,
  LANGUAGE_TUTOR_MEMORY,
];

// Per-goal-pack declared categorical vocabulary (SK-QUAL-023 vocabulary
// lever). run 185 diagnosed the dominant free-lane failure class as
// categorical value-linking drift: the planner guesses a plausible-but-wrong
// literal for a `kind`/`predicate`/`role` filter (`'open question'`≠
// `'open_question'`, `'doc-sync'`≠`'sync'`, `'vocabulary'`≠`'vocab_encounter'`,
// `'current_city'`≠`'city'`), so a correctly-shaped query returns the empty
// set. The fix is to declare each goal-pack's closed categorical domains — a
// schema-level fact of the pack, not a runtime cell-value — as hand-authored
// evidence. That is squarely on GLOBAL-037 planning lane 1 ("schema … and
// hand-authored evidence/descriptions"); it never samples real user
// cell-values (the `value-retrieval` lane stays unbuilt/founder-gated). The
// runner appends this to the goal as an `Evidence:` block, exactly as it
// feeds BIRD's annotator hints.
//
// Evidence declares ONLY the categorical column domains. A first cut also
// carried an `agent_id` identifier-convention sentence and an append-only
// recency note; the run 32919537669 mismatch diagnostics showed both
// backfiring — the planner injected the prose verbatim as a literal
// (`agent_id = 'the memory-owning agent'`, q19/q32/q38) and over-applied
// recency on a plain-retrieval question (q0) — cancelling the vocabulary
// gain. Column domains are the proven, on-target signal; keep only those.
export const MEMORY_SCHEMA_EVIDENCE: Record<string, string> = {
  agent_memory_v1:
    "facts.predicate is one of {city, likes, owner, plan, promo, status, trial}. " +
    "entities.kind is one of {org, person}.",
  repo_ops_memory_v1:
    "facts.kind is one of {blocked, decision_status, open_question, reference, retired, tracker_row}. " +
    "entities.kind is one of {decision, feature, queue_item}. episodes.role is one of {sync}.",
  language_tutor_memory_v1:
    "facts.kind is one of {mistake, pricing_heuristic, retired, student_profile, vocab_encounter}. " +
    "entities.kind is one of {grammar_rule, student, topic, word}. episodes.role is one of {lesson}.",
};

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

  // ══ language-tutor expert pack (EK-04 / SK-EKP-004) ═══════════════════════
  // ── retrieval ─────────────────────────────────────────────────────────────
  {
    question_id: 27,
    db_id: "language_tutor_memory_v1",
    axis: "retrieval",
    question: "List the tutor's pricing heuristics.",
    sql: "SELECT f.content FROM facts f WHERE f.agent_id = 'tutor' AND f.kind = 'pricing_heuristic'",
    difficulty: "simple",
  },
  {
    question_id: 28,
    db_id: "language_tutor_memory_v1",
    axis: "retrieval",
    question:
      "Which words has the tutor recorded the student getting wrong? List each word once, alphabetically.",
    sql:
      "SELECT DISTINCT e.canonical_name FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'tutor' AND f.kind = 'mistake' AND e.kind = 'word' " +
      "ORDER BY e.canonical_name",
    difficulty: "moderate",
  },
  // ── temporal ────────────────────────────────────────────────────────────────
  {
    question_id: 29,
    db_id: "language_tutor_memory_v1",
    axis: "temporal",
    question:
      "Which grammar rules did the student slip on most this month (July 2026)? Show the rule and the count, most first.",
    sql:
      "SELECT e.canonical_name, COUNT(*) AS n FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'tutor' AND f.kind = 'mistake' AND e.kind = 'grammar_rule' " +
      "AND f.created_at >= '2026-07-01' AND f.created_at < '2026-08-01' " +
      "GROUP BY e.id, e.canonical_name ORDER BY n DESC",
    difficulty: "challenging",
  },
  {
    question_id: 30,
    db_id: "language_tutor_memory_v1",
    axis: "temporal",
    question: "What is student:alex's current level?",
    sql:
      "SELECT f.content FROM facts f WHERE f.agent_id = 'tutor' " +
      "AND f.kind = 'student_profile' AND f.content LIKE 'level:%' " +
      "ORDER BY f.created_at DESC LIMIT 1",
    difficulty: "moderate",
  },
  {
    question_id: 31,
    db_id: "language_tutor_memory_v1",
    axis: "temporal",
    question:
      "List the tutor's lesson sessions in chronological order — what each covered and when.",
    sql:
      "SELECT e.content, e.occurred_at FROM episodes e " +
      "WHERE e.agent_id = 'tutor' AND e.role = 'lesson' ORDER BY e.occurred_at",
    difficulty: "moderate",
  },
  {
    question_id: 32,
    db_id: "language_tutor_memory_v1",
    axis: "temporal",
    question:
      "Which vocabulary is due for spaced-repetition review in the week of 2026-08-03? Show the card and its due date, soonest first.",
    sql:
      "SELECT f.content, f.expires_at FROM facts f WHERE f.agent_id = 'tutor' " +
      "AND f.kind = 'vocab_encounter' AND f.expires_at >= '2026-08-03' " +
      "AND f.expires_at < '2026-08-10' ORDER BY f.expires_at",
    difficulty: "challenging",
  },
  // ── forgetting ──────────────────────────────────────────────────────────────
  {
    question_id: 33,
    db_id: "language_tutor_memory_v1",
    axis: "forgetting",
    question: "How many of student:alex's level facts are now stale — superseded by a newer level?",
    sql:
      "SELECT COUNT(*) FROM facts f WHERE f.agent_id = 'tutor' " +
      "AND f.kind = 'student_profile' AND f.content LIKE 'level:%' " +
      "AND f.created_at < (SELECT MAX(created_at) FROM facts " +
      "WHERE agent_id = 'tutor' AND kind = 'student_profile' AND content LIKE 'level:%')",
    difficulty: "moderate",
  },
  {
    question_id: 34,
    db_id: "language_tutor_memory_v1",
    axis: "forgetting",
    question: "Which practice topics has the tutor retired — mastered and dropped from rotation?",
    sql:
      "SELECT e.canonical_name FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'tutor' AND f.kind = 'retired'",
    difficulty: "moderate",
  },
  // ── consolidation ─────────────────────────────────────────────────────────────
  {
    question_id: 35,
    db_id: "language_tutor_memory_v1",
    axis: "consolidation",
    question:
      "How many distinct vocabulary words has the tutor introduced? Ignore a word re-logged verbatim in a later session.",
    sql:
      "SELECT COUNT(DISTINCT f.content) FROM facts f " +
      "WHERE f.agent_id = 'tutor' AND f.kind = 'vocab_encounter'",
    difficulty: "moderate",
  },
  {
    question_id: 36,
    db_id: "language_tutor_memory_v1",
    axis: "consolidation",
    question:
      "Which vocabulary card did the tutor log more than once with identical content? Show the card and how many times.",
    sql:
      "SELECT f.content, COUNT(*) AS n FROM facts f WHERE f.agent_id = 'tutor' " +
      "AND f.kind = 'vocab_encounter' GROUP BY f.content HAVING COUNT(*) > 1",
    difficulty: "challenging",
  },
  // ── analytical ────────────────────────────────────────────────────────────────
  {
    question_id: 37,
    db_id: "language_tutor_memory_v1",
    axis: "analytical",
    question:
      "Which words did the student get wrong 3 or more times? Show the word and the count, most first.",
    sql:
      "SELECT e.canonical_name, COUNT(*) AS n FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'tutor' AND f.kind = 'mistake' AND e.kind = 'word' " +
      "GROUP BY e.id, e.canonical_name HAVING COUNT(*) >= 3 ORDER BY n DESC",
    difficulty: "challenging",
  },
  {
    question_id: 38,
    db_id: "language_tutor_memory_v1",
    axis: "analytical",
    question:
      "Which topics produce the most corrections? Show the topic and the count, most first.",
    sql:
      "SELECT e.canonical_name, COUNT(*) AS n FROM facts f " +
      "JOIN entity_facts ef ON ef.fact_id = f.id JOIN entities e ON e.id = ef.entity_id " +
      "WHERE f.agent_id = 'tutor' AND f.kind = 'mistake' AND e.kind = 'topic' " +
      "GROUP BY e.id, e.canonical_name ORDER BY n DESC",
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

// Project to the canonical harness type. `evidence` carries the goal-pack's
// declared categorical vocabulary (MEMORY_SCHEMA_EVIDENCE) so the planner
// value-links `kind`/`predicate`/`role` filters against a fixed domain
// instead of guessing a drifted literal (SK-QUAL-023 vocabulary lever;
// GLOBAL-037 planning lane 1). `axis` narrows to one quality axis for a
// lever-focused run.
export function toEvalQuestions(opts: { axis?: MemoryAxis; limit?: number } = {}): EvalQuestion[] {
  let qs = MEMORY_QUALITY_QUESTIONS;
  if (opts.axis) qs = qs.filter((q) => q.axis === opts.axis);
  if (opts.limit !== undefined) qs = qs.slice(0, Math.max(0, opts.limit));
  return qs.map((q) => ({
    question_id: q.question_id,
    db_id: q.db_id,
    question: q.question,
    evidence: MEMORY_SCHEMA_EVIDENCE[q.db_id] ?? "",
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
