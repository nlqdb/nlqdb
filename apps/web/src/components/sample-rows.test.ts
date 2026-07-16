import { describe, expect, test } from "bun:test";
import { groupByTable } from "./sample-rows";

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
