import { describe, expect, test } from "bun:test";

// SK-WEB-005 — the stranger-facing copy for a failed `/v1/ask`. The mapping
// gates the first-10-queries success KPI (GLOBAL-025): a stranger's recovery
// hinges on the exact words. The regression this guards: schema_mismatch used
// to slice the available-table list to 5 with no overflow indicator, so a
// stranger with a >5-table DB read the shown subset as the complete schema and
// abandoned a valid query (or needlessly recreated the DB).

import { type ApiErrorBody, type ApiErrorCode, NlqdbApiError } from "@nlqdb/sdk";
import { messageFor } from "./error-message.ts";

// `body` is read loosely by the mapping (it reaches for referencedTables /
// schemaTables, which ride alongside the typed ApiErrorBody), so tests pass
// plain objects cast through the field-agnostic body type.
const apiError = (code: ApiErrorCode, body: unknown = null): NlqdbApiError =>
  new NlqdbApiError("x", 409, code, "/v1/ask", body as ApiErrorBody | null);

describe("messageFor", () => {
  test("non-API errors get the generic fallback", () => {
    expect(messageFor(new Error("boom"))).toBe("Something went wrong — try again.");
    expect(messageFor("nope")).toBe("Something went wrong — try again.");
  });

  test("known codes map to their recovery copy", () => {
    expect(messageFor(apiError("rate_limited"))).toBe("Slow down — try again in a moment.");
    expect(messageFor(apiError("llm_failed"))).toBe("Couldn't generate a plan — try rephrasing.");
    expect(messageFor(apiError("db_not_found"))).toBe(
      "That database isn't available — try a different one.",
    );
  });

  describe("sql_rejected (SK-ASK-026 — honest, reason-specific copy)", () => {
    test("maps a known reject reason to its specific line", () => {
      expect(messageFor(apiError("sql_rejected", { reason: "delete_without_where" }))).toBe(
        "That would delete every row — add a filter, or say which rows to remove.",
      );
      expect(messageFor(apiError("sql_rejected", { reason: "multi_statement" }))).toBe(
        "Ask one thing at a time — that came through as multiple statements.",
      );
    });

    test("falls back to the generic line for an unknown or missing reason", () => {
      expect(messageFor(apiError("sql_rejected", { reason: "brand_new_reason" }))).toBe(
        "That query was rejected — try rephrasing.",
      );
      expect(messageFor(apiError("sql_rejected", null))).toBe(
        "That query was rejected — try rephrasing.",
      );
    });
  });

  describe("schema_mismatch", () => {
    test("names the missing table and the available ones", () => {
      const msg = messageFor(
        apiError("schema_mismatch", {
          referencedTables: ["invoices"],
          schemaTables: ["orders", "customers"],
        }),
      );
      expect(msg).toBe("No such table: invoices. This database has: orders, customers.");
    });

    test("indicates the remainder when the available list is capped (the regression)", () => {
      const msg = messageFor(
        apiError("schema_mismatch", {
          referencedTables: ["invoices"],
          // 7 tables — the one the stranger meant may be beyond the shown 5.
          schemaTables: ["a", "b", "c", "d", "e", "f", "g"],
        }),
      );
      // Shows the first 5, then honestly names the 2 it withheld — never
      // presents the subset as the complete schema.
      expect(msg).toBe("No such table: invoices. This database has: a, b, c, d, e (+2 more).");
    });

    test("no overflow suffix when the list fits", () => {
      const msg = messageFor(
        apiError("schema_mismatch", {
          referencedTables: ["x", "y"],
          schemaTables: ["a", "b", "c", "d", "e"],
        }),
      );
      expect(msg).toBe("No such tables: x, y. This database has: a, b, c, d, e.");
    });

    test("exec-catch backstop (empty arrays) falls through to the generic line", () => {
      const msg = messageFor(
        apiError("schema_mismatch", { referencedTables: [], schemaTables: [] }),
      );
      expect(msg).toBe(
        "That query references a table this database doesn't have — try rephrasing or creating a new database.",
      );
    });

    test("missing named but no schema list still helps the user rephrase", () => {
      const msg = messageFor(
        apiError("schema_mismatch", { referencedTables: ["ghost"], schemaTables: [] }),
      );
      expect(msg).toBe(
        "This database has no ghost table — try rephrasing or creating a new database.",
      );
    });
  });
  // SK-TRUST-006 / SK-ASK-029 — the founder-reported moment: approve a write,
  // then read empty-read copy ("No rows returned.") or a transient-sounding
  // "Couldn't reach the database" for a deterministic constraint failure.
  describe("write outcomes never read as an empty result or a transient blip", () => {
    test("write_no_rows preview: says nothing was written and what to specify", () => {
      expect(
        messageFor(apiError("write_no_rows", { phase: "preview", verb: "INSERT", table: "ideas" })),
      ).toBe("Nothing to write in ideas — no rows matched, so say which row you mean.");
    });

    test("write_no_rows commit: distinguishes 'ran and changed nothing'", () => {
      expect(
        messageFor(apiError("write_no_rows", { phase: "commit", verb: "DELETE", table: "orders" })),
      ).toBe(
        "Nothing was changed in orders — that ran but matched no rows, so say which row to write.",
      );
    });

    test("write_no_rows without a named table still reads honestly", () => {
      expect(messageFor(apiError("write_no_rows", { phase: "preview" }))).toBe(
        "Nothing to write — no rows matched, so say which row you mean.",
      );
    });

    test("write_constraint foreign_key names the column that has to point somewhere real", () => {
      expect(
        messageFor(
          apiError("write_constraint", { kind: "foreign_key", table: "ideas", column: "user_id" }),
        ),
      ).toBe(
        "Nothing was written — ideas.user_id has to point at a row that already exists, so name an existing one.",
      );
    });

    test("write_constraint not_null / unique / unknown kinds each get a next action", () => {
      expect(
        messageFor(
          apiError("write_constraint", { kind: "not_null", table: "ideas", column: "title" }),
        ),
      ).toBe("Nothing was written — ideas.title can't be empty, so include it in your request.");
      expect(messageFor(apiError("write_constraint", { kind: "unique", column: "email" }))).toBe(
        "Nothing was written — email already exists, so use a different one.",
      );
      expect(messageFor(apiError("write_constraint", { kind: "check" }))).toBe(
        "Nothing was written — the database rejected those values; try different ones.",
      );
    });

    test("an unpreviewable write says it was not run", () => {
      expect(messageFor(apiError("sql_rejected", { reason: "preview_unavailable" }))).toBe(
        "I couldn't preview that change, so I didn't run it — try rephrasing.",
      );
    });
  });
});
