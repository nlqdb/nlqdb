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

describe("toEvalQuestions", () => {
  it("projects to the canonical EvalQuestion shape (empty evidence, gold sql)", () => {
    const out = toEvalQuestions();
    expect(out).toHaveLength(MEMORY_QUALITY_QUESTIONS.length);
    expect(out[0]?.evidence).toBe("");
    expect(out[0]?.sql.length).toBeGreaterThan(0);
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
