import { describe, expect, it } from "vitest";
import { DESTRUCTIVE_CLARIFY_REASONS, destructiveClarify } from "./destructive-clarify.ts";
import type { DbRecord } from "./types.ts";

function stubDb(schemaText: string | null): DbRecord {
  return {
    id: "db_1",
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "ref",
    schemaHash: "h",
    schemaText,
    connectionBlob: null,
  };
}

const CREATE_OPTION = {
  label: "Start fresh with a new, empty database",
  goal: "create a new empty database",
  forceNoPin: true,
};

describe("destructiveClarify", () => {
  it("returns null for non-destructive reasons (they stay sql_rejected)", () => {
    for (const reason of [
      "parse_failed",
      "empty",
      "disallowed_function",
      "multi_statement",
      "update_without_where",
      "grant_or_revoke",
      "alter_statement",
      "disallowed_verb",
    ]) {
      expect(destructiveClarify(reason, stubDb("CREATE TABLE users (id int);"))).toBeNull();
    }
  });

  it("builds a destructive_ambiguous clarify for the clear-db family", () => {
    for (const reason of ["drop_statement", "truncate_statement", "delete_without_where"]) {
      const out = destructiveClarify(reason, stubDb('CREATE TABLE "s"."users" (id int);'));
      expect(out?.status).toBe("clarify_required");
      expect(out?.clarification).toBe("destructive_ambiguous");
      expect(out?.pinned_db).toBeNull();
      expect(out?.reason).toMatch(/could mean a few things/);
    }
  });

  it("offers one 'empty' option per table plus a 'start fresh' create", () => {
    const out = destructiveClarify(
      "truncate_statement",
      stubDb("CREATE TABLE users (id int);\nCREATE TABLE facts (id int);"),
    );
    expect(out?.options).toEqual([
      { label: 'Empty the "users" table', goal: "delete every row from the users table" },
      { label: 'Empty the "facts" table', goal: "delete every row from the facts table" },
      CREATE_OPTION,
    ]);
  });

  it("caps the per-table options at 3 (+ the create option)", () => {
    const ddl = ["a", "b", "c", "d", "e"].map((t) => `CREATE TABLE ${t} (id int);`).join("\n");
    const out = destructiveClarify("drop_statement", stubDb(ddl));
    expect(out?.options).toHaveLength(4);
    expect(out?.options?.filter((o) => o.forceNoPin)).toHaveLength(1);
  });

  it("falls back to just the create option when schemaText is null", () => {
    const out = destructiveClarify("drop_statement", stubDb(null));
    expect(out?.options).toEqual([CREATE_OPTION]);
  });

  it("DESTRUCTIVE_CLARIFY_REASONS is the clear-db family only", () => {
    expect([...DESTRUCTIVE_CLARIFY_REASONS].sort()).toEqual([
      "delete_without_where",
      "drop_statement",
      "truncate_statement",
    ]);
  });
});
