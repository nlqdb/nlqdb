import { describe, expect, test } from "bun:test";
import { groupByTable, groupProvisionedTables } from "./sample-rows";

// Guards the grouping behind the create-path sample tables — the in-chat
// `created` reply now renders these (matching the marketing CreateForm),
// so a regression here empties a stranger's first "did it work?" view.
describe("groupByTable", () => {
  test("groups rows by table, preserving per-table order", () => {
    const grouped = groupByTable([
      { table: "authors", values: { id: 1, name: "Ada" } },
      { table: "books", values: { id: 10, title: "A" } },
      { table: "authors", values: { id: 2, name: "Grace" } },
      { table: "books", values: { id: 11, title: "B" } },
    ]);

    expect(grouped.map((g) => g.table)).toEqual(["authors", "books"]);
    expect(grouped[0].rows).toEqual([
      { id: 1, name: "Ada" },
      { id: 2, name: "Grace" },
    ]);
    expect(grouped[1].rows).toEqual([
      { id: 10, title: "A" },
      { id: 11, title: "B" },
    ]);
  });

  test("empty input yields no groups (no created-reply render throw)", () => {
    expect(groupByTable([])).toEqual([]);
  });

  test("a single-row table still produces one group", () => {
    expect(groupByTable([{ table: "t", values: { a: null } }])).toEqual([
      { table: "t", rows: [{ a: null }] },
    ]);
  });
});

// The create response's seed set is LLM-authored and may cover only some
// tables, or none (SK-HDC-018/019). The create-result view must report the
// *provisioned* schema, so a stranger sees every table that was committed —
// never a subset, and never "0 tables" for a real DB.
describe("groupProvisionedTables", () => {
  test("renders every provisioned table, joining seeded rows where present", () => {
    // Schema has 3 tables; the LLM only seeded `orders`.
    const grouped = groupProvisionedTables(
      ["orders", "customers", "products"],
      [
        { table: "orders", values: { id: 1, total: 500 } },
        { table: "orders", values: { id: 2, total: 900 } },
      ],
    );
    // All 3 provisioned tables appear (the pre-fix bug dropped the 2 unseeded).
    expect(grouped.map((g) => g.table)).toEqual(["orders", "customers", "products"]);
    expect(grouped[0].rows).toEqual([
      { id: 1, total: 500 },
      { id: 2, total: 900 },
    ]);
    // Unseeded tables render with the SampleTable empty state, not vanish.
    expect(grouped[1].rows).toEqual([]);
    expect(grouped[2].rows).toEqual([]);
  });

  test("a fully-unseeded create still shows its tables (not '0 tables')", () => {
    const grouped = groupProvisionedTables(["orders", "customers"], []);
    expect(grouped.map((g) => g.table)).toEqual(["orders", "customers"]);
    expect(grouped.length).toBe(2);
  });

  test("preserves schema table order, not seed-row order", () => {
    const grouped = groupProvisionedTables(
      ["a", "b"],
      [
        { table: "b", values: { x: 1 } },
        { table: "a", values: { y: 2 } },
      ],
    );
    expect(grouped.map((g) => g.table)).toEqual(["a", "b"]);
  });

  test("falls back to grouping rows when the table list is absent (pre-field API)", () => {
    const rows = [{ table: "orders", values: { id: 1 } }];
    expect(groupProvisionedTables(undefined, rows)).toEqual(groupByTable(rows));
    expect(groupProvisionedTables([], rows)).toEqual(groupByTable(rows));
  });
});
