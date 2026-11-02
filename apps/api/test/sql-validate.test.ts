// SQL allow-list / reject-list tests. Asserts the contract the LLM
// router is held to (docs/architecture.md §0.1, §12; PERFORMANCE §4 row 6
// `nlqdb.sql.validate`). Each rejected case carries a tagged reason
// so dashboards / debugging can attribute regressions to a specific
// rule.

import { describe, expect, it } from "vitest";
import { containsWriteVerb, validateSql } from "../src/ask/sql-validate.ts";
import { disagreement, validateSqlPg } from "../src/ask/sql-validate-pg.ts";

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
      // UPDATE-without-WHERE — symmetric with DELETE (mass mutation).
      ["UPDATE orders SET paid = true", "update_without_where"],
      ["update orders set paid = true;", "update_without_where"],
      ["ALTER TABLE orders DROP COLUMN total", "alter_statement"],
      ["GRANT SELECT ON users TO public", "grant_or_revoke"],
      ["REVOKE ALL ON users FROM public", "grant_or_revoke"],
      ["VACUUM users", "disallowed_verb"],
      ["CREATE TABLE foo (id int)", "disallowed_verb"],
      // SELECT INTO creates a table — DDL that parses as `type:"select"`.
      ["SELECT * INTO new_users FROM users", "disallowed_verb"],
      ["WITH x AS (SELECT 1) SELECT * INTO t FROM x", "disallowed_verb"],
      ["INSERT INTO t SELECT * INTO t3 FROM u", "disallowed_verb"],
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
      // RLS-tenancy GUC primitives — defense-in-depth so a CTE can't
      // re-arm `app.tenant_id` from inside a validated query (the exec
      // wrapper sets it OUTSIDE the user SQL).
      ["SELECT set_config('app.tenant_id', 'other', false)", "disallowed_function"],
      ["SELECT current_setting('app.tenant_id')", "disallowed_function"],
      [
        "WITH x AS (SELECT set_config('app.tenant_id', 'other', true)) SELECT * FROM users",
        "disallowed_function",
      ],
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
      // Upserts: the `DO UPDATE SET` action is `type:"update"` with no
      // WHERE, but it is scoped to the conflicting row — not a mass update.
      "INSERT INTO users (id, name) VALUES (1, 'a') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
      "INSERT INTO users (id) VALUES (1) ON CONFLICT DO NOTHING",
      "EXPLAIN SELECT * FROM users",
      "EXPLAIN VERBOSE SELECT * FROM users",
      "SHOW search_path",
      // Legit functions that share the function-call AST shape must pass.
      "SELECT count(*) FROM users",
      "SELECT max(total) FROM orders",
      "SELECT now()",
      // Quoted reserved-word names a widen admitted from the app's write.
      'SELECT "row", "order" FROM "user" WHERE "group" = 1',
      'INSERT INTO "user" ("order", "row") VALUES (\'a\', \'b\')',
    ])("accepts %j", (sql) => {
      expect(validateSql(sql)).toEqual({ ok: true });
    });
  });

  // SK-SQLAL-009 on the SHOW / EXPLAIN short-circuit: a second statement
  // could `RESET ROLE` back to the RLS-bypassing owner.
  describe("SHOW / EXPLAIN carry exactly one statement", () => {
    it.each([
      "SHOW search_path; RESET ROLE; SELECT * FROM other_schema.t",
      "EXPLAIN SELECT 1; RESET ROLE",
      "SHOW x;SELECT 1",
      "SHOW x; /* c */ SELECT 1",
      "SHOW x; -- c\nSELECT 1",
      "EXPLAIN SELECT 'a'; SELECT 1",
      "EXPLAIN SELECT E'\\''; RESET ROLE",
      "EXPLAIN SELECT $$x$$; RESET ROLE",
      "EXPLAIN SELECT $t$ ; $t$; RESET ROLE",
      'EXPLAIN SELECT "a;b"; RESET ROLE',
      "SHOW x; ;",
      // Unterminated quoting or comment fails closed.
      "EXPLAIN SELECT 'a",
      "EXPLAIN SELECT $$a",
      "SHOW x /* open",
      // Postgres's lexer, not JS's: `--` ends at \r too, any non-ASCII
      // char continues an identifier (`é$$` is not a dollar-quote, `éE'`
      // not an E-string), NBSP is not whitespace. The first two read
      // `other.t` on a real Postgres 16 with the earlier lexer.
      "SHOW x --\r; RESET ROLE; SELECT * FROM other.t",
      "EXPLAIN SELECT 1 AS é$$; RESET ROLE; SELECT * FROM other.t; --$$",
      "SHOW x;\u00a0RESET ROLE",
      // A quote or dollar-quote right after a number or `$n` fails closed.
      "EXPLAIN SELECT 1$$; RESET ROLE; $$",
      "EXPLAIN SELECT 1E'\\'; RESET ROLE --'",
    ])("rejects %j", (sql) => {
      expect(validateSql(sql)).toEqual({ ok: false, reason: "multi_statement" });
    });

    it.each([
      "SHOW search_path;",
      "SHOW search_path ; -- trailing",
      "SHOW x; /* a /* nested */ b */",
      "EXPLAIN SELECT 'a;b' FROM t",
      "EXPLAIN SELECT 'it''s; fine'",
      "EXPLAIN SELECT E'\\\\'",
      "EXPLAIN SELECT $$ ; $$",
      "EXPLAIN SELECT $tag$ a;b $tag$",
      'EXPLAIN SELECT "x;y" FROM t',
      "EXPLAIN SELECT * FROM t WHERE id = $1",
      "EXPLAIN SELECT 1 /* ; */",
      "EXPLAIN SELECT 1 AS a$$b",
      "SHOW x; -- c\r\n",
      "EXPLAIN SELECT \"a\"E'\\\\' ;",
    ])("accepts %j", (sql) => {
      expect(validateSql(sql)).toEqual({ ok: true });
    });
  });

  // Postgres's statement split governs every statement, not node-sql-parser's:
  // a backslash before a quote in a standard '…' string ends the string for
  // Postgres but reads as an escape to node-sql-parser, which then saw one
  // SELECT where Postgres ran three (reported 2026-11-01; read another
  // tenant's schema over the simple protocol on Postgres 16).
  it.each([
    `SELECT 'a\\'; RESET ROLE; SELECT secret FROM "db_other_xxxxxx".orders -- '`,
    "SELECT 'a\\'; DELETE FROM t WHERE true -- '",
    "WITH x AS (SELECT 'a\\') SELECT 1; RESET ROLE -- '",
    // One statement to Postgres, but the walk would miss the call.
    "SELECT 'a\\', pg_sleep(1) -- '",
    "SELECT 'it\\''s', pg_sleep(1) -- '",
  ])("rejects a statement node-sql-parser lexes differently %j", (sql) => {
    expect(validateSql(sql).ok).toBe(false);
    expect(containsWriteVerb(sql)).toBe(false); // so the validator is the gate
  });

  it.each([
    `SELECT 'a\\'; RESET ROLE; SELECT 1 -- '`,
    "SELECT 'a\\', pg_sleep(1) -- '",
    "SELECT 'C:\\'",
    "EXPLAIN SELECT 1 AS éE'\\'; RESET ROLE; SELECT 1 --'",
  ])("names the backslash before a quote, not a second statement %j", (sql) => {
    expect(validateSql(sql)).toEqual({ ok: false, reason: "backslash_quote" });
  });

  it.each([
    "SELECT * FROM t WHERE name LIKE '50\\%'",
    "SELECT E'it\\'s'",
    "SELECT 'it''s'",
    "SELECT 1;",
  ])("accepts %j", (sql) => {
    expect(validateSql(sql).ok).toBe(true);
  });

  // A leading comment Postgres ends sooner than a naive strip (`--` at
  // \r, a nested `/* */`) must not hide the statement Postgres runs.
  it.each([
    "--\rRESET ROLE;\nSHOW x",
    "/* /* */ SHOW x '*/ RESET ROLE; SELECT * FROM other.t; --'",
    "/* /* */ SELECT '*/ DROP TABLE t; --'",
  ])("rejects a statement hidden past a leading comment %j", (sql) => {
    expect(validateSql(sql).ok).toBe(false);
  });

  it.each([
    "SET ROLE neondb_owner",
    "RESET ROLE",
    "SET LOCAL ROLE x",
    "RESET ALL",
    "SET app.tenant_id = 'x'",
  ])("rejects role / GUC re-arming %j", (sql) => {
    expect(validateSql(sql).ok).toBe(false);
  });

  // SK-SDK-015 — `/v1/run` checks the bound params against this count.
  describe("maxParam", () => {
    it("reports the highest $n, ignoring a $n inside a string literal", () => {
      expect(validateSql("UPDATE t SET a = $3 WHERE id = $1 AND b = '$9'")).toEqual({
        ok: true,
        maxParam: 3,
      });
    });

    it("is absent when the statement has no placeholder", () => {
      expect(validateSql("SELECT 1")).toEqual({ ok: true });
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
      // Postgres accepts the British spelling `ANALYSE` as a keyword
      // synonym (gram.y `analyze_keyword: ANALYZE | ANALYSE`), so it
      // executes the wrapped DML just like `ANALYZE` — the gate must
      // reject both spellings, incl. comment-wedged and paren forms.
      ["EXPLAIN ANALYSE DELETE FROM users", false],
      ["EXPLAIN (ANALYSE) UPDATE users SET name = 'x'", false],
      ["EXPLAIN /*c*/ ANALYSE DELETE FROM users", false],
      // `--` ends at \r; a quoted option name can spell ANALYZE.
      ["EXPLAIN --c\r ANALYZE DELETE FROM users", false],
      ['EXPLAIN (U&"\\0061nalyze") DELETE FROM users', false],
      ['EXPLAIN ("analyze") DELETE FROM users', false],
      ["EXPLAIN (FORMAT JSON) SELECT * FROM users", true],
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

// Embedded-write detector shared by the /v1/run read-only gate and the
// /v1/ask render-before-commit gate. A leading-verb-only check false-
// negatives on a data-modifying CTE (`WITH … (INSERT …) SELECT …`), so
// this must catch writes at any nesting.
describe("containsWriteVerb", () => {
  it.each([
    "INSERT INTO users (name) VALUES ('a')",
    "UPDATE users SET name = 'b' WHERE id = 1",
    "DELETE FROM users WHERE id = 1",
    "/* c */ INSERT INTO users (name) VALUES ('a')",
    "WITH x AS (INSERT INTO users (id) VALUES (1) RETURNING id) SELECT * FROM x",
    "WITH x AS (UPDATE users SET name='b' WHERE id=1 RETURNING id) SELECT * FROM x",
    "WITH x AS (DELETE FROM users WHERE id=1 RETURNING id) SELECT * FROM x",
  ])("detects a write in %j", (sql) => {
    expect(containsWriteVerb(sql)).toBe(true);
  });

  it.each([
    "SELECT * FROM users",
    "WITH x AS (SELECT id FROM users) SELECT * FROM x",
    "EXPLAIN SELECT * FROM users",
    "SHOW search_path",
    "",
  ])("returns false for the read %j", (sql) => {
    expect(containsWriteVerb(sql)).toBe(false);
  });
});

// Postgres's own parser (libpg_query) must agree with `validateSql` on the
// facts the gates act on (SK-SQLAL-009): one statement, its kind, whether it
// writes, and no denylisted call — so a reading node-sql-parser gets wrong
// fails closed instead of reaching Postgres.
describe("validateSqlPg", () => {
  it.each([
    ["SELECT 'a\\'; RESET ROLE; SELECT secret FROM other.orders -- '", "backslash_quote"],
    ["SELECT 'a\\', pg_sleep(1) -- '", "backslash_quote"],
    ["SELECT pg_catalog.pg_sleep(1)", "disallowed_function"],
    ["SELECT * INTO newt FROM t", "disallowed_verb"],
    ["WITH d AS (UPDATE t SET a = 1 RETURNING *) SELECT * FROM d", "update_without_where"],
    ["EXPLAIN (ANALYZE) DELETE FROM t WHERE true", "disallowed_verb"],
  ])("rejects %j", async (sql, reason) => {
    expect(await validateSqlPg(sql)).toMatchObject({ ok: false, reason });
  });

  // Field notation calls a function too (Postgres 16 runs both); node-sql-parser
  // can't parse it today, so this pins the walk for the day it can.
  it.each([
    "SELECT ('search_path'::text).current_setting",
    "SELECT (x).pg_sleep FROM (SELECT 1::float8 AS x) s",
  ])("names a field-notation call %j disallowed_function", async (sql) => {
    expect(await disagreement(sql)).toBe("disallowed_function");
  });

  it.each([
    "SELECT DISTINCT ON (user_id) * FROM posts ORDER BY user_id, created_at DESC",
    "SELECT count(*) FILTER (WHERE status = 'paid'), date_trunc('day', created_at)::date FROM orders GROUP BY 2",
    "SELECT data->>'name' FROM events WHERE data @> '{\"a\":1}'::jsonb AND name ILIKE '%x%'",
    "INSERT INTO t (a) VALUES ($1) ON CONFLICT (a) DO UPDATE SET a = EXCLUDED.a RETURNING *",
    "UPDATE t SET a = 1 WHERE id = $1 RETURNING id",
    "WITH d AS (DELETE FROM t WHERE id = 1 RETURNING *) SELECT * FROM d",
    "EXPLAIN SELECT * FROM t",
    "SHOW search_path",
    "SELECT E'it\\'s'",
  ])("accepts %j", async (sql) => {
    expect((await validateSqlPg(sql)).ok).toBe(true);
  });
});
