// SQL allow-list / reject-list tests. Asserts the contract the LLM
// router is held to (docs/architecture.md §0.1, §12; PERFORMANCE §4 row 6
// `nlqdb.sql.validate`). Each rejected case carries a tagged reason
// so dashboards / debugging can attribute regressions to a specific
// rule.

import { describe, expect, it } from "vitest";
import { validateSql } from "../src/ask/sql-validate.ts";

describe("validateSql", () => {
  describe("rejects", () => {
    it.each([
      ["DROP TABLE users", "drop_statement"],
      ["drop table  users  cascade", "drop_statement"],
      ["DROP INDEX idx_foo", "drop_statement"],
      ["DROP SCHEMA public CASCADE", "drop_statement"],
      ["DROP MATERIALIZED VIEW foo", "drop_statement"],
      ["TRUNCATE orders", "truncate_statement"],
      ["DELETE FROM orders", "delete_without_where"],
      ["delete from orders;", "delete_without_where"],
      ["ALTER TABLE orders DROP COLUMN total", "alter_statement"],
      ["GRANT SELECT ON users TO public", "grant_or_revoke"],
      ["REVOKE ALL ON users FROM public", "grant_or_revoke"],
      ["VACUUM users", "disallowed_verb"],
      ["CREATE TABLE foo (id int)", "disallowed_verb"],
      // Multi-statement (SK-SQLAL-009): a benign lead can't smuggle a second.
      ["SELECT 1; SELECT 2", "multi_statement"],
      ["SELECT 1; DELETE FROM x WHERE id = 1", "multi_statement"],
      ["", "empty"],
    ])("rejects %j with reason %s", (sql, reason) => {
      const result = validateSql(sql);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe(reason);
    });
  });

  // Side-effecting functions (SK-SQLAL-008): pg_sleep is a
  // connection-pinning DoS callable by any role; dblink / lo_* /
  // pg_read_file are server-side IO. Rejected anywhere in the tree.
  describe("rejects side-effecting functions", () => {
    it.each([
      ["SELECT pg_sleep(10)", "disallowed_function"],
      ["select PG_SLEEP(5)", "disallowed_function"],
      ["SELECT * FROM users WHERE pg_sleep(5) IS NULL", "disallowed_function"],
      ["WITH x AS (SELECT pg_sleep(3)) SELECT 1", "disallowed_function"],
      ["SELECT pg_read_file('/etc/passwd')", "disallowed_function"],
      ["SELECT dblink('host=evil', 'select 1')", "disallowed_function"],
      ["SELECT lo_import('/etc/passwd')", "disallowed_function"],
    ])("rejects %j with reason %s", (sql, reason) => {
      const result = validateSql(sql);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe(reason);
    });
  });

  describe("accepts", () => {
    it.each([
      "SELECT * FROM users",
      "select id, name from users where id = 1",
      "INSERT INTO users (name) VALUES ('alice')",
      "UPDATE users SET name = 'bob' WHERE id = 1",
      "DELETE FROM users WHERE id = 42",
      "WITH recent AS (SELECT * FROM events) SELECT * FROM recent",
      "EXPLAIN SELECT * FROM users",
      "EXPLAIN VERBOSE SELECT * FROM users",
      "SHOW search_path",
      // Legit functions that share the function-call AST shape must pass.
      "SELECT count(*) FROM users",
      "SELECT max(total) FROM orders",
      "SELECT now()",
    ])("accepts %j", (sql) => {
      expect(validateSql(sql)).toEqual({ ok: true });
    });
  });

  // Comment / paren / inline-comment cases that earlier tripped a
  // naive `split(/\s+/)` leading-token gate. Each of these should
  // resolve to a real verb token, not the comment / paren artifact.
  describe("leading-token gate (paren/comment edge cases)", () => {
    it.each([
      ["EXPLAIN(ANALYZE) DELETE FROM users", false],
      ["EXPLAIN (ANALYZE) UPDATE users SET name = 'x'", false],
      ["EXPLAIN ANALYZE DELETE FROM users", false],
      ["EXPLAIN (ANALYZE, VERBOSE) SELECT * FROM users", false],
      // Comment-smuggle: a comment between EXPLAIN and ANALYZE is
      // whitespace to Postgres, so the wrapped DML still runs. The gate
      // must be comment-blind — these must reject, not silently allow.
      ["EXPLAIN /*c*/ ANALYZE DELETE FROM users", false],
      ["EXPLAIN --c\n ANALYZE DELETE FROM users", false],
      ["EXPLAIN /*c*/ (ANALYZE) UPDATE users SET name = 'x'", false],
      ["EXPLAIN/*c*/ANALYZE INSERT INTO users VALUES (1)", false],
      // Postgres block comments nest (docs §4.1.5), so a non-greedy
      // regex would leave a dangling `*/` and miss these — the gate
      // collapses comments with a depth counter, so they must reject.
      ["EXPLAIN /* /* */ */ ANALYZE DELETE FROM users", false],
      ["EXPLAIN /*/**/*/ ANALYZE DELETE FROM users", false],
      ["EXPLAIN (/* /* */ */ ANALYZE) DELETE FROM users", false],
      // A comment that is NOT wedging ANALYZE must still pass.
      ["EXPLAIN /*c*/ SELECT * FROM users", true],
      ["EXPLAIN /* analyze the plan */ SELECT * FROM users", true],
      ["--c\nSELECT 1", true],
      ["/* leading */ SELECT 1", true],
      ["WITH/*c*/x AS (SELECT 1) SELECT * FROM x", true],
      ["(SELECT 1)", true],
      ["DROP/*c*/TABLE users", false],
    ])("%j → ok=%s", (sql, expected) => {
      expect(validateSql(sql).ok).toBe(expected);
    });

    it("EXPLAIN ANALYZE rejects with disallowed_verb (not silent allow)", () => {
      const result = validateSql("EXPLAIN ANALYZE DELETE FROM users");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("disallowed_verb");
    });
  });

  // Layered defense: leading-verb regex catches position-0 DDL, AST
  // walk catches anything embedded in subqueries / CTEs that the regex
  // would otherwise wave through.
  describe("rejects nested destructive verbs (AST walk)", () => {
    it("rejects DROP nested in a subquery (parser fails → parse_failed)", () => {
      // PG grammar: `(DROP TABLE foo)` isn't a legal subquery, so the
      // parser bails. Pinning to `parse_failed` so a future relaxation
      // of grammar rules surfaces here, not silently.
      const result = validateSql("SELECT * FROM (DROP TABLE foo) AS x");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("parse_failed");
    });

    it("rejects DROP embedded in a parseable WITH-style payload (AST walk)", () => {
      // Constructing a payload the parser actually accepts as well-
      // formed but contains an embedded destructive node is grammar-
      // dependent — `WITH x AS (DELETE FROM foo) SELECT 1` is the
      // canonical PG-grammar shape that node-sql-parser does parse,
      // and it also exercises the DELETE-without-WHERE path.
      const result = validateSql("WITH x AS (DELETE FROM foo) SELECT 1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Either the embedded-walk catches DELETE-shape (delete_without_where)
        // or parse refuses the construct (parse_failed). Both are
        // acceptable rejects; what we pin is "not allowed through".
        expect(["delete_without_where", "parse_failed", "drop_statement"]).toContain(result.reason);
      }
    });

    it("rejects unparseable SQL outright (no fall-through to allow)", () => {
      const result = validateSql("SELECT $$$ malformed");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("parse_failed");
    });
  });
});
