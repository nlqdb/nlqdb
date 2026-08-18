import { describe, expect, test } from "bun:test";

// SK-WEB-005 / SK-ERR-001 — the stranger-facing copy for a failed `/v1/ask`
// gates the first-10-queries success KPI (GLOBAL-025), and it now comes from the
// server's `@nlqdb/errors` registry rather than a table in this directory. So
// these tests do two things: prove the surface renders the wire copy faithfully
// (message AND action — dropping the action is what leaves a stranger stuck),
// and prove the registry still produces the specific lines this surface used to
// hard-code, including the regression it was written for: a >5-table
// schema_mismatch must name the withheld remainder, or a stranger reads the
// shown subset as the complete schema and abandons a valid query.

import { renderError } from "@nlqdb/errors";
import { type ApiErrorBody, type ApiErrorCode, NlqdbApiError } from "@nlqdb/sdk";
import { messageFor } from "./error-message.ts";

// Builds the error the SDK would throw for a real API response — the envelope is
// rendered by the same registry the server renders it with.
const apiError = (code: ApiErrorCode, params?: Record<string, unknown>): NlqdbApiError => {
  const { httpStatus, recoverability: _r, ...wire } = renderError(code as never, params);
  return new NlqdbApiError("x", httpStatus, code, "/v1/ask", wire as ApiErrorBody);
};

describe("messageFor", () => {
  test("non-API errors get the generic fallback", () => {
    expect(messageFor(new Error("boom"))).toBe("Something went wrong — try again.");
    expect(messageFor("nope")).toBe("Something went wrong — try again.");
  });

  test("renders the wire message AND its action", () => {
    const err = apiError("db_not_found");
    expect(messageFor(err)).toBe(`${err.body?.message} ${err.body?.action}`);
    expect(messageFor(err)).toContain("No database of yours matched that id.");
  });

  test("a response with no envelope still says something", () => {
    const bare = new NlqdbApiError("x", 502, "db_unreachable", "/v1/ask", null);
    expect(messageFor(bare)).toBe("Something went wrong — try again.");
  });

  test("client-owned failures keep their own copy (the server never sees them)", () => {
    expect(messageFor(new NlqdbApiError("x", 0, "aborted", "/v1/ask", null))).toBe("Cancelled.");
    expect(messageFor(new NlqdbApiError("x", 0, "network_error", "/v1/ask", null))).toBe(
      "Couldn't reach the API — check your connection.",
    );
  });

  describe("llm_failed is cause-specific (2026-08-17)", () => {
    test("a rejected BYOLLM key points at the key, never at the goal", () => {
      const msg = messageFor(
        apiError("llm_failed", {
          reason: "auth_denied",
          lane: "byollm",
          provider: "openrouter",
          model: "luna",
        }),
      );
      expect(msg).toContain("openrouter");
      expect(msg.toLowerCase()).not.toContain("rephras");
    });

    test("a free-chain outage says so, and says when to retry", () => {
      const msg = messageFor(apiError("llm_failed", { reason: "http_5xx", lane: "free" }));
      expect(msg).toContain("unavailable right now");
      expect(msg.toLowerCase()).not.toContain("rephras");
    });
  });

  test("a constraint violation is not blamed on the connection (2026-08-18)", () => {
    const msg = messageFor(apiError("write_constraint", { kind: "fk", table: "orders" }));
    expect(msg.toLowerCase()).not.toContain("reach");
    expect(msg).toContain("row that doesn't exist");
  });

  describe("sql_rejected (SK-ASK-026 — honest, reason-specific copy)", () => {
    test("a known reject reason keeps its specific line", () => {
      expect(messageFor(apiError("sql_rejected", { reason: "delete_without_where" }))).toContain(
        "delete every row",
      );
      expect(messageFor(apiError("sql_rejected", { reason: "multi_statement" }))).toContain(
        "several statements",
      );
    });

    test("an unknown reason falls back without inventing a cause", () => {
      expect(messageFor(apiError("sql_rejected", { reason: "brand_new_reason" }))).toContain(
        "That query was rejected.",
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
      expect(msg).toContain("no invoices table");
      expect(msg).toContain("orders, customers");
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
      expect(msg).toContain("a, b, c, d, e (+2 more)");
    });

    test("no overflow suffix when the list fits", () => {
      const msg = messageFor(
        apiError("schema_mismatch", {
          referencedTables: ["x", "y"],
          schemaTables: ["a", "b", "c", "d", "e"],
        }),
      );
      expect(msg).toContain("a, b, c, d, e.");
      expect(msg).not.toContain("more)");
    });

    test("exec-catch backstop (empty arrays) still offers a way forward", () => {
      const msg = messageFor(
        apiError("schema_mismatch", { referencedTables: [], schemaTables: [] }),
      );
      expect(msg).toContain("doesn't have");
      expect(msg).toContain("create a new database");
    });
  });
});
