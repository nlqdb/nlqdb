import { describe, expect, it } from "vitest";
import { fingerprintSchema, renderByoPostgresSchema } from "../src/index.ts";
import type { IntrospectedSchema } from "../src/introspect-postgres.ts";

describe("renderByoPostgresSchema", () => {
  it("renders schema-qualified CREATE TABLE cards with verbatim types, nullability, and PK", () => {
    const schema: IntrospectedSchema = {
      schema: "public",
      tables: [
        {
          name: "orders",
          columns: [
            { name: "id", type: "integer", nullable: false },
            { name: "total", type: "numeric(10,2)", nullable: true },
            { name: "note", type: "character varying(255)", nullable: true },
          ],
          primaryKey: ["id"],
        },
      ],
      foreignKeys: [],
    };
    const { schemaText } = renderByoPostgresSchema(schema);
    expect(schemaText).toBe(
      `CREATE TABLE "public"."orders" (\n` +
        `  "id" integer NOT NULL,\n` +
        `  "total" numeric(10,2),\n` +
        `  "note" character varying(255),\n` +
        `  PRIMARY KEY ("id")\n` +
        `);`,
    );
  });

  it("omits the PRIMARY KEY line for a table with no primary key", () => {
    const schema: IntrospectedSchema = {
      schema: "public",
      tables: [
        {
          name: "events",
          columns: [{ name: "ts", type: "timestamp with time zone", nullable: false }],
          primaryKey: [],
        },
      ],
      foreignKeys: [],
    };
    const { schemaText } = renderByoPostgresSchema(schema);
    expect(schemaText).toBe(
      `CREATE TABLE "public"."events" (\n  "ts" timestamp with time zone NOT NULL\n);`,
    );
  });

  it("renders unnamed, action-free ALTER TABLE ADD FOREIGN KEY after the tables, with composite keys ordered", () => {
    const schema: IntrospectedSchema = {
      schema: "shop",
      tables: [
        {
          name: "lines",
          columns: [
            { name: "order_a", type: "integer", nullable: false },
            { name: "order_b", type: "integer", nullable: false },
          ],
          primaryKey: [],
        },
        {
          name: "orders",
          columns: [
            { name: "a", type: "integer", nullable: false },
            { name: "b", type: "integer", nullable: false },
          ],
          primaryKey: ["a", "b"],
        },
      ],
      foreignKeys: [
        {
          fromTable: "lines",
          fromColumns: ["order_a", "order_b"],
          toTable: "orders",
          toColumns: ["a", "b"],
        },
      ],
    };
    const { schemaText } = renderByoPostgresSchema(schema);
    expect(schemaText).toContain(
      `ALTER TABLE "shop"."lines" ADD FOREIGN KEY ("order_a", "order_b") REFERENCES "shop"."orders" ("a", "b");`,
    );
    // Tables come first, the FK statement last, separated by blank lines.
    expect(schemaText.indexOf("CREATE TABLE")).toBeLessThan(schemaText.indexOf("ALTER TABLE"));
    expect(schemaText).toContain("\n\n");
  });

  it("escapes embedded double-quotes in identifiers", () => {
    const schema: IntrospectedSchema = {
      schema: "public",
      tables: [
        {
          name: 'we"ird',
          columns: [{ name: 'c"ol', type: "text", nullable: true }],
          primaryKey: [],
        },
      ],
      foreignKeys: [],
    };
    const { schemaText } = renderByoPostgresSchema(schema);
    expect(schemaText).toBe(`CREATE TABLE "public"."we""ird" (\n  "c""ol" text\n);`);
  });

  it("is deterministic and hashes its rendered text via fingerprintSchema", () => {
    const schema: IntrospectedSchema = {
      schema: "public",
      tables: [
        { name: "t", columns: [{ name: "id", type: "uuid", nullable: false }], primaryKey: ["id"] },
      ],
      foreignKeys: [],
    };
    const a = renderByoPostgresSchema(schema);
    const b = renderByoPostgresSchema(schema);
    expect(a).toEqual(b);
    expect(a.schemaHash).toBe(fingerprintSchema(a.schemaText));
    // Fingerprint is the 8-hex FNV-1a digest.
    expect(a.schemaHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("changes the hash when the schema changes", () => {
    const base: IntrospectedSchema = {
      schema: "public",
      tables: [
        {
          name: "t",
          columns: [{ name: "id", type: "integer", nullable: false }],
          primaryKey: ["id"],
        },
      ],
      foreignKeys: [],
    };
    const widened: IntrospectedSchema = {
      schema: "public",
      tables: [
        {
          name: "t",
          columns: [
            { name: "id", type: "integer", nullable: false },
            { name: "added", type: "text", nullable: true },
          ],
          primaryKey: ["id"],
        },
      ],
      foreignKeys: [],
    };
    expect(renderByoPostgresSchema(base).schemaHash).not.toBe(
      renderByoPostgresSchema(widened).schemaHash,
    );
  });
});

describe("fingerprintSchema", () => {
  it("is stable, equal-in/equal-out, and 8 lowercase hex chars", () => {
    expect(fingerprintSchema("abc")).toBe(fingerprintSchema("abc"));
    expect(fingerprintSchema("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintSchema("abc")).not.toBe(fingerprintSchema("abd"));
  });

  it("matches the canonical FNV-1a 32-bit digest of the empty string", () => {
    // FNV-1a offset basis 0x811c9dc5 with no bytes mixed in.
    expect(fingerprintSchema("")).toBe("811c9dc5");
  });
});
