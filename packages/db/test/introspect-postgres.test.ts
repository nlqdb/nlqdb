import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { introspectPostgres } from "../src/index.ts";
import type { PostgresQueryFn } from "../src/postgres.ts";
import type { Row } from "../src/types.ts";

// Introspection runs three fixed `pg_catalog` queries (columns, primary keys,
// foreign keys). The stub routes by a marker substring unique to each so a
// test can hand back exactly the rows that query would return.
type Fixture = { columns?: Row[]; primaryKeys?: Row[]; foreignKeys?: Row[] };

function stubQuery(fixture: Fixture): {
  query: PostgresQueryFn;
  calls: { sql: string; params: unknown[] }[];
} {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query: PostgresQueryFn = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("format_type")) return { rows: fixture.columns ?? [] };
    if (sql.includes("contype = 'p'")) return { rows: fixture.primaryKeys ?? [] };
    if (sql.includes("contype = 'f'")) return { rows: fixture.foreignKeys ?? [] };
    throw new Error(`unexpected introspection query: ${sql.slice(0, 40)}`);
  };
  return { query, calls };
}

let telemetry: TestTelemetry;
beforeEach(() => {
  telemetry = createTestTelemetry();
});
afterEach(() => {
  telemetry.reset();
});

describe("introspectPostgres", () => {
  it("assembles tables with ordered columns, types, and nullability", async () => {
    const { query } = stubQuery({
      columns: [
        { table_name: "orders", column_name: "id", data_type: "integer", not_null: true },
        { table_name: "orders", column_name: "total", data_type: "numeric(10,2)", not_null: false },
        { table_name: "users", column_name: "id", data_type: "uuid", not_null: true },
        {
          table_name: "users",
          column_name: "email",
          data_type: "character varying(255)",
          not_null: true,
        },
      ],
    });
    const schema = await introspectPostgres(query, "public");
    expect(schema).toEqual({
      schema: "public",
      foreignKeys: [],
      // Sorted by table name; columns stay in attnum order.
      tables: [
        {
          name: "orders",
          primaryKey: [],
          columns: [
            { name: "id", type: "integer", nullable: false },
            { name: "total", type: "numeric(10,2)", nullable: true },
          ],
        },
        {
          name: "users",
          primaryKey: [],
          columns: [
            { name: "id", type: "uuid", nullable: false },
            { name: "email", type: "character varying(255)", nullable: false },
          ],
        },
      ],
    });
  });

  it("attaches primary-key columns in key-sequence order", async () => {
    const { query } = stubQuery({
      columns: [
        { table_name: "memberships", column_name: "org_id", data_type: "integer", not_null: true },
        { table_name: "memberships", column_name: "user_id", data_type: "integer", not_null: true },
      ],
      // Composite PK returned in key order (key_seq 1, 2).
      primaryKeys: [
        { table_name: "memberships", column_name: "org_id", key_seq: 1 },
        { table_name: "memberships", column_name: "user_id", key_seq: 2 },
      ],
    });
    const schema = await introspectPostgres(query, "public");
    expect(schema.tables[0]?.primaryKey).toEqual(["org_id", "user_id"]);
  });

  it("groups composite foreign keys into aligned column pairs", async () => {
    const { query } = stubQuery({
      columns: [
        {
          table_name: "line_items",
          column_name: "order_org",
          data_type: "integer",
          not_null: true,
        },
        { table_name: "line_items", column_name: "order_id", data_type: "integer", not_null: true },
      ],
      // One composite FK over two rows, ordered by ord.
      foreignKeys: [
        {
          constraint_name: "line_items_order_fk",
          from_table: "line_items",
          from_column: "order_org",
          to_table: "orders",
          to_column: "org_id",
          ord: 1,
        },
        {
          constraint_name: "line_items_order_fk",
          from_table: "line_items",
          from_column: "order_id",
          to_table: "orders",
          to_column: "id",
          ord: 2,
        },
      ],
    });
    const schema = await introspectPostgres(query, "public");
    expect(schema.foreignKeys).toEqual([
      {
        fromTable: "line_items",
        fromColumns: ["order_org", "order_id"],
        toTable: "orders",
        toColumns: ["org_id", "id"],
      },
    ]);
  });

  it("returns an empty read-model for a schema with no tables", async () => {
    const { query } = stubQuery({});
    const schema = await introspectPostgres(query, "empty");
    expect(schema).toEqual({ schema: "empty", tables: [], foreignKeys: [] });
  });

  it("passes the schema as a bound parameter, never interpolated", async () => {
    const { query, calls } = stubQuery({});
    await introspectPostgres(query, "tenant_x");
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.params).toEqual(["tenant_x"]);
      expect(call.sql).not.toContain("tenant_x");
    }
  });

  it("emits one db.introspect span with db.system=postgresql, not one per query", async () => {
    const { query } = stubQuery({});
    await introspectPostgres(query, "public");
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("db.introspect");
    expect(spans[0]?.attributes["db.system"]).toBe("postgresql");
    expect(spans[0]?.attributes["db.operation.name"]).toBe("introspect");
    expect(spans[0]?.attributes["db.namespace"]).toBe("public");
  });

  it("records nlqdb.db.duration_ms with operation=introspect", async () => {
    const { query } = stubQuery({});
    await introspectPostgres(query, "public");
    await telemetry.collectMetrics();
    const allMetrics = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    const histogram = allMetrics.find((m) => m.descriptor.name === "nlqdb.db.duration_ms");
    expect(histogram?.dataPoints[0]?.attributes["operation"]).toBe("introspect");
  });

  it("marks the span ERROR and rethrows when a query fails", async () => {
    const failing: PostgresQueryFn = async () => {
      throw new Error("permission denied for schema");
    };
    await expect(introspectPostgres(failing, "public")).rejects.toThrow("permission denied");
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
  });
});
