import { describe, expect, it } from "vitest";

import { pruneSchemaForGoal, wordTokens } from "../src/schema-prune.ts";

// Six tables, > 2000 chars, FK chain races → drivers — the shape the
// pruner is for. Padding comments push it over MIN_SCHEMA_CHARS.
const pad = `-- ${"x".repeat(300)}`;
const BIG_SCHEMA = [
  `CREATE TABLE drivers (driverId INTEGER PRIMARY KEY, forename TEXT, surname TEXT, nationality TEXT) ${pad}`,
  `CREATE TABLE races (raceId INTEGER PRIMARY KEY, year INTEGER, name TEXT) ${pad}`,
  `CREATE TABLE results (resultId INTEGER PRIMARY KEY, raceId INTEGER REFERENCES races(raceId), driverId INTEGER REFERENCES drivers(driverId), points REAL) ${pad}`,
  `CREATE TABLE circuits (circuitId INTEGER PRIMARY KEY, location TEXT, country TEXT) ${pad}`,
  `CREATE TABLE "pitStops" (raceId INTEGER REFERENCES races(raceId), stop INTEGER, milliseconds INTEGER) ${pad}`,
  `CREATE TABLE seasons (year INTEGER PRIMARY KEY, url TEXT) ${pad}`,
].join(";\n");

describe("wordTokens", () => {
  it("splits snake_case, camelCase, and strips a plural s", () => {
    expect(wordTokens("FreeMealCount")).toEqual(new Set(["free", "meal", "count"]));
    expect(wordTokens("lap_times")).toEqual(new Set(["lap", "times", "time"]));
  });

  it("drops tokens shorter than three characters", () => {
    expect(wordTokens("id of t")).toEqual(new Set());
  });
});

describe("pruneSchemaForGoal", () => {
  it("keeps goal-matched tables plus their REFERENCES closure, drops the rest", () => {
    const pruned = pruneSchemaForGoal(BIG_SCHEMA, "Total points scored by each driver");
    // `results` matches "points"; closure pulls races + drivers in.
    expect(pruned).toContain("CREATE TABLE results");
    expect(pruned).toContain("CREATE TABLE races");
    expect(pruned).toContain("CREATE TABLE drivers");
    expect(pruned).not.toContain("circuits");
    expect(pruned).not.toContain("seasons");
  });

  it("matches on column tokens, not only table names", () => {
    const pruned = pruneSchemaForGoal(BIG_SCHEMA, "Which country hosts the most events?");
    expect(pruned).toContain("circuits"); // via the `country` column
  });

  it("returns the schema unchanged when nothing matches", () => {
    expect(pruneSchemaForGoal(BIG_SCHEMA, "completely unrelated zzz")).toBe(BIG_SCHEMA);
  });

  it("returns small schemas unchanged", () => {
    const small = "CREATE TABLE t (a INTEGER, b TEXT)";
    expect(pruneSchemaForGoal(small, "how many a")).toBe(small);
  });

  it("returns the schema unchanged when pruning would keep nearly everything", () => {
    // Every table name appears in the goal ⇒ kept ratio over the cap.
    const goal = "drivers races results circuits pitStops seasons points";
    expect(pruneSchemaForGoal(BIG_SCHEMA, goal)).toBe(BIG_SCHEMA);
  });

  it("handles quoted identifiers", () => {
    const pruned = pruneSchemaForGoal(BIG_SCHEMA, "average pit stop milliseconds");
    expect(pruned).toContain('"pitStops"');
    expect(pruned).toContain("CREATE TABLE races"); // closure target
  });

  it("returns unparseable schema text unchanged", () => {
    const blob = `not ddl at all ${"y".repeat(2100)}`;
    expect(pruneSchemaForGoal(blob, "anything")).toBe(blob);
  });

  // Many-to-many bridge whose own name/columns share no goal token (`sid`,
  // `cid` are < MIN_TOKEN_LEN; `enrolments` doesn't appear in the goal). The
  // join path students→enrolments→courses is unplannable without the link,
  // and parent-only FK closure never reaches it (students/courses reference
  // nothing). The ≥2-kept-references bridge rule pulls it in.
  const LINK_SCHEMA = [
    `CREATE TABLE students (id INTEGER PRIMARY KEY, fullname TEXT, year INTEGER) ${pad}`,
    `CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT, credits INTEGER) ${pad}`,
    `CREATE TABLE enrolments (sid INTEGER REFERENCES students(id), cid INTEGER REFERENCES courses(id), grade TEXT) ${pad}`,
    `CREATE TABLE teachers (id INTEGER PRIMARY KEY, fullname TEXT) ${pad}`,
    `CREATE TABLE buildings (id INTEGER PRIMARY KEY, location TEXT) ${pad}`,
    `CREATE TABLE rooms (id INTEGER PRIMARY KEY, capacity INTEGER) ${pad}`,
  ].join(";\n");

  it("keeps a bridge table that links two goal-matched tables", () => {
    const pruned = pruneSchemaForGoal(LINK_SCHEMA, "courses taken by each student");
    expect(pruned).toContain("CREATE TABLE students");
    expect(pruned).toContain("CREATE TABLE courses");
    expect(pruned).toContain("CREATE TABLE enrolments"); // the join path
    expect(pruned).not.toContain("buildings");
    expect(pruned).not.toContain("rooms");
  });

  it("does not pull a child that references only one kept table", () => {
    // `enrolments` references students+courses; with only `students` matched
    // it is a plain child (1 kept ref), not a bridge → stays dropped.
    const pruned = pruneSchemaForGoal(LINK_SCHEMA, "list every student fullname");
    expect(pruned).toContain("CREATE TABLE students");
    expect(pruned).not.toContain("enrolments");
  });
});

// Join-path recall on multi-hop goals — the number this change moves. Each
// case lists the gold tables the answer's SQL must join; recall is the
// fraction retained. Bridge-table closure lifts it from miss to complete.
describe("pruneSchemaForGoal — join-path recall", () => {
  const pad = `-- ${"x".repeat(300)}`;
  const SCHEMA = [
    `CREATE TABLE students (id INTEGER PRIMARY KEY, fullname TEXT) ${pad}`,
    `CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT) ${pad}`,
    `CREATE TABLE enrolments (sid INTEGER REFERENCES students(id), cid INTEGER REFERENCES courses(id), grade TEXT) ${pad}`,
    `CREATE TABLE authors (id INTEGER PRIMARY KEY, fullname TEXT) ${pad}`,
    `CREATE TABLE papers (id INTEGER PRIMARY KEY, headline TEXT) ${pad}`,
    `CREATE TABLE writes (aid INTEGER REFERENCES authors(id), pid INTEGER REFERENCES papers(id)) ${pad}`,
  ].join(";\n");

  const cases: { goal: string; gold: string[] }[] = [
    { goal: "courses taken by each student", gold: ["students", "courses", "enrolments"] },
    { goal: "papers written by each author", gold: ["authors", "papers", "writes"] },
  ];

  it("retains every gold table on the multi-hop suite", () => {
    let kept = 0;
    let total = 0;
    for (const { goal, gold } of cases) {
      const pruned = pruneSchemaForGoal(SCHEMA, goal).toLowerCase();
      for (const t of gold) {
        total += 1;
        if (pruned.includes(`create table ${t}`)) kept += 1;
      }
    }
    // 6/6 after the bridge rule; was 4/6 (both link tables dropped) before.
    expect(kept).toBe(total);
  });
});
