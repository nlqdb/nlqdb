// Unit tests for SK-HDC-019 deterministic sample-row salvage.
//
// The headline assertion is the salvage measurement: a seed set with one
// constraint-violating row keeps the other rows instead of losing all of them
// to SK-HDC-018's all-or-nothing empty-DB retry. Every drop reason is sound —
// a clean plan prunes nothing (the happy path is untouched).

import type { SampleRow, SchemaPlan } from "@nlqdb/db/types";
import { describe, expect, it } from "vitest";
import { pruneUninsertableSampleRows } from "./sample-rows.ts";

function plan(over: Partial<SchemaPlan>): SchemaPlan {
  return {
    slug_hint: "test_plan",
    description: "test plan",
    tables: [
      {
        name: "customers",
        description: "t",
        columns: [
          { name: "id", type: "integer", nullable: false, description: "c" },
          { name: "name", type: "text", nullable: false, description: "c" },
          { name: "age", type: "integer", nullable: true, description: "c" },
        ],
        primary_key: ["id"],
      },
      {
        name: "orders",
        description: "t",
        columns: [
          { name: "id", type: "integer", nullable: false, description: "c" },
          { name: "customer_id", type: "integer", nullable: true, description: "c" },
          { name: "total", type: "numeric", nullable: true, description: "c" },
        ],
        primary_key: ["id"],
      },
    ],
    foreign_keys: [
      {
        from_table: "orders",
        from_columns: ["customer_id"],
        to_table: "customers",
        to_columns: ["id"],
        on_delete: "restrict",
      },
    ],
    metrics: [],
    dimensions: [],
    sample_rows: [],
    ...over,
  };
}

const row = (table: string, values: SampleRow["values"]): SampleRow => ({ table, values });

describe("pruneUninsertableSampleRows", () => {
  it("prunes nothing on a clean plan — the happy path is untouched", () => {
    const p = plan({
      sample_rows: [
        row("customers", { id: 1, name: "Ada", age: 30 }),
        row("customers", { id: 2, name: "Lin" }),
        row("orders", { id: 10, customer_id: 1, total: "9.99" }),
      ],
    });
    const out = pruneUninsertableSampleRows(p);
    expect(out.dropped).toHaveLength(0);
    expect(out.rows).toHaveLength(3);
  });

  it("SALVAGE: one bad row of N is dropped, the rest are kept (0 → N-1 seeded)", () => {
    // The all-or-nothing behaviour this replaces: any one of these failing
    // makes the provisioner drop all 4. Here only the NOT-NULL-violating row
    // (missing `name`) is removed; the other 3 survive.
    const p = plan({
      sample_rows: [
        row("customers", { id: 1, name: "Ada" }),
        row("customers", { id: 2 }), // missing NOT NULL `name`
        row("customers", { id: 3, name: "Lin" }),
        row("orders", { id: 10, customer_id: 1 }),
      ],
    });
    const out = pruneUninsertableSampleRows(p);
    expect(out.dropped.map((d) => d.reason)).toEqual(["not_null_violation"]);
    expect(out.rows).toHaveLength(3);
  });

  it("drops a null value for a primary-key column (implicitly NOT NULL)", () => {
    const p = plan({ sample_rows: [row("customers", { id: null, name: "Ada" })] });
    expect(pruneUninsertableSampleRows(p).dropped[0]?.reason).toBe("not_null_violation");
  });

  it("keeps an omitted NOT NULL column when it has a DEFAULT", () => {
    const p = plan({
      tables: [
        {
          name: "customers",
          description: "t",
          columns: [
            { name: "id", type: "integer", nullable: false, description: "c" },
            { name: "tier", type: "text", nullable: false, default: "'free'", description: "c" },
          ],
          primary_key: ["id"],
        },
      ],
      foreign_keys: [],
      sample_rows: [row("customers", { id: 1 })],
    });
    expect(pruneUninsertableSampleRows(p).dropped).toHaveLength(0);
  });

  it("drops an uncoercible type, keeps coercible string forms", () => {
    const p = plan({
      sample_rows: [
        row("customers", { id: "not-a-number", name: "Ada" }), // integer ← junk
        row("customers", { id: "2", name: "Lin" }), // '2' coerces fine
        row("orders", { id: 10, customer_id: 2, total: "1.5e3" }), // numeric scientific
      ],
    });
    const out = pruneUninsertableSampleRows(p);
    expect(out.dropped.map((d) => d.reason)).toEqual(["type_mismatch"]);
    expect(out.rows).toHaveLength(2);
  });

  it("drops a non-UUID string in a uuid column", () => {
    const p = plan({
      tables: [
        {
          name: "t",
          description: "t",
          columns: [{ name: "id", type: "uuid", nullable: false, description: "c" }],
          primary_key: ["id"],
        },
      ],
      foreign_keys: [],
      sample_rows: [
        row("t", { id: "nope" }),
        row("t", { id: "550e8400-e29b-41d4-a716-446655440000" }),
      ],
    });
    const out = pruneUninsertableSampleRows(p);
    expect(out.dropped.map((d) => d.reason)).toEqual(["type_mismatch"]);
    expect(out.rows).toHaveLength(1);
  });

  it("drops a forward foreign-key reference, keeps a parent-first one", () => {
    const p = plan({
      sample_rows: [
        row("orders", { id: 1, customer_id: 99 }), // parent 99 not yet inserted
        row("customers", { id: 99, name: "Ada" }),
        row("orders", { id: 2, customer_id: 99 }), // now resolvable
      ],
    });
    const out = pruneUninsertableSampleRows(p);
    expect(out.dropped.map((d) => d.reason)).toEqual(["fk_violation"]);
    expect(out.rows.map((r) => r.values["id"])).toEqual([99, 2]);
  });

  it("allows a null foreign-key value", () => {
    const p = plan({ sample_rows: [row("orders", { id: 1, customer_id: null })] });
    expect(pruneUninsertableSampleRows(p).dropped).toHaveLength(0);
  });

  it("matches FK parents across string/number coercion (no false drop)", () => {
    const p = plan({
      sample_rows: [
        row("customers", { id: 7, name: "Ada" }),
        row("orders", { id: 1, customer_id: "7" }), // '7' == 7
      ],
    });
    expect(pruneUninsertableSampleRows(p).dropped).toHaveLength(0);
  });

  it("cascades: a dropped parent removes its dangling children", () => {
    const p = plan({
      sample_rows: [
        row("customers", { id: null, name: "Ada" }), // dropped (PK null)
        row("orders", { id: 1, customer_id: 1 }), // parent never accepted → dropped
      ],
    });
    const out = pruneUninsertableSampleRows(p);
    expect(out.dropped.map((d) => d.reason)).toEqual(["not_null_violation", "fk_violation"]);
    expect(out.rows).toHaveLength(0);
  });

  it("drops rows for an unknown table or unknown column", () => {
    const p = plan({
      sample_rows: [row("ghosts", { id: 1 }), row("customers", { id: 1, name: "Ada", nope: "x" })],
    });
    const out = pruneUninsertableSampleRows(p);
    expect(out.dropped.map((d) => d.reason)).toEqual(["unknown_table", "unknown_column"]);
    expect(out.rows).toHaveLength(0);
  });
});
