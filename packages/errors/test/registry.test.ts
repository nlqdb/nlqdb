// GLOBAL-012 lint, executed: every code × representative params must render a
// one-sentence message and a non-empty action. This is the test that would have
// caught both 2026-08-17/18 incidents — `llm_failed` telling a user with a dead
// BYOLLM key to "try rephrasing", and a constraint violation claiming the
// database was unreachable.

import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  type ErrorCode,
  isErrorCode,
  isRetryable,
  renderError,
} from "../src/index.ts";

// One representative params object per code that declares params. Codes absent
// here render with no params (their generic-but-correct branch).
const REPRESENTATIVE: Partial<Record<ErrorCode, Record<string, unknown>[]>> = {
  llm_failed: [
    { reason: "auth_denied", lane: "byollm", provider: "openrouter", model: "luna" },
    { reason: "auth_denied", lane: "premium" },
    { reason: "rate_limited", lane: "free" },
    { reason: "parse", lane: "free" },
    { reason: "not_configured", lane: "byollm", provider: "openai" },
    { reason: "http_5xx", lane: "free" },
    { reason: "timeout", lane: "byollm", provider: "anthropic" },
  ],
  write_constraint: [
    { kind: "foreign_key", constraint: "orders_user_id_fkey", table: "orders" },
    { kind: "unique", constraint: "users_email_key", table: "users" },
    { kind: "not_null", table: "users" },
    { kind: "check", constraint: "positive_total", table: "orders" },
    { kind: "exclusion", table: "bookings" },
    {},
  ],
  invalid_value: [{ pgCode: "22003" }],
  write_no_rows: [
    { phase: "preview", verb: "update", table: "orders" },
    { phase: "commit", verb: "delete", table: "orders" },
    {},
  ],
  schema_mismatch: [
    { referencedTables: ["invoices"], schemaTables: ["users", "orders"] },
    { referencedTables: [], schemaTables: [] },
    {
      referencedTables: ["a", "b"],
      schemaTables: ["t1", "t2", "t3", "t4", "t5", "t6", "t7"],
    },
  ],
  sql_rejected: [{ reason: "delete_without_where" }, { reason: "parse_failed" }, {}],
  clarify_required: [
    {
      clarification: "destructive_ambiguous",
      reason: "Did you mean one of these?",
      options: [{ label: "Delete open orders", goal: "delete orders where status = 'open'" }],
    },
    { clarification: "create_or_query_pinned", pinned_db: { id: "db_1", slug: "sales" } },
  ],
  ambiguous_db: [{ candidate_dbs: [{ id: "db_1", slug: "sales" }] }, {}],
  low_confidence: [{ alternatives: ["revenue by month"] }, {}],
  rate_limited: [{ limit: 30, count: 31, resetAt: 1_800_000_000 }, {}],
  auth_required: [{ cap: "anon_device_cap" }, { cap: "anon_global_cap" }, {}],
  forbidden: [{ reason: "read_only_principal" }, {}],
  invalid_engine: [{ allowed: ["postgres", "clickhouse"] }],
  goal_too_long: [{ maxLength: 2000 }, {}],
  sql_too_long: [{ maxLength: 65536 }],
  invalid_body: [{ reason: "`kind` must be fact, episode, or entity." }],
  invalid_request: [{ message: "The connection URL must use HTTPS." }],
  introspection_failed: [{ message: "The host refused the connection." }],
  invalid_byollm_key: [{ message: "The key must start with sk-." }],
};

const cases = ERROR_CODES.flatMap((code) =>
  (REPRESENTATIVE[code] ?? [{}]).map((params, i) => ({ code, params, i })),
);

describe("registry copy", () => {
  it.each(cases)("$code[$i] renders one sentence + an action", ({ code, params }) => {
    const r = renderError(code, params);
    expect(r.code).toBe(code);
    expect(r.action.length).toBeGreaterThan(0);
    expect(r.message.length).toBeGreaterThan(0);
    // One sentence: ends in terminal punctuation and has no mid-string
    // sentence break. Em-dashes and parentheses are fine.
    expect(r.message).toMatch(/[.!?]$/);
    expect(r.message.slice(0, -1)).not.toMatch(/[.!?]\s/);
    expect(r.action).toMatch(/[.!?]$/);
    // GLOBAL-012 bans the non-answer.
    expect(r.message.toLowerCase()).not.toContain("something went wrong");
    expect(r.retryable).toBe(isRetryable(r.recoverability));
  });

  it("omits params entirely when nothing is known", () => {
    expect(renderError("db_unreachable")).not.toHaveProperty("params");
  });

  it("drops params the code never declared, and any unbounded string", () => {
    const r = renderError("llm_failed", {
      lane: "byollm",
      reason: "auth_denied",
      // A raw provider message must never cross the boundary.
      provider: "openrouter: 401 Unauthorized (key sk-or-v1-abc…)",
      secret: "sk-or-v1-abcdef",
    } as Record<string, unknown>);
    expect(JSON.stringify(r)).not.toContain("sk-or-v1");
    expect(JSON.stringify(r)).not.toContain("401");
    expect(r.params).toBeDefined();
    expect(r.params).not.toHaveProperty("secret");
  });

  it("never blames the goal for a rejected BYOLLM key (2026-08-17)", () => {
    const r = renderError("llm_failed", {
      reason: "auth_denied",
      lane: "byollm",
      provider: "openrouter",
      model: "luna",
    });
    expect(r.message).toContain("openrouter");
    expect(r.action).toContain("key");
    expect(r.retryable).toBe(false);
    expect(`${r.message} ${r.action}`.toLowerCase()).not.toContain("rephras");
  });

  it("does not tell a free-chain outage to rephrase (2026-08-17)", () => {
    const r = renderError("llm_failed", { reason: "http_5xx", lane: "free" });
    expect(`${r.message} ${r.action}`.toLowerCase()).not.toContain("rephras");
    expect(r.retryable).toBe(true);
  });

  it("treats a constraint violation as deterministic, not connectivity (2026-08-18)", () => {
    const r = renderError("write_constraint", { kind: "foreign_key", table: "orders" });
    expect(r.retryable).toBe(false);
    expect(r.httpStatus).toBe(409);
    expect(r.message.toLowerCase()).not.toContain("reach");
  });

  it("recognises its own codes and rejects strangers", () => {
    expect(isErrorCode("llm_failed")).toBe(true);
    expect(isErrorCode("made_up")).toBe(false);
  });
});
