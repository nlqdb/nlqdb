import { describe, expect, it } from "bun:test";

import { classifyExtendPreview, WALK_SHAPES } from "../src/kpi1-live-walk.ts";

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
    expect(classifyExtendPreview({ httpStatus: 200, body })).toEqual({
      hit: true,
      reason: "routed_widen",
    });
  });

  it("MISS — the pinned create/query clarify dead-end (the run-215 gap when open)", () => {
    const body = {
      error: { code: "clarify_required", clarification: { kind: "create_or_query_pinned" } },
    };
    expect(classifyExtendPreview({ httpStatus: 409, body })).toEqual({
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
    expect(classifyExtendPreview({ httpStatus: 200, body })).toEqual({
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
    expect(classifyExtendPreview({ httpStatus: 200, body })).toEqual({
      hit: false,
      reason: "ok_no_widen",
    });
  });

  it("MISS — a top-level error code envelope records the code", () => {
    expect(classifyExtendPreview({ httpStatus: 429, body: { code: "rate_limited" } })).toEqual({
      hit: false,
      reason: "error:rate_limited",
    });
  });

  it("MISS — an unparseable / null body falls back to the HTTP status", () => {
    expect(classifyExtendPreview({ httpStatus: 502, body: null })).toEqual({
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
    expect(classifyExtendPreview({ httpStatus: 200, body }).hit).toBe(false);
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
