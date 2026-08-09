// Grant-scope validation-layer kill-tests (EK-06 box 2, SK-EKP-008
// guardrail #1). Asserts the join-leakage defense: a granted read may
// touch only the tables the grant's scope enumerates, and a grant
// confers no write. The DB-role guardrails (non-owner SELECT-only role,
// FORCE RLS) are layers 2–3 and land with the executor wiring — the
// RLS-bypass kill-test lives there; the join-leakage and validation-layer
// GUC-spoof rejects live here.

import { describe, expect, it } from "vitest";
import { type GrantScopeResult, validateGrantScope } from "./grant-scope.ts";

const SCOPE = ["lessons", "students"];

// Assert a reject and return its reason (narrows the union for TS).
function reason(res: GrantScopeResult): string {
  expect(res.ok).toBe(false);
  return res.ok ? "" : res.reason;
}

describe("validateGrantScope — in-scope reads pass", () => {
  it("a plain SELECT on a granted table", () => {
    expect(validateGrantScope("SELECT * FROM lessons", SCOPE)).toEqual({
      ok: true,
      tables: ["lessons"],
    });
  });

  it("a JOIN across two granted tables", () => {
    const res = validateGrantScope(
      "SELECT l.id FROM lessons l JOIN students s ON s.id = l.student_id",
      SCOPE,
    );
    expect(res.ok).toBe(true);
  });

  it("case-insensitive: an unquoted mixed-case ref matches a lower-case scope", () => {
    expect(validateGrantScope("SELECT * FROM Lessons", SCOPE).ok).toBe(true);
  });

  it("a CTE aliasing a granted table is not itself treated as a table", () => {
    const res = validateGrantScope(
      "WITH recent AS (SELECT * FROM lessons) SELECT * FROM recent",
      SCOPE,
    );
    expect(res.ok).toBe(true);
    expect(res.ok && res.tables).toEqual(["lessons"]);
  });
});

describe("validateGrantScope — join-leakage is rejected", () => {
  it("a JOIN to a non-granted table", () => {
    expect(
      validateGrantScope(
        "SELECT * FROM lessons l JOIN billing b ON b.student_id = l.student_id",
        SCOPE,
      ),
    ).toEqual({ ok: false, reason: "out_of_scope", detail: "billing" });
  });

  it("a subquery reaching a non-granted table", () => {
    expect(
      validateGrantScope(
        "SELECT * FROM lessons WHERE student_id IN (SELECT id FROM billing)",
        SCOPE,
      ),
    ).toEqual({ ok: false, reason: "out_of_scope", detail: "billing" });
  });

  it("a CTE body reading a non-granted table (the alias hides nothing)", () => {
    expect(validateGrantScope("WITH x AS (SELECT * FROM billing) SELECT * FROM x", SCOPE)).toEqual({
      ok: false,
      reason: "out_of_scope",
      detail: "billing",
    });
  });

  it("a UNION arm reading a non-granted table", () => {
    const res = validateGrantScope("SELECT id FROM lessons UNION SELECT id FROM billing", SCOPE);
    expect(res).toEqual({ ok: false, reason: "out_of_scope", detail: "billing" });
  });
});

describe("validateGrantScope — schema widening never widens a grant", () => {
  it("a table that exists in the DB but is not in scope is rejected", () => {
    // `pricing` is a real owner table, deliberately left out of the grant.
    expect(validateGrantScope("SELECT * FROM pricing", SCOPE)).toEqual({
      ok: false,
      reason: "out_of_scope",
      detail: "pricing",
    });
  });

  it("an empty scope rejects every table (fail-closed)", () => {
    expect(validateGrantScope("SELECT * FROM lessons", []).ok).toBe(false);
  });
});

describe("validateGrantScope — a grant is read-only", () => {
  it("rejects a write on a granted table", () => {
    expect(validateGrantScope("UPDATE lessons SET title = 'x' WHERE id = 1", SCOPE)).toEqual({
      ok: false,
      reason: "not_read_only",
    });
  });

  it("rejects an INSERT into a granted table", () => {
    expect(reason(validateGrantScope("INSERT INTO lessons (title) VALUES ('x')", SCOPE))).toBe(
      "not_read_only",
    );
  });

  it("rejects a data-modifying CTE that returns rows", () => {
    expect(
      reason(
        validateGrantScope(
          "WITH d AS (DELETE FROM lessons WHERE id = 1 RETURNING *) SELECT * FROM d",
          SCOPE,
        ),
      ),
    ).toBe("not_read_only");
  });

  it("rejects SHOW / EXPLAIN — not a granted-row read", () => {
    expect(reason(validateGrantScope("EXPLAIN SELECT * FROM lessons", SCOPE))).toBe(
      "not_read_only",
    );
    expect(reason(validateGrantScope("SHOW search_path", SCOPE))).toBe("not_read_only");
  });
});

describe("validateGrantScope — inherits the base allowlist (fail-closed)", () => {
  it("rejects DDL", () => {
    expect(reason(validateGrantScope("DROP TABLE lessons", SCOPE))).toBe("not_allowed");
  });

  it("rejects a multi-statement smuggle", () => {
    expect(reason(validateGrantScope("SELECT 1; SELECT * FROM billing", SCOPE))).toBe(
      "not_allowed",
    );
  });

  it("rejects an unparseable query (never fails open to an empty table set)", () => {
    expect(reason(validateGrantScope("SELECT FROM WHERE", SCOPE))).toBe("not_allowed");
  });

  it("rejects a GUC-spoof via set_config inside the query", () => {
    // The validation-layer half of box 2's GUC-spoofing kill-test:
    // set_config/current_setting are in the base allowlist's disallowed
    // functions, so a query trying to re-arm `app.tenant_id` from inside
    // a CTE is refused before it can reach execution.
    expect(
      reason(
        validateGrantScope(
          "WITH x AS (SELECT set_config('app.tenant_id', 'victim', true)) SELECT * FROM lessons",
          SCOPE,
        ),
      ),
    ).toBe("not_allowed");
  });

  it("rejects a connection-pinning function", () => {
    expect(reason(validateGrantScope("SELECT pg_sleep(60) FROM lessons", SCOPE))).toBe(
      "not_allowed",
    );
  });
});
