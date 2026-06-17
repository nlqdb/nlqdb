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

  // Generic FK column names (`a`/`b`) share no token with the goal, so the
  // junction table is invisible to token-matching and unreachable by
  // outbound REFERENCES closure — the recall hole the bridge pass closes.
  const BRIDGE_SCHEMA = [
    `CREATE TABLE student (sid INTEGER PRIMARY KEY, fullname TEXT, gpa REAL) ${pad}`,
    `CREATE TABLE course (cid INTEGER PRIMARY KEY, title TEXT, credits INTEGER) ${pad}`,
    `CREATE TABLE enroll (a INTEGER REFERENCES student(sid), b INTEGER REFERENCES course(cid), term TEXT) ${pad}`,
    `CREATE TABLE faculty (fid INTEGER PRIMARY KEY, dept TEXT) ${pad}`,
    `CREATE TABLE advises (fid INTEGER REFERENCES faculty(fid), sid INTEGER REFERENCES student(sid)) ${pad}`,
    `CREATE TABLE building (bid INTEGER PRIMARY KEY, address TEXT) ${pad}`,
  ].join(";\n");

  it("keeps a junction table that references two goal-matched tables", () => {
    // Goal names student + course; the link is `enroll`, whose own columns
    // (`a`/`b`/`term`) match no goal token. Without the bridge pass the join
    // student→enroll→course is unplannable.
    const pruned = pruneSchemaForGoal(BRIDGE_SCHEMA, "fullname of each student and the title of every course");
    expect(pruned).toContain("CREATE TABLE student");
    expect(pruned).toContain("CREATE TABLE course");
    expect(pruned).toContain("CREATE TABLE enroll");
    // `advises` references student but not course (one endpoint) — stays out.
    expect(pruned).not.toContain("advises");
    expect(pruned).not.toContain("building");
  });

  it("does not pull in a table that references only one goal-matched table", () => {
    // Only `student` is named; `enroll`/`advises` each reference it once, so
    // neither is a bridge between two named things — distractor bound holds.
    const pruned = pruneSchemaForGoal(BRIDGE_SCHEMA, "the gpa of each student");
    expect(pruned).toContain("CREATE TABLE student");
    expect(pruned).not.toContain("CREATE TABLE enroll");
    expect(pruned).not.toContain("advises");
  });

  it("returns unparseable schema text unchanged", () => {
    const blob = `not ddl at all ${"y".repeat(2100)}`;
    expect(pruneSchemaForGoal(blob, "anything")).toBe(blob);
  });
});
