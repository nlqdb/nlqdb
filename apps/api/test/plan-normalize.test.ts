// SK-ASK-025 — hosted plan SQL is schema-relative. Unit coverage for the
// two normalisation primitives.

import { describe, expect, it } from "vitest";
import { referencesQualifiedTable, schemaRelativeSql } from "../src/ask/plan-normalize.ts";

describe("schemaRelativeSql", () => {
  it("strips the own schema qualifier in the quoted DDL form", () => {
    expect(schemaRelativeSql('SELECT count(*) FROM "users_11d170"."users"', "users_11d170")).toBe(
      'SELECT count(*) FROM "users"',
    );
  });

  it("strips the own schema qualifier in the bare form", () => {
    expect(schemaRelativeSql("SELECT count(*) FROM users_11d170.users", "users_11d170")).toBe(
      "SELECT count(*) FROM users",
    );
  });

  it("leaves a foreign schema qualifier untouched (only the own name matches)", () => {
    // The poisoned cross-DB case: this DB is users_11d170, the cached plan
    // names users_d31c65 — stripping the own name is a no-op, so the residual
    // qualifier survives for referencesQualifiedTable to catch.
    expect(schemaRelativeSql("SELECT count(*) FROM users_d31c65.users", "users_11d170")).toBe(
      "SELECT count(*) FROM users_d31c65.users",
    );
  });

  it("never corrupts a numeric literal, even for a degenerate numeric schema name", () => {
    // The lookahead requires an identifier start after the dot, so `1.5` is
    // safe even when the schema name is the pathological "1".
    expect(schemaRelativeSql("SELECT * FROM orders WHERE amount > 1.5", "1")).toBe(
      "SELECT * FROM orders WHERE amount > 1.5",
    );
  });

  it("is a no-op on already-unqualified SQL", () => {
    expect(schemaRelativeSql("SELECT * FROM orders", "orders_abc123")).toBe("SELECT * FROM orders");
  });
});

describe("referencesQualifiedTable", () => {
  it("is true for a schema-qualified table", () => {
    expect(referencesQualifiedTable("SELECT * FROM other_schema.tbl")).toBe(true);
  });

  it("is false for an unqualified table", () => {
    expect(referencesQualifiedTable("SELECT * FROM users")).toBe(false);
  });

  it("does not mistake a column reference (table.column) for a schema qualifier", () => {
    expect(referencesQualifiedTable("SELECT users.id FROM users")).toBe(false);
  });

  it("returns false on unparseable SQL", () => {
    expect(referencesQualifiedTable("NOT SQL AT ALL ;;;")).toBe(false);
  });
});
