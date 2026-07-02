// SK-TRUST-001 — diff builder unit tests. Pure AST/SQL coverage; the
// orchestrator wiring lives in `apps/api/test/orchestrate.test.ts`.

import { describe, expect, it, vi } from "vitest";
import { buildDiff, isWriteVerb } from "./diff.ts";

describe("isWriteVerb", () => {
  it("returns true for INSERT/UPDATE/DELETE (any case, with leading whitespace)", () => {
    expect(isWriteVerb("INSERT INTO orders VALUES (1)")).toBe(true);
    expect(isWriteVerb("  update users set x=1")).toBe(true);
    expect(isWriteVerb("DELETE FROM orders WHERE id=1")).toBe(true);
  });

  it("returns false for SELECT and other read verbs", () => {
    expect(isWriteVerb("SELECT 1")).toBe(false);
    expect(isWriteVerb("WITH x AS (SELECT 1) SELECT * FROM x")).toBe(false);
    expect(isWriteVerb("EXPLAIN SELECT 1")).toBe(false);
    expect(isWriteVerb("SHOW SEARCH_PATH")).toBe(false);
  });

  it("returns false for empty / garbage SQL", () => {
    expect(isWriteVerb("")).toBe(false);
    expect(isWriteVerb("   ")).toBe(false);
  });

  // Regression: a comment-prefixed write that `validateSql` accepts (it
  // strips comments before reading the verb) must NOT slip past the
  // SK-TRUST-001 preview gate as a "non-write". Before the fix,
  // `isWriteVerb` read the verb off the raw string and returned false
  // here, committing the write with no render-before-commit diff.
  it("sees through leading SQL comments (block + line), matching the validator", () => {
    expect(isWriteVerb("/* ensure fresh */ UPDATE users SET active = false")).toBe(true);
    expect(isWriteVerb("-- cleanup\nDELETE FROM orders WHERE id = 1")).toBe(true);
    expect(isWriteVerb("/* c */ INSERT INTO t VALUES (1)")).toBe(true);
    // Leading whitespace before the comment, and mixed line+block comments.
    expect(isWriteVerb("  \n /* c */ UPDATE t SET a = 1")).toBe(true);
    expect(isWriteVerb("-- a\n/* b */ DELETE FROM t WHERE id = 1")).toBe(true);
    // A commented read still reads as a non-write.
    expect(isWriteVerb("/* c */ SELECT 1")).toBe(false);
  });

  // Regression (write-CTE bypass): a data-modifying CTE has leading verb
  // `with`, so a leading-verb-only check reads it as a non-write and the
  // preview gate is skipped, committing silently. `isWriteVerb` now walks
  // the AST via `containsWriteVerb`.
  it("detects a data-modifying CTE (leading verb `with`)", () => {
    expect(
      isWriteVerb("WITH x AS (INSERT INTO t (id) VALUES (1) RETURNING id) SELECT * FROM x"),
    ).toBe(true);
    expect(
      isWriteVerb("WITH x AS (UPDATE t SET a = 1 WHERE id = 1 RETURNING id) SELECT * FROM x"),
    ).toBe(true);
    expect(isWriteVerb("WITH x AS (DELETE FROM t WHERE id = 1 RETURNING id) SELECT * FROM x")).toBe(
      true,
    );
  });
});

describe("buildDiff", () => {
  it("returns null for SELECT (read path bypasses the gate)", async () => {
    const exec = vi.fn(async () => 0);
    const diff = await buildDiff("SELECT * FROM orders WHERE id = 1", exec);
    expect(diff).toBeNull();
    expect(exec).not.toHaveBeenCalled();
  });

  it("UPDATE with WHERE: runs a SELECT COUNT(*) against the same table + WHERE", async () => {
    const exec = vi.fn(async (sql: string) => {
      // The orchestrator's exec wrapper hands us the count. Assert the
      // shape the builder produced (COUNT against `orders` with the
      // same WHERE) without pinning vendor-specific SQL formatting.
      expect(sql).toMatch(/COUNT\(\*\)/i);
      expect(sql).toMatch(/orders/i);
      expect(sql).toMatch(/WHERE/i);
      return 42;
    });
    const diff = await buildDiff("UPDATE orders SET status = 'paid' WHERE id = 1", exec);
    expect(diff).toEqual({
      verb: "UPDATE",
      table: "orders",
      affectedRows: 42,
      summary: "This will update 42 rows in orders.",
    });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("DELETE with WHERE: counts via SELECT COUNT(*) over the same WHERE", async () => {
    const exec = vi.fn(async (sql: string) => {
      expect(sql).toMatch(/COUNT\(\*\)/i);
      expect(sql).toMatch(/orders/i);
      expect(sql).toMatch(/WHERE/i);
      return 1;
    });
    const diff = await buildDiff("DELETE FROM orders WHERE id = 1", exec);
    expect(diff).toEqual({
      verb: "DELETE",
      table: "orders",
      affectedRows: 1,
      summary: "This will delete 1 row in orders.",
    });
  });

  it("previews an UPDATE hidden in a data-modifying CTE (SK-TRUST-001 gate)", async () => {
    const exec = vi.fn(async (sql: string) => {
      expect(sql).toMatch(/COUNT\(\*\)/i);
      expect(sql).toMatch(/orders/i);
      expect(sql).toMatch(/WHERE/i);
      return 3;
    });
    const diff = await buildDiff(
      "WITH x AS (UPDATE orders SET status = 'paid' WHERE id = 1 RETURNING id) SELECT * FROM x",
      exec,
    );
    expect(diff).toEqual({
      verb: "UPDATE",
      table: "orders",
      affectedRows: 3,
      summary: "This will update 3 rows in orders.",
    });
  });

  it("UPDATE without WHERE: counts all rows in the target table", async () => {
    let observedSql = "";
    const exec = vi.fn(async (sql: string) => {
      observedSql = sql;
      return 1234;
    });
    const diff = await buildDiff("UPDATE users SET active = TRUE", exec);
    expect(diff?.affectedRows).toBe(1234);
    expect(observedSql).toMatch(/COUNT\(\*\)/i);
    expect(observedSql).not.toMatch(/WHERE/i);
  });

  it("INSERT with VALUES tuples: counts tuples from the AST without an exec hop", async () => {
    const exec = vi.fn(async () => 0);
    const diff = await buildDiff(
      "INSERT INTO orders (id, total) VALUES (1, 10), (2, 20), (3, 30)",
      exec,
    );
    expect(diff).toEqual({
      verb: "INSERT",
      table: "orders",
      affectedRows: 3,
      summary: "This will insert 3 rows into orders.",
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it("INSERT … SELECT: counts inner SELECT via a derived COUNT(*) query", async () => {
    const exec = vi.fn(async (sql: string) => {
      expect(sql).toMatch(/COUNT\(\*\)/i);
      return 7;
    });
    const diff = await buildDiff("INSERT INTO archive SELECT * FROM orders WHERE old = 1", exec);
    expect(diff?.affectedRows).toBe(7);
    expect(diff?.verb).toBe("INSERT");
    expect(diff?.table).toBe("archive");
  });

  it("degrades gracefully when the count exec throws — affectedRows = 0", async () => {
    const exec = vi.fn(async () => {
      throw new Error("DB unreachable");
    });
    const diff = await buildDiff("DELETE FROM orders WHERE id = 1", exec);
    expect(diff).toEqual({
      verb: "DELETE",
      table: "orders",
      affectedRows: 0,
      summary: "This will delete 0 rows in orders.",
    });
  });

  it("returns null on unparseable SQL (orchestrator falls through to exec)", async () => {
    const diff = await buildDiff(
      ")) not valid sql ((",
      vi.fn(async () => 0),
    );
    expect(diff).toBeNull();
  });
});
