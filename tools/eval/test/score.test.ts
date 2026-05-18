import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _testing, scoreOne } from "../src/score.ts";

const { canonicalize, rowsMatch, hasOrderBy, normalizeSql } = _testing;

describe("canonicalize", () => {
  it("treats null and undefined the same", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(undefined)).toBe("null");
  });

  it("emits stable form for objects regardless of key order", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it("encodes Uint8Array via base64 so blob rows compare", () => {
    const a = canonicalize(new Uint8Array([1, 2, 3]));
    const b = canonicalize(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a.startsWith("b64:")).toBe(true);
  });
});

describe("rowsMatch", () => {
  const A = { id: 1, name: "alice" };
  const B = { id: 2, name: "bob" };

  it("unordered: multiset match regardless of order", () => {
    expect(rowsMatch([A, B], [B, A], false)).toBe(true);
  });

  it("ordered: sequence-strict", () => {
    expect(rowsMatch([A, B], [B, A], true)).toBe(false);
    expect(rowsMatch([A, B], [A, B], true)).toBe(true);
  });

  it("rejects when row counts differ", () => {
    expect(rowsMatch([A], [A, A], false)).toBe(false);
  });

  it("respects duplicates in multiset comparison", () => {
    expect(rowsMatch([A, A, B], [A, B, B], false)).toBe(false);
    expect(rowsMatch([A, A, B], [A, B, A], false)).toBe(true);
  });
});

describe("hasOrderBy", () => {
  it("matches case-insensitive word boundaries", () => {
    expect(hasOrderBy("SELECT 1 ORDER BY id")).toBe(true);
    expect(hasOrderBy("select * from t order  by name desc")).toBe(true);
  });

  it("ignores 'orderby' as a single identifier", () => {
    expect(hasOrderBy("SELECT orderby FROM t")).toBe(false);
  });
});

describe("normalizeSql", () => {
  it("strips trailing semicolons and whitespace", () => {
    expect(normalizeSql("SELECT 1; \n")).toBe("SELECT 1");
  });

  it("removes leading line comments", () => {
    expect(normalizeSql("-- gold\nSELECT 1")).toBe("SELECT 1");
  });
});

describe("scoreOne — against an on-disk SQLite fixture", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nlqdb-eval-"));
    dbPath = join(dir, "fixture.sqlite");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE pet (id INTEGER PRIMARY KEY, name TEXT, species TEXT);");
    db.exec(
      "INSERT INTO pet (id, name, species) VALUES (1,'whisk','cat'),(2,'rex','dog'),(3,'milo','cat');",
    );
    db.close();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("scores match when both queries return the same multiset", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT name FROM pet WHERE species='cat'",
      predictedSql: "SELECT name FROM pet WHERE species = 'cat'",
    });
    expect(r.outcome).toBe("match");
  });

  it("scores mismatch when the predicted set differs", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT name FROM pet WHERE species='cat'",
      predictedSql: "SELECT name FROM pet",
    });
    expect(r.outcome).toBe("mismatch");
  });

  it("scores exec_error when predicted SQL is broken", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT 1",
      predictedSql: "SELECT FROM",
    });
    expect(r.outcome).toBe("exec_error");
    expect(r.error).toBeTruthy();
  });

  it("scores gold_error when gold SQL itself is broken", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT FROM nope",
      predictedSql: "SELECT 1",
    });
    expect(r.outcome).toBe("gold_error");
  });

  it("scores no_sql when predicted SQL is empty", async () => {
    const r = await scoreOne({
      dbPath,
      goldSql: "SELECT 1",
      predictedSql: "",
    });
    expect(r.outcome).toBe("no_sql");
  });

  it("respects ORDER BY in gold (sequence-strict)", async () => {
    const gold = "SELECT name FROM pet ORDER BY id DESC";
    const r = await scoreOne({
      dbPath,
      goldSql: gold,
      predictedSql: "SELECT name FROM pet ORDER BY id ASC",
    });
    expect(r.outcome).toBe("mismatch");
  });
});
