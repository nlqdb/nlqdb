import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  axisFor,
  checkGoldExecutability,
  loadMemoryQuality,
  MEMORY_QUALITY_QUESTIONS,
  MEMORY_QUALITY_SCHEMAS,
  MEMORY_SCHEMA_EVIDENCE,
  type MemoryAxis,
  type MemoryDb,
  type MemorySchema,
  schemaFor,
  toEvalQuestions,
} from "../../src/datasets/memory-quality.ts";

const ALL_AXES: MemoryAxis[] = [
  "retrieval",
  "temporal",
  "forgetting",
  "consolidation",
  "analytical",
];

// A fresh in-memory SQLite handle per schema — the same driver the runner
// scores against (bun:sqlite). No network, no LLM.
function openDb(_schema: MemorySchema): MemoryDb {
  const db = new Database(":memory:");
  return { run: (sql) => db.run(sql), query: (sql) => db.query(sql).all() };
}

// Seed once, return a live handle for value assertions.
function seeded(db_id = "agent_memory_v1"): Database {
  const schema = schemaFor(db_id);
  if (!schema) throw new Error(`no schema for ${db_id}`);
  const db = new Database(":memory:");
  for (const stmt of schema.setup) db.run(stmt);
  return db;
}

function goldFor(question_id: number): string {
  const q = MEMORY_QUALITY_QUESTIONS.find((x) => x.question_id === question_id);
  if (!q) throw new Error(`no question ${question_id}`);
  return q.sql;
}

function scalar(db: Database, question_id: number): unknown {
  const rows = db.query(goldFor(question_id)).values() as unknown[][];
  return rows[0]?.[0];
}

describe("memory-quality fixture", () => {
  it("every question maps to a defined schema, and every schema has a question", () => {
    for (const q of MEMORY_QUALITY_QUESTIONS) {
      expect(schemaFor(q.db_id), `q${q.question_id} db_id ${q.db_id}`).toBeDefined();
    }
    for (const s of MEMORY_QUALITY_SCHEMAS) {
      const n = MEMORY_QUALITY_QUESTIONS.filter((q) => q.db_id === s.db_id).length;
      expect(n, `schema ${s.db_id} has questions`).toBeGreaterThan(0);
    }
  });

  it("covers all four quality axes plus the analytical showcase", () => {
    const axes = new Set(MEMORY_QUALITY_QUESTIONS.map((q) => q.axis));
    for (const a of ALL_AXES) expect(axes.has(a), `axis ${a} present`).toBe(true);
  });

  it("uses time-stable gold SQL — no relative dates", () => {
    for (const q of MEMORY_QUALITY_QUESTIONS) {
      expect(q.sql.toLowerCase(), `q${q.question_id} must not use date('now')`).not.toContain(
        "now",
      );
    }
  });

  it("axisFor maps question ids to their axis", () => {
    expect(axisFor(3)).toBe("temporal");
    expect(axisFor(9)).toBe("consolidation");
    expect(axisFor(999)).toBeUndefined();
  });
});

describe("memory-quality gold-executability invariant", () => {
  it("every gold SQL executes against its seeded schema and returns ≥1 row", () => {
    const checks = checkGoldExecutability(openDb);
    expect(checks).toHaveLength(MEMORY_QUALITY_QUESTIONS.length);
    const failures = checks.filter((c) => !c.ok);
    expect(failures, JSON.stringify(failures, null, 2)).toHaveLength(0);
  });

  // SK-QUAL-019 — an ORDER BY gold is scored sequence-strict, so an unbroken
  // rank-key tie false-mismatches a correct prediction ordering the tie
  // differently. Every ranked gold must return a total order on its last
  // SELECT column.
  it("every ORDER BY gold has a duplicate-free rank key (tie-free ranking)", () => {
    const ties: string[] = [];
    for (const q of MEMORY_QUALITY_QUESTIONS) {
      if (!/\border\s+by\b/i.test(q.sql)) continue;
      const db = seeded(q.db_id);
      const rows = db.query(q.sql).values() as unknown[][];
      db.close();
      const rankKey = rows.map((r) => JSON.stringify(r[r.length - 1]));
      if (new Set(rankKey).size !== rankKey.length) {
        ties.push(`q${q.question_id} (${q.axis}): ${JSON.stringify(rankKey)}`);
      }
    }
    expect(ties, ties.join("\n")).toHaveLength(0);
  });

  it("can filter gold checks by axis", () => {
    const temporal = checkGoldExecutability(openDb, { axis: "temporal" });
    expect(temporal.length).toBeGreaterThan(0);
    expect(temporal.every((c) => c.axis === "temporal")).toBe(true);
  });
});

// The golds encode the quality axes — assert the semantics, not just that
// they run. These are the hand-checked expected values from the seed.
describe("memory-quality axis semantics", () => {
  it("temporal / contradiction: user:42's current city is the most-recent (LA)", () => {
    const db = seeded();
    expect(scalar(db, 3)).toBe("LA");
    db.close();
  });

  it("forgetting: exactly one support-bot fact expired before 2026-06-21", () => {
    const db = seeded();
    expect(scalar(db, 6)).toBe(1); // promo (06-10) expired; trial (06-30) not
    db.close();
  });

  it("forgetting: two user:42 city facts are stale (superseded)", () => {
    const db = seeded();
    expect(scalar(db, 8)).toBe(2); // NYC + SF superseded by LA
    db.close();
  });

  it("consolidation: user:42 likes 2 distinct things despite a duplicate row", () => {
    const db = seeded();
    expect(scalar(db, 9)).toBe(2); // coffee (x2) + tea → 2 distinct
    db.close();
  });

  it("retrieval precision: support-bot's user:42 recall excludes sales-bot's fact", () => {
    const db = seeded();
    const rows = db.query(goldFor(0)).all() as Array<{ predicate: string; object: string }>;
    db.close();
    // 8 support-bot facts about user:42; the sales-bot 'owner'/'sales' row is not among them.
    expect(rows).toHaveLength(8);
    expect(rows.some((r) => r.object === "sales")).toBe(false);
  });
});

// The repo-ops pack (SK-PIVOT-017 / SK-PIVOT-018 goal pack #1) — the corpus
// the docs→memory skill produces. Same contract as above: assert the values,
// not just that the golds run, because the wedge's whole claim is that these
// answers are *right*, not merely returned. Hand-checked against the seed.
describe("repo-ops pack axis semantics", () => {
  const REPO_OPS = "repo_ops_memory_v1";

  it("retrieval: two decisions reference GLOBAL-013, and the other repo's edge stays out", () => {
    const db = seeded(REPO_OPS);
    const rows = (db.query(goldFor(15)).values() as unknown[][]).flat();
    db.close();
    expect(rows.sort()).toEqual(["SK-AUTH-004", "SK-BILL-002"]);
  });

  it("temporal: four open questions were over 30 days old on 2026-07-27, oldest 116 days", () => {
    const db = seeded(REPO_OPS);
    const rows = db.query(goldFor(17)).values() as unknown[][];
    db.close();
    expect(rows.map((r) => r[1])).toEqual([116, 77, 56, 37]);
  });

  it("temporal: SK-ASK-011's current status is the superseding row, not the first one", () => {
    const db = seeded(REPO_OPS);
    expect(scalar(db, 18)).toBe("SK-ASK-011 status: superseded by SK-ASK-014");
    db.close();
  });

  it("forgetting: one tracker fact had expired, and one decision is tombstoned", () => {
    const db = seeded(REPO_OPS);
    expect(scalar(db, 21)).toBe("icp-tracker: 12 candidate repos pending review");
    expect(scalar(db, 22)).toBe("SK-AUTH-002");
    db.close();
  });

  it("consolidation: 6 distinct open questions from 7 rows (one re-written by a later sync)", () => {
    const db = seeded(REPO_OPS);
    expect(scalar(db, 23)).toBe(6);
    expect(db.query(goldFor(24)).values()).toHaveLength(1);
    db.close();
  });

  it("analytical: open questions per feature are 3 / 2 / 1, duplicates collapsed", () => {
    const db = seeded(REPO_OPS);
    const rows = db.query(goldFor(25)).values() as unknown[][];
    db.close();
    expect(rows).toEqual([
      ["auth", 3],
      ["ask-pipeline", 2],
      ["billing", 1],
    ]);
  });

  // Cross-agent isolation is retrieval *precision*: the other repo's agent
  // stores an open question and a GLOBAL-013 reference of its own, and neither
  // may appear in a repo-ops answer.
  it("retrieval precision: no other-repo row leaks into a repo-ops answer", () => {
    const db = seeded(REPO_OPS);
    const questions = db.query(goldFor(16)).values() as unknown[][];
    db.close();
    expect(questions).toHaveLength(7);
    expect(questions.some((r) => String(r[0]).startsWith("other:"))).toBe(false);
  });
});

// The language-tutor expert pack (EK-04 / SK-EKP-004) — the pilot "become AI"
// pack's public rails. Same contract: assert the answers are *right*, not just
// that the golds run. Hand-checked against the seed (reference date 2026-08-01).
describe("language-tutor pack axis semantics", () => {
  const TUTOR = "language_tutor_memory_v1";

  it("temporal: student:alex's current level is the most-recent (B2), not an older one", () => {
    const db = seeded(TUTOR);
    expect(scalar(db, 30)).toBe("level: B2");
    db.close();
  });

  it("temporal: grammar slips this month rank subjunctive > article > past-perfect > preposition", () => {
    const db = seeded(TUTOR);
    const rows = db.query(goldFor(29)).values() as unknown[][];
    db.close();
    expect(rows).toEqual([
      ["subjunctive", 4],
      ["article-usage", 3],
      ["past-perfect", 2],
      ["preposition-of-time", 1],
    ]);
  });

  it("temporal: two June slips are excluded from the this-month grammar tally", () => {
    const db = seeded(TUTOR);
    // 12 grammar mistakes total, but only 10 fall in July → tally sums to 10.
    const rows = db.query(goldFor(29)).values() as unknown[][];
    db.close();
    expect(rows.reduce((n, r) => n + (r[1] as number), 0)).toBe(10);
  });

  it("temporal: two cards are due for review in the week of 2026-08-03, soonest first", () => {
    const db = seeded(TUTOR);
    const rows = db.query(goldFor(32)).values() as unknown[][];
    db.close();
    expect(rows.map((r) => r[1])).toEqual(["2026-08-05", "2026-08-07"]);
  });

  it("forgetting: two level facts are stale (A2, B1 superseded by B2)", () => {
    const db = seeded(TUTOR);
    expect(scalar(db, 33)).toBe(2);
    db.close();
  });

  it("forgetting: small-talk is the one retired topic", () => {
    const db = seeded(TUTOR);
    expect(scalar(db, 34)).toBe("small-talk");
    db.close();
  });

  it("consolidation: 3 distinct vocabulary words despite ephemeral logged twice", () => {
    const db = seeded(TUTOR);
    expect(scalar(db, 35)).toBe(3);
    expect(db.query(goldFor(36)).values()).toHaveLength(1);
    db.close();
  });

  it("analytical: effect (4) and loose (3) are the words wrong ≥3 times", () => {
    const db = seeded(TUTOR);
    const rows = db.query(goldFor(37)).values() as unknown[][];
    db.close();
    expect(rows).toEqual([
      ["effect", 4],
      ["loose", 3],
    ]);
  });

  it("analytical: corrections per topic rank travel > business-email > small-talk", () => {
    const db = seeded(TUTOR);
    const rows = db.query(goldFor(38)).values() as unknown[][];
    db.close();
    expect(rows).toEqual([
      ["travel", 9],
      ["business-email", 7],
      ["small-talk", 5],
    ]);
  });

  it("retrieval precision: no other-tutor word leaks into the tutor's answer", () => {
    const db = seeded(TUTOR);
    const rows = (db.query(goldFor(28)).values() as unknown[][]).flat();
    db.close();
    // The other-tutor agent also recorded an 'effect' mistake — it must not
    // widen this tutor's list beyond its own three words.
    expect(rows).toEqual(["advice", "effect", "loose"]);
  });
});

describe("toEvalQuestions", () => {
  it("projects to the canonical EvalQuestion shape (declared vocab evidence, gold sql)", () => {
    const out = toEvalQuestions();
    expect(out).toHaveLength(MEMORY_QUALITY_QUESTIONS.length);
    const first = out[0];
    if (!first) throw new Error("no questions");
    // Evidence now carries the goal-pack's declared categorical vocabulary
    // (SK-QUAL-023 lever), keyed by db_id — never empty for a pack that
    // declares one.
    const firstEvidence = MEMORY_SCHEMA_EVIDENCE[first.db_id];
    if (firstEvidence === undefined) throw new Error(`no evidence for ${first.db_id}`);
    expect(first.evidence).toBe(firstEvidence);
    expect(first.evidence.length).toBeGreaterThan(0);
    expect(first.sql.length).toBeGreaterThan(0);
  });

  it("applies axis filter and limit", () => {
    const temporal = toEvalQuestions({ axis: "temporal" });
    expect(temporal.length).toBeGreaterThan(0);
    expect(toEvalQuestions({ limit: 3 })).toHaveLength(3);
  });
});

// Runner-wiring loader — proves the EvalDataset is dispatchable end-to-end
// offline: every question resolves a materialised `.sqlite` the runner can
// open readonly, and every gold executes against that file. No network, no
// LLM; BIRD/Spider/persona-bench untouched.
describe("loadMemoryQuality (runner wiring)", () => {
  it("resolves a materialised SQLite path for every question's db_id", async () => {
    const dbDir = mkdtempSync(join(tmpdir(), "memory-quality-test-"));
    const { questions, resolveDbPath } = await loadMemoryQuality({ dbDir });
    expect(questions).toHaveLength(MEMORY_QUALITY_QUESTIONS.length);
    for (const q of questions) {
      const path = await resolveDbPath(q.db_id);
      expect(path, `db_id ${q.db_id} resolves a path`).not.toBeNull();
      expect(existsSync(path ?? ""), `materialised file exists for ${q.db_id}`).toBe(true);
    }
    expect(await resolveDbPath("nonexistent")).toBeNull();
  });

  it("the materialised file runs each gold readonly and returns ≥1 row", async () => {
    const dbDir = mkdtempSync(join(tmpdir(), "memory-quality-test-"));
    const { questions, resolveDbPath } = await loadMemoryQuality({ dbDir });
    for (const q of questions) {
      const path = await resolveDbPath(q.db_id);
      const db = new Database(path ?? "", { readonly: true });
      const rows = db.query(q.sql).all();
      db.close();
      expect(
        rows.length,
        `q${q.question_id} returns rows from the materialised db`,
      ).toBeGreaterThan(0);
    }
  });

  it("honours the axis filter", async () => {
    const dbDir = mkdtempSync(join(tmpdir(), "memory-quality-test-"));
    const { questions } = await loadMemoryQuality({ axis: "consolidation", dbDir });
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) expect(axisFor(q.question_id)).toBe("consolidation");
  });
});

// The declared categorical vocabulary (MEMORY_SCHEMA_EVIDENCE) is the
// SK-QUAL-023 value-linking lever: it must stay a truthful description of the
// seed, or it leaks a false domain (a value the DB never stores) or misses a
// real literal (leaving the drift it was meant to fix). This block pins both
// directions to the actual seed so the evidence can never silently diverge
// as fixtures grow — a new `kind`/`role` in a pack fails the test until the
// evidence names it.
describe("MEMORY_SCHEMA_EVIDENCE — declared vocabulary matches the seed", () => {
  // The categorical columns the evidence declares a closed domain for. Their
  // distinct seed values are the only literals the evidence may contain
  // inside a `{…}` set, and every one of them must be named.
  const CATEGORICAL: Record<string, string[]> = {
    facts: ["predicate", "kind"],
    episodes: ["role"],
    entities: ["kind"],
  };

  function seedValues(db_id: string): Set<string> {
    const db = seeded(db_id);
    const vals = new Set<string>();
    for (const [table, cols] of Object.entries(CATEGORICAL)) {
      const present = (
        db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      ).map((r) => r.name);
      for (const col of cols) {
        if (!present.includes(col)) continue;
        for (const row of db.query(`SELECT DISTINCT ${col} AS v FROM ${table}`).all() as Array<{
          v: string;
        }>) {
          vals.add(row.v);
        }
      }
    }
    db.close();
    return vals;
  }

  // Every literal the evidence lists inside a `{a, b, c}` set.
  function declaredLiterals(evidence: string): string[] {
    const out: string[] = [];
    for (const m of evidence.matchAll(/\{([^}]*)\}/g)) {
      for (const tok of (m[1] ?? "").split(",")) {
        const t = tok.trim();
        if (t) out.push(t);
      }
    }
    return out;
  }

  for (const db_id of Object.keys(MEMORY_SCHEMA_EVIDENCE)) {
    it(`${db_id}: evidence names every seed categorical value and invents none`, () => {
      const evidence = MEMORY_SCHEMA_EVIDENCE[db_id] ?? "";
      expect(evidence.length, `${db_id} has evidence`).toBeGreaterThan(0);
      const seed = seedValues(db_id);
      const declared = new Set(declaredLiterals(evidence));
      // Forward: every real categorical literal is declared (no missing value).
      for (const v of seed) {
        expect(declared.has(v), `${db_id} evidence declares seed value '${v}'`).toBe(true);
      }
      // Reverse: every declared literal is a real seed value (no invented domain).
      for (const v of declared) {
        expect(seed.has(v), `${db_id} declared literal '${v}' exists in the seed`).toBe(true);
      }
    });
  }

  it("every schema with declared vocabulary attaches it to its questions", () => {
    for (const db_id of Object.keys(MEMORY_SCHEMA_EVIDENCE)) {
      const qs = toEvalQuestions().filter((q) => q.db_id === db_id);
      expect(qs.length, `${db_id} has questions`).toBeGreaterThan(0);
      const evidence = MEMORY_SCHEMA_EVIDENCE[db_id];
      if (evidence === undefined) throw new Error(`no evidence for ${db_id}`);
      for (const q of qs) expect(q.evidence).toBe(evidence);
    }
  });
});
