import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { introspectClickhouse } from "../src/index.ts";
import type { ClickhouseQueryFn } from "../src/introspect-clickhouse.ts";
import type { Row } from "../src/types.ts";

// Introspection runs two fixed `system.*` queries (tables, columns). The stub
// routes by a marker substring unique to each so a test can hand back exactly
// the rows that query would return.
type Fixture = { tables?: Row[]; columns?: Row[] };

function stubQuery(fixture: Fixture): {
  query: ClickhouseQueryFn;
  calls: { sql: string; params: Record<string, string> }[];
} {
  const calls: { sql: string; params: Record<string, string> }[] = [];
  const query: ClickhouseQueryFn = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("system.tables")) return { rows: fixture.tables ?? [] };
    if (sql.includes("system.columns")) return { rows: fixture.columns ?? [] };
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

describe("introspectClickhouse", () => {
  it("assembles tables with position-ordered columns, verbatim types, and the PK expression", async () => {
    const { query } = stubQuery({
      tables: [
        { name: "events", primary_key: "toYYYYMM(event_date), user_id" },
        { name: "users", primary_key: "id" },
      ],
      columns: [
        { table: "events", name: "event_date", type: "Date" },
        { table: "events", name: "user_id", type: "UInt64" },
        { table: "users", name: "id", type: "UInt64" },
        { table: "users", name: "email", type: "LowCardinality(String)" },
      ],
    });
    const schema = await introspectClickhouse(query, "analytics");
    expect(schema).toEqual({
      database: "analytics",
      tables: [
        {
          name: "events",
          primaryKey: "toYYYYMM(event_date), user_id",
          columns: [
            { name: "event_date", type: "Date", nullable: false },
            { name: "user_id", type: "UInt64", nullable: false },
          ],
        },
        {
          name: "users",
          primaryKey: "id",
          columns: [
            { name: "id", type: "UInt64", nullable: false },
            { name: "email", type: "LowCardinality(String)", nullable: false },
          ],
        },
      ],
    });
  });

  it("derives nullability from the outermost type wrapper only", async () => {
    const { query } = stubQuery({
      tables: [{ name: "t", primary_key: "id" }],
      columns: [
        { table: "t", name: "id", type: "UInt64" },
        { table: "t", name: "note", type: "Nullable(String)" },
        { table: "t", name: "label", type: "LowCardinality(Nullable(String))" },
        // An Array of Nullable elements is itself non-nullable — the inner
        // `Nullable(` must not count.
        { table: "t", name: "tags", type: "Array(Nullable(String))" },
      ],
    });
    const schema = await introspectClickhouse(query, "default");
    expect(schema.tables[0]?.columns).toEqual([
      { name: "id", type: "UInt64", nullable: false },
      { name: "note", type: "Nullable(String)", nullable: true },
      { name: "label", type: "LowCardinality(Nullable(String))", nullable: true },
      { name: "tags", type: "Array(Nullable(String))", nullable: false },
    ]);
  });

  it("drops columns whose table isn't in the authoritative table set", async () => {
    // `system.columns` returns a view's columns too; `system.tables` (already
    // filtered to non-views) is authoritative, so a column for a table not in
    // that set must not leak back as a table.
    const { query } = stubQuery({
      tables: [{ name: "orders", primary_key: "id" }],
      columns: [
        { table: "orders", name: "id", type: "UInt64" },
        { table: "orders_mv", name: "total", type: "Float64" },
      ],
    });
    const schema = await introspectClickhouse(query, "shop");
    expect(schema.tables.map((t) => t.name)).toEqual(["orders"]);
  });

  it("excludes views and temporary tables in SQL", async () => {
    // The view / temp filter lives in SQL (the server applies it). The unit
    // guard is that the tables query carries both clauses — otherwise a
    // MaterializedView leaks back as a queryable table.
    const { query, calls } = stubQuery({});
    await introspectClickhouse(query, "default");
    const tablesCall = calls.find((c) => c.sql.includes("system.tables"));
    expect(tablesCall?.sql).toContain("engine NOT LIKE '%View%'");
    expect(tablesCall?.sql).toContain("is_temporary = 0");
  });

  it("returns an empty read-model for a database with no tables", async () => {
    const { query } = stubQuery({});
    const schema = await introspectClickhouse(query, "empty");
    expect(schema).toEqual({ database: "empty", tables: [] });
  });

  it("sorts tables deterministically regardless of result-set order", async () => {
    const { query } = stubQuery({
      tables: [
        { name: "zebra", primary_key: "" },
        { name: "alpha", primary_key: "" },
      ],
      columns: [],
    });
    const schema = await introspectClickhouse(query, "default");
    expect(schema.tables.map((t) => t.name)).toEqual(["alpha", "zebra"]);
  });

  it("passes the database as a bound parameter, never interpolated", async () => {
    const { query, calls } = stubQuery({});
    await introspectClickhouse(query, "tenant_x");
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.params).toEqual({ database: "tenant_x" });
      expect(call.sql).not.toContain("tenant_x");
      expect(call.sql).toContain("{database:String}");
    }
  });

  it("emits one db.introspect span with db.system=other_sql, not one per query", async () => {
    const { query } = stubQuery({});
    await introspectClickhouse(query, "analytics");
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("db.introspect");
    expect(spans[0]?.attributes["db.system"]).toBe("other_sql");
    expect(spans[0]?.attributes["db.operation.name"]).toBe("introspect");
    expect(spans[0]?.attributes["db.namespace"]).toBe("analytics");
  });

  it("records nlqdb.db.duration_ms with operation=introspect", async () => {
    const { query } = stubQuery({});
    await introspectClickhouse(query, "default");
    await telemetry.collectMetrics();
    const allMetrics = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    const histogram = allMetrics.find((m) => m.descriptor.name === "nlqdb.db.duration_ms");
    expect(histogram?.dataPoints[0]?.attributes["operation"]).toBe("introspect");
  });

  it("marks the span ERROR and rethrows when a query fails", async () => {
    const failing: ClickhouseQueryFn = async () => {
      throw new Error("Authentication failed");
    };
    await expect(introspectClickhouse(failing, "default")).rejects.toThrow("Authentication failed");
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
  });
});
