import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import {
  checkGoldExecutability,
  PERSONA_BENCH_QUESTIONS,
  PERSONA_BENCH_SCHEMAS,
  type PersonaDb,
  type PersonaSchema,
  schemaFor,
  toEvalQuestions,
} from "../../src/datasets/persona-bench.ts";

// A fresh in-memory SQLite handle per schema, the same driver the runner
// scores against (bun:sqlite). No network, no LLM.
function openDb(_schema: PersonaSchema): PersonaDb {
  const db = new Database(":memory:");
  return { run: (sql) => db.run(sql), query: (sql) => db.query(sql).all() };
}

describe("persona-bench fixture", () => {
  it("every question maps to a defined schema, and every schema has a question", () => {
    for (const q of PERSONA_BENCH_QUESTIONS) {
      expect(schemaFor(q.db_id), `q${q.question_id} db_id ${q.db_id}`).toBeDefined();
    }
    for (const s of PERSONA_BENCH_SCHEMAS) {
      const n = PERSONA_BENCH_QUESTIONS.filter((q) => q.db_id === s.db_id).length;
      expect(n, `schema ${s.db_id} has questions`).toBeGreaterThan(0);
    }
  });

  it("covers both P1 (Solo Builder) and P2 (Agent Builder) personas", () => {
    const personas = new Set(PERSONA_BENCH_QUESTIONS.map((q) => q.persona));
    expect(personas.has("P1")).toBe(true);
    expect(personas.has("P2")).toBe(true);
  });

  it("uses time-stable gold SQL — no relative dates", () => {
    for (const q of PERSONA_BENCH_QUESTIONS) {
      expect(q.sql.toLowerCase(), `q${q.question_id} must not use date('now')`).not.toContain(
        "now",
      );
    }
  });
});

describe("persona-bench gold-executability invariant (v0)", () => {
  it("every gold SQL executes against its seeded schema and returns ≥1 row", () => {
    const checks = checkGoldExecutability(openDb);
    expect(checks).toHaveLength(PERSONA_BENCH_QUESTIONS.length);
    const failures = checks.filter((c) => !c.ok);
    expect(failures, JSON.stringify(failures, null, 2)).toHaveLength(0);
  });

  it("the agent-memory TTL gold returns the 2 facts expired before the cutoff", () => {
    // q9: facts with a non-null expires_at strictly before 2026-06-21 → facts 3 (06-10) + 7 (06-15)
    const schema = schemaFor("agent_memory");
    if (!schema) throw new Error("agent_memory schema missing");
    const db = openDb(schema);
    for (const stmt of schema.setup) db.run(stmt);
    const q9 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 9);
    const rows = db.query(q9?.sql ?? "") as Array<Record<string, number>>;
    expect(Object.values(rows[0] ?? {})[0]).toBe(2);
  });

  it("filters by persona", () => {
    const p1 = checkGoldExecutability(openDb, { persona: "P1" });
    expect(p1.every((c) => c.db_id === "saas_app")).toBe(true);
    expect(p1.length).toBeGreaterThan(0);
  });
});

describe("toEvalQuestions", () => {
  it("projects to the canonical EvalQuestion shape (empty evidence, gold sql)", () => {
    const out = toEvalQuestions();
    expect(out).toHaveLength(PERSONA_BENCH_QUESTIONS.length);
    expect(out[0]?.evidence).toBe("");
    expect(out[0]?.sql.length).toBeGreaterThan(0);
  });

  it("applies persona filter and limit", () => {
    expect(toEvalQuestions({ persona: "P2" }).every((q) => q.db_id === "agent_memory")).toBe(true);
    expect(toEvalQuestions({ limit: 3 })).toHaveLength(3);
  });
});
