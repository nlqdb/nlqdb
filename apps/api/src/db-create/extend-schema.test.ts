// Unit tests for the widen-on-write extend module (GLOBAL-041 Phase A step 2,
// exec half). Stubs the LLM router via deps injection — the same pattern as
// `infer-schema.test.ts` (vi.mock does not propagate through SELF.fetch in
// worker code).

import type { ExtendSchemaResponse, LLMRouter } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import { extendSchema } from "./extend-schema.ts";

function stubLLM(result: ExtendSchemaResponse | Error): {
  llm: LLMRouter;
  extendSchemaMock: ReturnType<typeof vi.fn>;
} {
  const extendSchemaMock = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return {
    extendSchemaMock,
    llm: {
      route: vi.fn(),
      plan: vi.fn(),
      summarize: vi.fn(),
      schemaInfer: vi.fn(),
      extendSchema: extendSchemaMock,
      engineClassify: vi.fn(),
    } as unknown as LLMRouter,
  };
}

const SCHEMA = "TABLE orders (id uuid, customer text, drink text)";

// A well-formed widen plan: one new nullable column on an existing table
// plus one brand-new table the write references.
function planResponse(plan: Record<string, unknown>): ExtendSchemaResponse {
  return { plan, model: "test-model", confidence: 1.0 };
}

const VALID_PLAN = {
  add_columns: [
    {
      table: "orders",
      column: { name: "total", type: "numeric", nullable: true, description: "Order total USD." },
    },
  ],
  create_tables: [
    {
      name: "customers",
      description: "One row per customer.",
      columns: [{ name: "id", type: "uuid", nullable: false, description: "PK." }],
      primary_key: ["id"],
    },
  ],
};

describe("extendSchema", () => {
  it("returns a validated WidenPlan and passes goal + schema to the LLM", async () => {
    const { llm, extendSchemaMock } = stubLLM(planResponse(VALID_PLAN));
    const res = await extendSchema({ llm }, { goal: "add order total 5.50", schema: SCHEMA });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.model).toBe("test-model");
    expect(res.confidence).toBe(1.0);
    expect(res.plan.add_columns[0]?.table).toBe("orders");
    expect(res.plan.create_tables[0]?.name).toBe("customers");
    expect(extendSchemaMock).toHaveBeenCalledWith({
      goal: "add order total 5.50",
      schema: SCHEMA,
    });
  });

  it("defaults an omitted `nullable` to true (widen columns are always nullable)", async () => {
    const { llm } = stubLLM(
      planResponse({
        add_columns: [
          { table: "orders", column: { name: "note", type: "text", description: "A note." } },
        ],
        create_tables: [],
      }),
    );
    const res = await extendSchema({ llm }, { goal: "note on order", schema: SCHEMA });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan.add_columns[0]?.column.nullable).toBe(true);
  });

  it("maps an LLM throw to llm_failed without leaking the error", async () => {
    const { llm } = stubLLM(new Error("provider 500 with api-key in url"));
    const res = await extendSchema({ llm }, { goal: "x", schema: SCHEMA });
    expect(res).toEqual({ ok: false, reason: "llm_failed" });
  });

  it("rejects an empty plan (no create_tables, no add_columns) as plan_invalid", async () => {
    const { llm } = stubLLM(planResponse({ add_columns: [], create_tables: [] }));
    const res = await extendSchema({ llm }, { goal: "x", schema: SCHEMA });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("plan_invalid");
  });

  it("rejects a NOT NULL add column (widen-only invariant SK-SCHEMA-008)", async () => {
    const { llm } = stubLLM(
      planResponse({
        add_columns: [
          {
            table: "orders",
            column: { name: "total", type: "numeric", nullable: false, description: "d" },
          },
        ],
        create_tables: [],
      }),
    );
    const res = await extendSchema({ llm }, { goal: "x", schema: SCHEMA });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("plan_invalid");
  });

  it("rejects a DEFAULT on an add column (retype proposal, SK-SCHEMA-009)", async () => {
    const { llm } = stubLLM(
      planResponse({
        add_columns: [
          {
            table: "orders",
            column: {
              name: "total",
              type: "numeric",
              nullable: true,
              default: "0",
              description: "d",
            },
          },
        ],
        create_tables: [],
      }),
    );
    const res = await extendSchema({ llm }, { goal: "x", schema: SCHEMA });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("plan_invalid");
  });
});
