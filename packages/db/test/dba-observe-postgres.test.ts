import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { indexName, observePostgresCatalog } from "../src/index.ts";
import type { PostgresQueryFn } from "../src/postgres.ts";
import type { Row } from "../src/types.ts";

function stubQuery(rows: Row[]): { query: PostgresQueryFn; params: unknown[][] } {
  const params: unknown[][] = [];
  const query: PostgresQueryFn = async (_sql, p) => {
    params.push(p);
    return { rows };
  };
  return { query, params };
}

const fkRow = (table: string, constraint: string, column: string, ref: string, bytes: number) => ({
  table_name: table,
  constraint_name: constraint,
  column_name: column,
  ref_table: ref,
  row_estimate: bytes / 100,
  table_bytes: bytes,
});

let telemetry: TestTelemetry;
beforeEach(() => {
  telemetry = createTestTelemetry();
});
afterEach(() => {
  telemetry.reset();
});

describe("observePostgresCatalog", () => {
  it("turns each unindexed FK into one create_index proposal, largest table first", async () => {
    const { query, params } = stubQuery([
      fkRow("deployments", "deployments_fk", "tenant_id", "tenants", 1_000),
      fkRow("deployments", "deployments_fk", "region", "tenants", 1_000),
      fkRow("posts", "posts_author_id_fkey", "author_id", "users", 9_000),
    ]);
    const proposals = await observePostgresCatalog(query, "app");

    expect(params).toEqual([["app"]]);
    expect(proposals.map((p) => [p.table, p.columns])).toEqual([
      ["posts", ["author_id"]],
      ["deployments", ["tenant_id", "region"]],
    ]);
    expect(proposals[1]).toMatchObject({
      kind: "create_index",
      tier: 0,
      ddl: 'CREATE INDEX CONCURRENTLY "nlqdb_deployments_tenant_id_region_0d29d9d1" ON "app"."deployments" ("tenant_id", "region")',
      inverse:
        'DROP INDEX CONCURRENTLY IF EXISTS "app"."nlqdb_deployments_tenant_id_region_0d29d9d1"',
      evidence: { rowEstimate: 10, tableBytes: 1_000 },
    });
  });

  it("keeps same-named constraints on different tables apart", async () => {
    const { query } = stubQuery([
      fkRow("a", "fk_account", "account_id", "accounts", 5),
      fkRow("b", "fk_account", "account_id", "accounts", 5),
    ]);
    const proposals = await observePostgresCatalog(query, "public");
    expect(proposals.map((p) => p.table)).toEqual(["a", "b"]);
  });

  it("returns no proposal for a healthy schema", async () => {
    expect(await observePostgresCatalog(stubQuery([]).query, "public")).toEqual([]);
  });

  it("emits one db.observe span and rethrows a query failure", async () => {
    const query: PostgresQueryFn = async () => {
      throw new Error("permission denied");
    };
    await expect(observePostgresCatalog(query, "public")).rejects.toThrow("permission denied");
    const spans = telemetry.spanExporter.getFinishedSpans().filter((s) => s.name === "db.observe");
    expect(spans).toHaveLength(1);
  });

  it("quotes identifiers in the DDL", async () => {
    const { query } = stubQuery([fkRow('we"ird', "c", 'co"l', "r", 1)]);
    const [p] = await observePostgresCatalog(query, "s");
    expect(p?.ddl).toContain('ON "s"."we""ird" ("co""l")');
  });
});

describe("indexName", () => {
  it("is readable, within Postgres's 63 bytes, and unique per (table, columns)", () => {
    expect(indexName("posts", ["author_id"])).toBe("nlqdb_posts_author_id_9f20c65b");
    // Same `_`-joined stem, different index: the hash keeps them apart.
    expect(indexName("a_b", ["c"])).not.toBe(indexName("a", ["b_c"]));
    const long = "t".repeat(60);
    const a = indexName(long, ["first_column"]);
    const b = indexName(long, ["second_column"]);
    expect(new TextEncoder().encode(a).length).toBeLessThanOrEqual(63);
    expect(a).not.toBe(b);
    expect(new TextEncoder().encode(indexName("é".repeat(40), ["x"])).length).toBeLessThanOrEqual(
      63,
    );
  });
});
