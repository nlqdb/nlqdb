// Unit tests for the Stage-1 schema-inference module. Stubs the LLM
// router via deps injection — `vi.mock` does not propagate through
// SELF.fetch in worker code, so the orchestrate-style stub pattern
// (apps/api/test/orchestrate.test.ts) is reused here.

import type { SchemaPlan } from "@nlqdb/db/types";
import type { LLMRouter, SchemaInferResponse } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { inferSchema, slugifyName } from "./infer-schema.ts";

function stubLLM(result: SchemaInferResponse | Error): {
  llm: LLMRouter;
  schemaInferMock: ReturnType<typeof vi.fn>;
} {
  const schemaInferMock = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return {
    schemaInferMock,
    llm: {
      classify: vi.fn(),
      plan: vi.fn(),
      summarize: vi.fn(),
      schemaInfer: schemaInferMock,
    } as unknown as LLMRouter,
  };
}

const ORDERS_PLAN: SchemaPlan = {
  slug_hint: "coffee_orders",
  description: "An orders tracker for a small coffee shop.",
  tables: [
    {
      name: "orders",
      description: "One row per drink ordered.",
      columns: [
        { name: "id", type: "uuid", nullable: false, description: "Primary key." },
        { name: "customer", type: "text", nullable: false, description: "Customer name." },
        { name: "drink", type: "text", nullable: false, description: "Drink name." },
        { name: "total", type: "numeric", nullable: false, description: "Order total in USD." },
        {
          name: "created_at",
          type: "timestamp_tz",
          nullable: false,
          description: "When the order was placed.",
        },
      ],
      primary_key: ["id"],
    },
  ],
  foreign_keys: [],
  metrics: [
    {
      name: "revenue",
      description: "Sum of all order totals.",
      agg: "sum",
      expression: "orders.total",
    },
  ],
  dimensions: [
    {
      name: "drink",
      description: "Drink name for grouping.",
      table: "orders",
      column: "drink",
    },
  ],
  sample_rows: [
    {
      table: "orders",
      values: {
        id: "00000000-0000-0000-0000-000000000001",
        customer: "Ada",
        drink: "latte",
        total: 4.5,
        created_at: "2026-04-01T09:15:00Z",
      },
    },
  ],
};

function planResponse(plan: SchemaPlan | Record<string, unknown>): SchemaInferResponse {
  return { plan: plan as Record<string, unknown> };
}

describe("slugifyName", () => {
  it("strips diacritics and lowercases ('My Café Orders' → 'my_cafe_orders')", () => {
    expect(slugifyName("My Café Orders")).toBe("my_cafe_orders");
  });

  it("collapses runs of non-alphanumerics into a single underscore", () => {
    expect(slugifyName("Foo  --  Bar!!")).toBe("foo_bar");
  });

  it("prefixes 'db_' when the result would not start with a letter", () => {
    expect(slugifyName("123 things")).toBe("db_123_things");
  });

  it("returns 'db' for input that contains no alphanumerics", () => {
    expect(slugifyName("!!!")).toBe("db");
  });

  it("clamps to 30 chars without trailing underscore", () => {
    const out = slugifyName("a".repeat(40));
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith("_")).toBe(false);
  });
});

describe("inferSchema", () => {
  it("returns ok with a valid plan for a clear goal", async () => {
    const { llm, schemaInferMock } = stubLLM(planResponse(ORDERS_PLAN));
    const out = await inferSchema({ llm }, { goal: "an orders tracker for my coffee shop" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.plan.slug_hint).toBe("coffee_orders");
    const orders = out.plan.tables.find((t) => t.name === "orders");
    expect(orders).toBeDefined();
    const colNames = orders?.columns.map((c) => c.name) ?? [];
    expect(colNames).toEqual(expect.arrayContaining(["customer", "drink", "total", "created_at"]));
    expect(schemaInferMock).toHaveBeenCalledTimes(1);
    expect(schemaInferMock).toHaveBeenCalledWith({
      goal: "an orders tracker for my coffee shop",
    });
  });

  it("overrides slug_hint with slugified `name` when provided", async () => {
    const { llm } = stubLLM(planResponse(ORDERS_PLAN));
    const out = await inferSchema({ llm }, { goal: "an orders tracker", name: "My Café Orders" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.plan.slug_hint).toBe("my_cafe_orders");
  });

  it("returns ambiguous_goal for a vague goal that yields a shallow plan", async () => {
    // Single table with a primary_key that doesn't match any column —
    // the shape passes Zod but the heuristic flags it as filler.
    const shallow = {
      slug_hint: "thing",
      description: "Something.",
      tables: [
        {
          name: "thing",
          description: "A thing.",
          columns: [{ name: "blob", type: "text", nullable: true, description: "A blob." }],
          primary_key: ["nonexistent_col"],
        },
      ],
      foreign_keys: [],
      metrics: [],
      dimensions: [],
      sample_rows: [],
    };
    const { llm } = stubLLM(planResponse(shallow));
    const out = await inferSchema({ llm }, { goal: "do something" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("ambiguous_goal");
  });

  it("returns plan_invalid when the plan uses a Postgres reserved word as a table name", async () => {
    const reserved = {
      ...ORDERS_PLAN,
      tables: [{ ...ORDERS_PLAN.tables[0], name: "select" }],
    };
    const { llm } = stubLLM(planResponse(reserved));
    const out = await inferSchema({ llm }, { goal: "anything" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("plan_invalid");
    expect(out.details).toBeDefined();
  });

  it("returns plan_invalid when the plan omits required `metrics` array (SK-HDC-004)", async () => {
    // SK-HDC-004: metrics + dimensions are required arrays — empty
    // allowed, absent rejected. Drop `metrics` and we should fail
    // shape validation, not silently default to [].
    const { metrics: _metrics, ...withoutMetrics } = ORDERS_PLAN;
    const { llm } = stubLLM(planResponse(withoutMetrics));
    const out = await inferSchema({ llm }, { goal: "anything" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("plan_invalid");
  });

  it("returns llm_failed when the router throws", async () => {
    const { llm } = stubLLM(new Error("upstream 500"));
    const out = await inferSchema({ llm }, { goal: "anything" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("llm_failed");
    expect(out.details).toMatchObject({ message: "upstream 500" });
  });
});
