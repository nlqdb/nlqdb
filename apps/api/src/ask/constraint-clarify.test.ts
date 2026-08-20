// SK-ASK-031 — missing-required-reference clarify. The fixture schema is the
// literal production schema from the 2026-08-17/19 incident DB
// (db_ideas_db_1ec135): ideas.user_id NOT NULL + FK to a users table, created
// before SK-HDC-022 made inferred FKs nullable.

import { describe, expect, it } from "vitest";
import { constraintClarify, labelColumnOf, referencedTable } from "./constraint-clarify.ts";
import { type DbRecord, WriteConstraintError } from "./types.ts";

const SCHEMA = `CREATE TABLE "ideas_db_1ec135"."users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "ideas_db_1ec135"."ideas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("id")
);

ALTER TABLE "ideas_db_1ec135"."ideas"
  ADD CONSTRAINT "fk_ideas__user_id"
  FOREIGN KEY ("user_id")
  REFERENCES "ideas_db_1ec135"."users" ("id")
  ON DELETE CASCADE;`;

const db = { schemaText: SCHEMA } as DbRecord;
const GOAL = "add an idea to build trust mcp directory rateme12345";

const execReturning =
  (rows: Record<string, unknown>[]) =>
  async (
    _db: DbRecord,
    sql: string,
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> => {
    expect(sql).toMatch(/^SELECT "name" FROM "users" LIMIT \d+$/);
    return { rows, rowCount: rows.length };
  };

describe("referencedTable", () => {
  it("resolves by constraint name (the 23503 shape — no column in the message)", () => {
    expect(referencedTable(SCHEMA, { table: "ideas", constraint: "fk_ideas__user_id" })).toEqual({
      parent: "users",
      column: "user_id",
    });
  });

  it("resolves by column (the 23502 not-null shape)", () => {
    expect(referencedTable(SCHEMA, { table: "ideas", column: "user_id" })).toEqual({
      parent: "users",
      column: "user_id",
    });
  });

  it("resolves the inline REFERENCES form", () => {
    const inline = `CREATE TABLE "t" ("owner_id" UUID NOT NULL REFERENCES "owners" ("id"), "x" TEXT);`;
    expect(referencedTable(inline, { column: "owner_id" })).toEqual({
      parent: "owners",
      column: "owner_id",
    });
  });

  it("returns null for a non-FK column", () => {
    expect(referencedTable(SCHEMA, { table: "ideas", column: "title" })).toBeNull();
  });
});

describe("labelColumnOf", () => {
  it("prefers a human-name column", () => {
    expect(labelColumnOf(SCHEMA, "users")).toBe("name");
  });

  it("falls back to the first textual non-id column", () => {
    const s = `CREATE TABLE "tags" (\n  "id" UUID NOT NULL,\n  "value" TEXT NOT NULL,\n  PRIMARY KEY ("id")\n);`;
    expect(labelColumnOf(s, "tags")).toBe("value");
  });

  it("returns null when the table has no textual column", () => {
    const s = `CREATE TABLE "links" (\n  "a_id" UUID NOT NULL,\n  "b_id" UUID NOT NULL\n);`;
    expect(labelColumnOf(s, "links")).toBeNull();
  });
});

describe("constraintClarify", () => {
  it("turns the incident's 23502 into a clarify with one chip per users row", async () => {
    const err = new WriteConstraintError("not_null", { table: "ideas", column: "user_id" });
    const clarify = await constraintClarify(
      err,
      GOAL,
      db,
      execReturning([{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }]),
    );
    expect(clarify).not.toBeNull();
    expect(clarify?.clarification).toBe("missing_required_reference");
    expect(clarify?.options?.map((o) => o.label)).toEqual(["For Alice", "For Bob", "For Carol"]);
    // The re-sent goal names the chosen row, which is exactly what the
    // planner was missing — and what SK-LLM-050 forbids it to guess.
    expect(clarify?.options?.[0]?.goal).toBe(`${GOAL} (use the users row whose name is "Alice")`);
  });

  it("turns the incident's 23503 (placeholder UUID) into the same clarify", async () => {
    const err = new WriteConstraintError("foreign_key", {
      table: "ideas",
      constraint: "fk_ideas__user_id",
    });
    const clarify = await constraintClarify(err, GOAL, db, execReturning([{ name: "Alice" }]));
    expect(clarify?.options).toHaveLength(1);
  });

  it("offers a create-first option when the parent table is empty", async () => {
    const err = new WriteConstraintError("not_null", { table: "ideas", column: "user_id" });
    const clarify = await constraintClarify(err, GOAL, db, execReturning([]));
    expect(clarify?.reason).toContain("users is empty");
    expect(clarify?.options?.[0]?.goal).toBe("add a row to the users table");
  });

  it("caps, dedupes, and drops blank labels", async () => {
    const err = new WriteConstraintError("not_null", { table: "ideas", column: "user_id" });
    const rows = ["A", "A", "", "B", "C", "D", "E"].map((name) => ({ name }));
    const clarify = await constraintClarify(err, GOAL, db, execReturning(rows));
    expect(clarify?.options?.map((o) => o.label)).toEqual(["For A", "For B", "For C", "For D"]);
  });

  it("returns null for unique/check kinds, a non-FK column, and an exec failure", async () => {
    const uniq = new WriteConstraintError("unique", { table: "ideas", column: "title" });
    expect(await constraintClarify(uniq, GOAL, db, execReturning([]))).toBeNull();

    const nonFk = new WriteConstraintError("not_null", { table: "ideas", column: "title" });
    expect(await constraintClarify(nonFk, GOAL, db, execReturning([]))).toBeNull();

    const fk = new WriteConstraintError("not_null", { table: "ideas", column: "user_id" });
    const failingExec = async () => {
      throw new Error("boom");
    };
    expect(await constraintClarify(fk, GOAL, db, failingExec)).toBeNull();
  });
});
