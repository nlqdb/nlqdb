// SQL allow-list / reject-list tests. Asserts the contract the LLM
// router is held to (DESIGN §0.1, §12; PERFORMANCE §4 row 6
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
      ["ALTER TABLE orders DROP COLUMN total", "drop_statement"],
      ["GRANT SELECT ON users TO public", "grant_or_revoke"],
      ["REVOKE ALL ON users FROM public", "grant_or_revoke"],
      ["VACUUM users", "disallowed_verb"],
      ["CREATE TABLE foo (id int)", "disallowed_verb"],
      ["", "empty"],
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
      "SHOW search_path",
    ])("accepts %j", (sql) => {
      expect(validateSql(sql)).toEqual({ ok: true });
    });
  });
});
