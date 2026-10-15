// SK-SCHEMA-012 — the deterministic insert planner: JSON values → WidenPlan +
// parameterised INSERT, no model.

import { describe, expect, it } from "vitest";
import { columnName, type ObservedSchema, planInsert } from "./plan.ts";

const none: ObservedSchema = new Map();

describe("columnName", () => {
  it.each([
    ["serverId", "server_id"],
    ["HTTPStatus", "http_status"],
    ["$schema", "schema"],
    ["_meta", "meta"],
    ["io.modelcontextprotocol.registry/official", "io_modelcontextprotocol_registry_official"],
    ["created-at", "created_at"],
    ["2fa", "fa"],
  ])("%s → %s", (key, col) => expect(columnName(key)).toBe(col));

  it("returns null when no letter survives", () => {
    expect(columnName("123")).toBeNull();
    expect(columnName("__")).toBeNull();
  });
});

describe("planInsert", () => {
  it("creates an unseen table with a generated uuid id and the widest value types", () => {
    const out = planInsert(none, "s1", "votes", [
      { serverId: "a", up: true, score: 4.5, meta: { k: 1 }, note: null },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.widens).toBe(true);
    expect(out.value.plan.create_tables[0]).toMatchObject({
      name: "votes",
      primary_key: ["id"],
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "server_id", type: "text" },
        { name: "up", type: "boolean" },
        { name: "score", type: "numeric" },
        { name: "meta", type: "jsonb" },
        { name: "note", type: "text" },
      ],
    });
    expect(out.value.insert.sql).toBe(
      'INSERT INTO "s1"."votes" ("server_id", "up", "score", "meta", "note") VALUES ($1, $2, $3, $4, $5) RETURNING *',
    );
    expect(out.value.insert.params).toEqual(["a", true, 4.5, '{"k":1}', null]);
  });

  it("keys a new table on the app's own integer / uuid id", () => {
    const ints = planInsert(none, "s1", "servers", [{ id: 1 }, { id: 2 }]);
    const uuids = planInsert(none, "s1", "keys", [{ id: "0b6c1f1e-3c2a-4d5e-8f90-1a2b3c4d5e6f" }]);
    expect(ints.ok && ints.value.plan.create_tables[0]?.columns[0]).toEqual({
      name: "id",
      description: "",
      type: "bigint",
      nullable: false,
    });
    expect(uuids.ok && uuids.value.plan.create_tables[0]?.columns[0]?.type).toBe("uuid");
  });

  it("adds only the unseen fields of an observed table, nullable", () => {
    const observed: ObservedSchema = new Map([
      [
        "votes",
        new Map([
          ["id", "uuid"],
          ["vote", "text"],
          ["meta", "jsonb"],
        ]),
      ],
    ]);
    const out = planInsert(observed, "s1", "votes", [
      { vote: "up", meta: "plain", weight: 2 },
      { vote: "down", weight: "heavy" },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.plan).toEqual({
      create_tables: [],
      add_columns: [
        {
          table: "votes",
          column: { name: "weight", description: "", type: "text", nullable: true },
        },
      ],
    });
    // A jsonb column takes any value as its JSON text; a missing field is NULL.
    expect(out.value.insert.params).toEqual(["up", '"plain"', 2, "down", null, "heavy"]);
  });

  it("does not widen a write whose fields are all observed", () => {
    const observed: ObservedSchema = new Map([["votes", new Map([["vote", "text"]])]]);
    const out = planInsert(observed, "s1", "votes", [{ vote: "up" }]);
    expect(out.ok && out.value.widens).toBe(false);
  });

  it.each([
    ["no rows", "t", []],
    ["a non-object row", "t", [[1]]],
    ["an empty row", "t", [{}]],
    ["a field with no letters", "t", [{ "123": 1 }]],
    ["two keys on one column", "t", [{ serverId: 1, server_id: 2 }]],
    ["a non-finite number", "t", [{ n: Number.NaN }]],
    ["a table with no letters", "42", [{ a: 1 }]],
  ])("rejects %s with a reason", (_label, table, rows) => {
    const out = planInsert(none, "s1", table, rows as Record<string, unknown>[]);
    expect(out.ok).toBe(false);
  });
});
