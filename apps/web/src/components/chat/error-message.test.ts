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
});
