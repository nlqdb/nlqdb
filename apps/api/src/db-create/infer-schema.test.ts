// Unit tests for the Stage-1 schema-inference module. Stubs the LLM
// router via deps injection — `vi.mock` does not propagate through
// SELF.fetch in worker code, so the orchestrate-style stub pattern
// (apps/api/test/orchestrate.test.ts) is reused here.

import type { SchemaPlan } from "@nlqdb/db/types";
import type { LLMRouter, SchemaInferResponse } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { inferSchema, relaxSpeculativeForeignKeys, slugifyName } from "./infer-schema.ts";

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
      route: vi.fn(),
      plan: vi.fn(),
      summarize: vi.fn(),
      schemaInfer: schemaInferMock,
      // Engine classifier (SK-DB-010) — every full LLMRouter stub
      // includes this so a future contract widening (new method on
      // LLMRouter) lands the typecheck error in the canonical
      // route-ask.test.ts, not scattered across feature tests.
      engineClassify: vi.fn(),
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

// The production shape that dead-ended the creator (D1 registry row
// db_ideas_db_1ec135, 2026-08-14): `ideas.user_id` NOT NULL + FK to a
// speculatively normalized `users` table, and a `idea_tags` link table keyed on
// both parents. SK-HDC-022 relaxes the first and must leave the second alone.
const IDEAS_PLAN: SchemaPlan = {
  slug_hint: "ideas_db",
  description: "An ideas tracker.",
  tables: [
    {
      name: "users",
      description: "People who submit ideas.",
      columns: [
        { name: "id", type: "uuid", nullable: false, description: "Primary key." },
        { name: "name", type: "text", nullable: false, description: "Display name." },
      ],
      primary_key: ["id"],
    },
    {
      name: "ideas",
      description: "One row per idea.",
      columns: [
        { name: "id", type: "uuid", nullable: false, description: "Primary key." },
        { name: "user_id", type: "uuid", nullable: false, description: "Owner." },
        { name: "title", type: "text", nullable: false, description: "Idea title." },
      ],
      primary_key: ["id"],
    },
    {
      name: "tags",
      description: "Tag vocabulary.",
      columns: [
        { name: "id", type: "uuid", nullable: false, description: "Primary key." },
        { name: "label", type: "text", nullable: false, description: "Tag label." },
      ],
      primary_key: ["id"],
    },
    {
      name: "idea_tags",
      description: "Which tags an idea carries.",
      columns: [
        { name: "idea_id", type: "uuid", nullable: false, description: "Idea." },
        { name: "tag_id", type: "uuid", nullable: false, description: "Tag." },
      ],
      primary_key: ["idea_id", "tag_id"],
    },
  ],
  foreign_keys: [
    {
      from_table: "ideas",
      from_columns: ["user_id"],
      to_table: "users",
      to_columns: ["id"],
      on_delete: "cascade",
    },
    {
      from_table: "idea_tags",
      from_columns: ["idea_id"],
      to_table: "ideas",
      to_columns: ["id"],
      on_delete: "cascade",
    },
    {
      from_table: "idea_tags",
      from_columns: ["tag_id"],
      to_table: "tags",
      to_columns: ["id"],
      on_delete: "cascade",
    },
  ],
  metrics: [],
  dimensions: [],
  sample_rows: [],
};

function column(plan: SchemaPlan, table: string, name: string) {
  return plan.tables.find((t) => t.name === table)?.columns.find((c) => c.name === name);
}

function planResponse(plan: SchemaPlan | Record<string, unknown>): SchemaInferResponse {
  return { plan: plan as Record<string, unknown>, model: "fake-model", confidence: 1.0 };
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

describe("relaxSpeculativeForeignKeys (SK-HDC-022)", () => {
  it("makes a NOT NULL owner FK column nullable so 'add an idea' is possible", () => {
    const out = relaxSpeculativeForeignKeys(IDEAS_PLAN);
    expect(column(out, "ideas", "user_id")?.nullable).toBe(true);
  });

  it("keeps non-FK NOT NULL columns and the FK constraint itself untouched", () => {
    const out = relaxSpeculativeForeignKeys(IDEAS_PLAN);
    expect(column(out, "ideas", "title")?.nullable).toBe(false);
    expect(column(out, "ideas", "id")?.nullable).toBe(false);
    expect(out.foreign_keys).toEqual(IDEAS_PLAN.foreign_keys);
  });

  it("leaves a link table's primary-key FK columns NOT NULL (nullable PK is illegal)", () => {
    const out = relaxSpeculativeForeignKeys(IDEAS_PLAN);
    expect(column(out, "idea_tags", "idea_id")?.nullable).toBe(false);
    expect(column(out, "idea_tags", "tag_id")?.nullable).toBe(false);
  });

  it("is a no-op on a plan with no foreign keys", () => {
    expect(relaxSpeculativeForeignKeys(ORDERS_PLAN)).toBe(ORDERS_PLAN);
  });

  it("does not mutate the input plan", () => {
    const before = structuredClone(IDEAS_PLAN);
    relaxSpeculativeForeignKeys(IDEAS_PLAN);
    expect(IDEAS_PLAN).toEqual(before);
  });

  it("ignores a foreign key whose from_table is not in the plan", () => {
    const plan: SchemaPlan = {
      ...ORDERS_PLAN,
      foreign_keys: [
        {
          from_table: "ghosts",
          from_columns: ["order_id"],
          to_table: "orders",
          to_columns: ["id"],
          on_delete: "cascade",
        },
      ],
    };
    expect(relaxSpeculativeForeignKeys(plan)).toBe(plan);
  });
});

describe("inferSchema", () => {
  it("returns the relaxed plan on the inferred path (SK-HDC-022)", async () => {
    const { llm } = stubLLM(planResponse(IDEAS_PLAN));
    const out = await inferSchema({ llm }, { goal: "a database of ideas" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(column(out.plan, "ideas", "user_id")?.nullable).toBe(true);
  });

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
    if (out.reason !== "plan_invalid") return;
    expect(out.details.issue_count).toBeGreaterThan(0);
  });

  it("coerces numeric / boolean `default` values to strings (Groq llama emits bare numbers)", async () => {
    const ordersTable = ORDERS_PLAN.tables[0];
    if (!ordersTable) throw new Error("fixture missing orders table");
    const withNumericDefault = {
      ...ORDERS_PLAN,
      tables: [
        {
          ...ordersTable,
          columns: [
            ...ordersTable.columns,
            {
              name: "balance",
              type: "numeric",
              nullable: false,
              default: 0,
              description: "Starting balance.",
            },
            {
              name: "is_paid",
              type: "boolean",
              nullable: false,
              default: false,
              description: "Whether the order was paid.",
            },
          ],
        },
      ],
    };
    const { llm } = stubLLM(planResponse(withNumericDefault as unknown as SchemaPlan));
    const out = await inferSchema({ llm }, { goal: "anything" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const cols = out.plan.tables[0]?.columns ?? [];
    expect(cols.find((c) => c.name === "balance")?.default).toBe("0");
    expect(cols.find((c) => c.name === "is_paid")?.default).toBe("false");
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
    // Provider error details (API keys, prompt fragments) must not
    // surface in the result — only the OTel span on the LLM call
    // captures them. SK-HDC-* / GLOBAL-012.
    expect(out).not.toHaveProperty("details");
  });
});
