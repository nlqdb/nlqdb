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
    expect(out.value.inserts[0]?.sql).toBe(
      'INSERT INTO "s1"."votes" ("server_id", "up", "score", "meta", "note") VALUES ($1, $2, $3, $4, $5) RETURNING *',
    );
    expect(out.value.inserts[0]?.params).toEqual(["a", true, 4.5, '{"k":1}', null]);
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

  it("lets a row that omits (or nulls) the app's id take the generated one", () => {
    const out = planInsert(none, "s1", "servers", [
      { id: 7, name: "a" },
      { name: "b" },
      { id: null, name: "c" },
    ]);
    expect(out.ok && out.value.inserts[0]?.sql).toContain(
      "VALUES ($1, $2), (DEFAULT, $3), (DEFAULT, $4)",
    );
    // …after the id sequence is lifted past the explicit 7, so DEFAULT draws 8.
    expect(out.ok && out.value.sequence?.params).toEqual([7, '"s1"."servers"']);
    // Only ever raises: a setval that kept the value could lower a sequence a
    // concurrent insert advanced meanwhile.
    expect(out.ok && out.value.sequence?.sql).toContain("$1::bigint > COALESCE(");
  });

  it("lifts no sequence when no row names an integer id", () => {
    const out = planInsert(none, "s1", "servers", [{ name: "a" }, { id: null }]);
    expect(out.ok && out.value.sequence).toBeUndefined();
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
    // A jsonb column takes any value as its JSON text; a missing field is DEFAULT.
    expect(out.value.inserts[0]?.sql).toMatch(/VALUES \(\$1, \$2, \$3\), \(\$4, DEFAULT, \$5\)/);
    expect(out.value.inserts[0]?.params).toEqual(["up", '"plain"', 2, "down", "heavy"]);
  });

  it("binds a JSON array as is into a create-path text[] column", () => {
    // `information_schema` reports `text[]` as `ARRAY`; its JSON text would be
    // a malformed array literal (22P02), the driver's array binding is not.
    const observed: ObservedSchema = new Map([["posts", new Map([["tags", "ARRAY"]])]]);
    const out = planInsert(observed, "s1", "posts", [{ tags: ["a", "b"] }]);
    expect(out.ok && out.value.inserts[0]?.params).toEqual([["a", "b"]]);
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
    ["a Postgres system column name", "t", [{ xmin: 1 }]],
  ])("rejects %s with a reason", (_label, table, rows) => {
    const out = planInsert(none, "s1", table, rows as Record<string, unknown>[]);
    expect(out.ok).toBe(false);
  });

  describe("with a key (GLOBAL-041 step 11)", () => {
    const votes: ObservedSchema = new Map([
      [
        "votes",
        new Map([
          ["id", "uuid"],
          ["server_id", "numeric"],
          ["user_id", "numeric"],
          ["stars", "numeric"],
        ]),
      ],
    ]);

    it("upserts on the key and indexes it on first use", () => {
      const out = planInsert(
        votes,
        "s1",
        "votes",
        [{ serverId: 1, userId: 7, stars: 4 }],
        ["serverId", "user_id"],
      );
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.value.uniqueIndex).toEqual({
        lock: 'LOCK TABLE "s1"."votes" IN SHARE ROW EXCLUSIVE MODE',
        ddl: 'CREATE UNIQUE INDEX IF NOT EXISTS "votes_server_id_user_id_key" ON "s1"."votes" ("server_id", "user_id")',
      });
      expect(out.value.inserts).toEqual([
        {
          sql:
            'INSERT INTO "s1"."votes" ("server_id", "user_id", "stars") VALUES ($1, $2, $3) ' +
            'ON CONFLICT ("server_id", "user_id") DO UPDATE SET "stars" = EXCLUDED."stars" RETURNING *',
          params: [1, 7, 4],
        },
      ]);
    });

    it("adds no index when a unique index already covers the key, in any order", () => {
      const out = planInsert(
        votes,
        "s1",
        "votes",
        [{ server_id: 1, user_id: 7 }],
        ["server_id", "user_id"],
        [["id"], ["user_id", "server_id"]],
      );
      expect(out.ok && out.value.uniqueIndex).toBeUndefined();
      // Nothing but the key to set: it sets itself, so RETURNING still hands back the row.
      expect(out.ok && out.value.inserts[0]?.sql).toContain(
        'DO UPDATE SET "server_id" = EXCLUDED."server_id"',
      );
    });

    it("adds no index when the key is a new table's primary key", () => {
      const out = planInsert(none, "s1", "servers", [{ id: 1, name: "fs" }], ["id"]);
      expect(out.ok && out.value.uniqueIndex).toBeUndefined();
      expect(out.ok && out.value.inserts[0]?.sql).toContain('ON CONFLICT ("id")');
    });

    it("lands a repeated key once, merged, the later row's fields winning", () => {
      const out = planInsert(
        votes,
        "s1",
        "votes",
        [
          { server_id: 1, stars: 1, user_id: 7 },
          { server_id: 2, stars: 5, user_id: 8 },
          { server_id: 1, stars: 3 },
        ],
        ["server_id"],
      );
      expect(out.ok && out.value.inserts[0]?.params).toEqual([2, 5, 8, 1, 3, 7]);
    });

    it("hash-suffixes an index name past 63 bytes, so two cut keys never share one", () => {
      const long = "a_very_long_table_name_for_ratings_by_server";
      const name = (key: string[]) => {
        const out = planInsert(none, "s1", long, [{ serverCategoryId: 1, userAccountId: 2 }], key);
        return out.ok ? out.value.uniqueIndex?.ddl.match(/EXISTS "([^"]+)"/)?.[1] : undefined;
      };
      const a = name(["server_category_id", "user_account_id"]);
      const b = name(["server_category_id"]);
      expect(a?.length).toBeLessThanOrEqual(63);
      expect(b?.length).toBeLessThanOrEqual(63);
      expect(a).not.toBe(b);
    });

    it("gives each row shape its own INSERT, so an omitted field keeps its stored value", () => {
      const out = planInsert(
        votes,
        "s1",
        "votes",
        [{ server_id: 1, stars: 4 }, { server_id: 2, stars: 5, user_id: 7 }, { server_id: 3 }],
        ["server_id"],
      );
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.value.inserts.map((i) => i.sql.match(/SET (.*) RETURNING/)?.[1])).toEqual([
        '"stars" = EXCLUDED."stars"',
        '"stars" = EXCLUDED."stars", "user_id" = EXCLUDED."user_id"',
        '"server_id" = EXCLUDED."server_id"',
      ]);
      expect(out.value.inserts.every((i) => !i.sql.includes("DEFAULT"))).toBe(true);
    });

    it("never sets a stored row's id from a null id", () => {
      const out = planInsert(
        votes,
        "s1",
        "votes",
        [{ id: null, server_id: 1, stars: 4 }],
        ["server_id"],
      );
      expect(out.ok && out.value.inserts[0]?.sql).toBe(
        'INSERT INTO "s1"."votes" ("server_id", "stars") VALUES ($1, $2) ' +
          'ON CONFLICT ("server_id") DO UPDATE SET "stars" = EXCLUDED."stars" RETURNING *',
      );
    });

    it.each([
      ["a row missing a key field", [{ stars: 1 }], ["server_id"]],
      ["a null key value", [{ server_id: null }], ["server_id"]],
      ["a key field with no letters", [{ server_id: 1 }], ["42"]],
      ["a key field named twice", [{ server_id: 1 }], ["serverId", "server_id"]],
    ])("rejects %s with a reason", (_label, rows, key) => {
      const out = planInsert(votes, "s1", "votes", rows as Record<string, unknown>[], key);
      expect(out.ok).toBe(false);
    });
  });
});
