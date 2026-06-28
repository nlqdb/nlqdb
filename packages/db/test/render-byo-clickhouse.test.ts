import { describe, expect, it } from "vitest";

import type { IntrospectedClickhouseSchema } from "../src/introspect-clickhouse.ts";
import { renderByoClickhouseSchema } from "../src/render-byo-clickhouse.ts";
import { fingerprintSchema } from "../src/schema-fingerprint.ts";

// SK-MULTIENG-005 — the BYO ClickHouse schema render. It must produce a
// deterministic `CREATE TABLE` text (tables sorted by name, columns in
// introspected order, PK as a trailing comment, no FKs) and a stable hash.

const SCHEMA: IntrospectedClickhouseSchema = {
  database: "analytics",
  tables: [
    {
      name: "events",
      columns: [
        { name: "event_date", type: "Date", nullable: false },
        { name: "user_id", type: "UInt64", nullable: false },
        { name: "props", type: "Nullable(String)", nullable: true },
      ],
      primaryKey: "toYYYYMM(event_date), user_id",
    },
    {
      name: "accounts",
      columns: [
        { name: "id", type: "UInt64", nullable: false },
        { name: "name", type: "LowCardinality(String)", nullable: false },
      ],
      primaryKey: "",
    },
  ],
};

describe("renderByoClickhouseSchema", () => {
  it("renders deterministic CREATE TABLE text sorted by table name", () => {
    const { schemaText } = renderByoClickhouseSchema(SCHEMA);
    expect(schemaText).toBe(
      `CREATE TABLE "analytics"."accounts" (
  "id" UInt64,
  "name" LowCardinality(String)
)

CREATE TABLE "analytics"."events" (
  "event_date" Date,
  "user_id" UInt64,
  "props" Nullable(String)
)
-- PRIMARY KEY (toYYYYMM(event_date), user_id)`,
    );
  });

  it("renders the primary key as a trailing comment expression", () => {
    const { schemaText } = renderByoClickhouseSchema(SCHEMA);
    expect(schemaText).toContain("-- PRIMARY KEY (toYYYYMM(event_date), user_id)");
  });

  it("emits no PRIMARY KEY clause and no foreign keys", () => {
    const { schemaText } = renderByoClickhouseSchema(SCHEMA);
    expect(schemaText).not.toMatch(/^\s*PRIMARY KEY/m);
    expect(schemaText).not.toContain("FOREIGN KEY");
    expect(schemaText).not.toContain("REFERENCES");
  });

  it("hashes the rendered text via fingerprintSchema", () => {
    const { schemaText, schemaHash } = renderByoClickhouseSchema(SCHEMA);
    expect(schemaHash).toBe(fingerprintSchema(schemaText));
    // Stable across calls — same read-model, same hash.
    expect(renderByoClickhouseSchema(SCHEMA).schemaHash).toBe(schemaHash);
  });
});
