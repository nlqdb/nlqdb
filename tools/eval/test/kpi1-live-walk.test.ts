import { describe, expect, it } from "bun:test";

import {
  classifyExtendPreview,
  missDetail,
  resolveTarget,
  WALK_SHAPES,
} from "../src/kpi1-live-walk.ts";

describe("classifyExtendPreview", () => {
  it("HIT — a preview that routed into widen-on-write names the unseen table", () => {
    // SK-SCHEMA-010 / SK-TRUST-002: the no-flag write preview returns AskOk
    // with requires_confirm + trace.widen.tables (ddl empty on the preview hop).
    const body = {
      status: "ok",
      rows: [],
      rowCount: 0,
      requires_confirm: true,
      trace: {
        sql: "",
        plan_id: "p1",
        confidence: 1,
        model: "m",
        cache_hit: false,
        widen: { tables: ["ratings"], ddl: [], schema_rewritten: false },
      },
    };
    expect(classifyExtendPreview({ httpStatus: 200, body }, "ratings")).toEqual({
      hit: true,
      reason: "routed_widen",
    });
  });

  it("MISS — a widen of a table other than the goal-named one (the run-220 hijack class)", () => {
    const body = {
      status: "ok",
      requires_confirm: true,
      trace: { sql: "", widen: { tables: ["facts_extra"], ddl: [], schema_rewritten: false } },
    };
    expect(classifyExtendPreview({ httpStatus: 200, body }, "reviews")).toEqual({
      hit: false,
      reason: "widen_wrong_table:facts_extra",
    });
  });

  it("MISS — the pinned create/query clarify dead-end (the run-215 gap when open)", () => {
    const body = {
      error: { code: "clarify_required", clarification: { kind: "create_or_query_pinned" } },
    };
    expect(classifyExtendPreview({ httpStatus: 409, body }, "ratings")).toEqual({
      hit: false,
      reason: "clarify_required",
    });
  });

  it("MISS — the classifier read the write as a database create", () => {
    const body = {
      kind: "create",
      db: "db_x",
      trace: { sql: "", plan_id: "", confidence: 1, model: "m", cache_hit: false },
    };
    expect(classifyExtendPreview({ httpStatus: 200, body }, "ratings")).toEqual({
      hit: false,
      reason: "classified_create",
    });
  });

  it("MISS — a 2xx write with no widen block (table already observed / plain write)", () => {
    const body = {
      status: "ok",
      rows: [],
      rowCount: 0,
      trace: { sql: "INSERT ...", plan_id: "p", confidence: 1, model: "m", cache_hit: false },
    };
    expect(classifyExtendPreview({ httpStatus: 200, body }, "ratings")).toEqual({
      hit: false,
      reason: "ok_no_widen",
    });
  });

  it("MISS — a top-level error code envelope records the code", () => {
    expect(
      classifyExtendPreview({ httpStatus: 429, body: { code: "rate_limited" } }, "ratings"),
    ).toEqual({
      hit: false,
      reason: "error:rate_limited",
    });
  });

  it("MISS — an unparseable / null body falls back to the HTTP status", () => {
    expect(classifyExtendPreview({ httpStatus: 502, body: null }, "ratings")).toEqual({
      hit: false,
      reason: "error:502",
    });
  });

  it("empty widen.tables is not a hit (defends against an empty-array preview)", () => {
    const body = {
      status: "ok",
      rows: [],
      rowCount: 0,
      trace: {
        sql: "",
        plan_id: "p",
        confidence: 1,
        model: "m",
        cache_hit: false,
        widen: { tables: [], ddl: [], schema_rewritten: false },
      },
    };
    expect(classifyExtendPreview({ httpStatus: 200, body }, "ratings").hit).toBe(false);
  });
});

describe("resolveTarget", () => {
  // The run-218 bug: the workflow injects `NLQDB_API_BASE: ${{ vars... }}`, so an
  // unset repo var is an empty string, not undefined — `?? DEFAULT` did not
  // fall back and every fetch died `URL is invalid` (false 0/5).
  it("falls back to the prod defaults when the vars are UNSET", () => {
    expect(resolveTarget({})).toEqual({
      base: "https://app.nlqdb.com",
      dbId: "db_agent_memory_v1_3a8a72",
    });
  });

  it("falls back to the defaults when the vars are EMPTY / blank strings (the run-217 workflow shape)", () => {
    expect(resolveTarget({ NLQDB_API_BASE: "", NLQDB_DOGFOOD_DB: "   " })).toEqual({
      base: "https://app.nlqdb.com",
      dbId: "db_agent_memory_v1_3a8a72",
    });
  });

  it("honours an explicit override and strips a trailing slash from the base", () => {
    expect(
      resolveTarget({ NLQDB_API_BASE: "https://staging.nlqdb.com/", NLQDB_DOGFOOD_DB: "db_other" }),
    ).toEqual({ base: "https://staging.nlqdb.com", dbId: "db_other" });
  });
});

describe("WALK_SHAPES", () => {
  it("every shape carries a write verb so the pinned-write route classifies kind=write", () => {
    // route-ask.ts `pinned_write` fires only on a write-verb goal (SK-ASK-014
    // refined, not reversed) — a create-shaped goal still clarifies.
    const writeVerb = /\b(record|store|save|register|insert|add|log)\b/i;
    for (const shape of WALK_SHAPES) {
      expect(writeVerb.test(shape.goal)).toBe(true);
    }
  });

  it("each shape's expected table is the one its goal names", () => {
    for (const shape of WALK_SHAPES) {
      expect(shape.goal).toContain(`the ${shape.table} table`);
    }
  });

  it("covers the five representative first-insert shapes", () => {
    expect(WALK_SHAPES.map((s) => s.name)).toEqual([
      "new-table",
      "new-column-family",
      "type-varied",
      "jsonb",
      "auth-shaped",
    ]);
  });
});

describe("missDetail", () => {
  it("names the sql_rejected reason from error.params", () => {
    const body = { error: { code: "sql_rejected", params: { reason: "function_not_allowed" } } };
    expect(missDetail(body)).toBe("reason=function_not_allowed");
  });

  it("shows kind + planned SQL head on a 2xx miss", () => {
    const body = { kind: "write", trace: { sql: "INSERT INTO memories\n  (body) VALUES ('x')" } };
    expect(missDetail(body)).toBe("kind=write sql=INSERT INTO memories (body) VALUES ('x')");
  });

  it("is empty for an unrecognised body", () => {
    expect(missDetail(null)).toBe("");
    expect(missDetail({ error: { code: "x" } })).toBe("");
  });
});
