// SK-ASK-029 — constraint classifier. The production failure: a `23503` FK
// violation went through the exec catch-all as `db_unreachable` ("Couldn't
// reach the database — try again"), after three backed-off replays of a
// statement that could never succeed.

import { describe, expect, it } from "vitest";
import { WriteConstraintError } from "./types.ts";
import { classifyWriteConstraint } from "./write-constraint.ts";

function pgError(message: string, code?: string): Error {
  const err = new Error(message) as Error & { code?: string };
  if (code) err.code = code;
  return err;
}

function classified(err: unknown): WriteConstraintError {
  const wrapped = classifyWriteConstraint(err);
  expect(wrapped).not.toBeNull();
  const cause = wrapped?.cause;
  if (!(cause instanceof WriteConstraintError)) throw new Error("expected WriteConstraintError");
  return cause;
}

describe("classifyWriteConstraint", () => {
  it("classifies 23503 (foreign key) with the table, constraint, and DETAIL column", () => {
    const err = classified(
      pgError(
        'insert or update on table "ideas" violates foreign key constraint "fk_ideas__user_id" - ' +
          'DETAIL: Key (user_id)=(00000000-0000-0000-0000-000000000000) is not present in table "users".',
        "23503",
      ),
    );
    expect(err.kind).toBe("foreign_key");
    expect(err.target).toEqual({
      table: "ideas",
      column: "user_id",
      constraint: "fk_ideas__user_id",
    });
    // The offending value never leaves the server.
    expect(JSON.stringify(err.target)).not.toContain("00000000");
  });

  it("classifies 23502 (not null) from the column/relation message shape", () => {
    const err = classified(
      pgError(
        'null value in column "title" of relation "ideas" violates not-null constraint',
        "23502",
      ),
    );
    expect(err.kind).toBe("not_null");
    expect(err.target.column).toBe("title");
    expect(err.target.table).toBe("ideas");
  });

  it("classifies unique + check violations", () => {
    expect(
      classified(pgError('duplicate key value violates unique constraint "ideas_pkey"', "23505"))
        .kind,
    ).toBe("unique");
    expect(
      classified(
        pgError('new row for relation "ideas" violates check constraint "ideas_score_ck"', "23514"),
      ).kind,
    ).toBe("check");
  });

  // Neon's HTTP driver drops `.code` on some paths; the message shape is the
  // backstop (same posture as `schema-mismatch.ts` / `exec-repair.ts`).
  it("falls back to the message when SQLSTATE is absent", () => {
    expect(
      classified(pgError('insert on table "ideas" violates foreign key constraint "fk_x"')).kind,
    ).toBe("foreign_key");
  });

  it("returns null for non-constraint errors (they keep their own classification)", () => {
    expect(classifyWriteConstraint(pgError("connection reset"))).toBeNull();
    expect(classifyWriteConstraint(pgError('relation "ideas" does not exist', "42P01"))).toBeNull();
    expect(classifyWriteConstraint(pgError('column "x" does not exist', "42703"))).toBeNull();
    expect(classifyWriteConstraint(null)).toBeNull();
  });
});
