// SK-SCHEMA-008 — `classifyColumnMissing` is the missing-*column* sibling of
// `classifySchemaError`'s missing-*table* classifier: it routes a write's
// `42703` (undefined_column) to the widen-on-write absorb. These tests pin the
// two paths disjoint (a missing table / schema must NOT classify as a column
// widen) and confirm the `column_missing` diag rides through for the absorb.

import { describe, expect, it, vi } from "vitest";
import { Nonrecoverable } from "./retry.ts";
import { classifyColumnMissing, classifySchemaError } from "./schema-mismatch.ts";
import { SchemaMismatchError } from "./types.ts";

// recordSchemaMismatch emits a structured console.error by design
// (SK-ASK-023); silence it so the classifier assertions read clean.
vi.spyOn(console, "error").mockImplementation(() => {});

const ctx = {
  dbId: "db_x",
  goal: "add an order for alice: total 5.50",
  planSql: "INSERT INTO orders (name, total) VALUES ('alice', 5.50)",
  cacheHit: false,
  planModel: "test",
};

function pgError(message: string, code?: string): Error & { code?: string } {
  const err = new Error(message) as Error & { code?: string };
  if (code) err.code = code;
  return err;
}

describe("classifyColumnMissing (SK-SCHEMA-008)", () => {
  it("classifies a 42703 SQLSTATE as a column_missing widen candidate", () => {
    const out = classifyColumnMissing(pgError('column "total" does not exist', "42703"), ctx);
    expect(out).toBeInstanceOf(Nonrecoverable);
    const cause = (out as Nonrecoverable).cause;
    expect(cause).toBeInstanceOf(SchemaMismatchError);
    expect((cause as SchemaMismatchError).diag).toEqual({
      reason: "column_missing",
      pgCode: "42703",
      pgMessage: 'column "total" does not exist',
    });
  });

  it("falls back to the message when Neon drops the SQLSTATE (msg_match)", () => {
    const out = classifyColumnMissing(pgError('column "total" does not exist'), ctx);
    expect(out).toBeInstanceOf(Nonrecoverable);
    expect(((out as Nonrecoverable).cause as SchemaMismatchError).diag?.pgCode).toBe("msg_match");
  });

  it("does NOT classify a missing table (42P01) — that is the table-widen path", () => {
    expect(
      classifyColumnMissing(pgError('relation "orders" does not exist', "42P01"), ctx),
    ).toBeNull();
    expect(classifyColumnMissing(pgError('relation "orders" does not exist'), ctx)).toBeNull();
  });

  it("does NOT classify a missing schema (3F000) or an integrity violation (23505)", () => {
    expect(classifyColumnMissing(pgError('schema "t_x" does not exist', "3F000"), ctx)).toBeNull();
    expect(classifyColumnMissing(pgError("duplicate key value", "23505"), ctx)).toBeNull();
  });

  it("does NOT classify a connection error", () => {
    expect(classifyColumnMissing(pgError("fetch failed"), ctx)).toBeNull();
  });

  it("is disjoint from classifySchemaError — a 42703 is not a schema_mismatch there", () => {
    // The table/schema classifier must leave 42703 alone so the column path
    // owns it (and a *read*'s 42703 still re-plans via isReplannableExecError).
    expect(classifySchemaError(pgError('column "total" does not exist', "42703"), ctx)).toBeNull();
  });

  it("truncates a very long pg message to 500 chars in the carried diag", () => {
    const long = `column "${"x".repeat(1000)}" does not exist`;
    const out = classifyColumnMissing(pgError(long, "42703"), ctx);
    expect(((out as Nonrecoverable).cause as SchemaMismatchError).diag?.pgMessage.length).toBe(500);
  });
});
