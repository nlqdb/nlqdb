// The D1 apply and its DDL check (`GLOBAL-043` item 7) against a local D1,
// through `d1RestBatch` — the client a real apply uses (`fixtures/local-d1.ts`).

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyD1Proposal,
  createD1IndexProposal,
  type D1QueryInsight,
  indexName,
  isD1ProposalDdl,
  judgeD1Applied,
  verifyD1Applied,
} from "../src/index.ts";
import { localD1 } from "./fixtures/local-d1.ts";

const d1 = localD1();
let telemetry: TestTelemetry;
afterAll(() => d1.dispose());
beforeEach(() => {
  telemetry = createTestTelemetry();
});
afterEach(() => telemetry.reset());

const proposal = (table: string, columns: string[]) =>
  createD1IndexProposal({
    tier: 0,
    table,
    columns,
    reason: "test",
    evidence: { rowEstimate: 0, tableBytes: 0 },
  });

describe("isD1ProposalDdl", () => {
  it("passes only the DDL and inverse nlqdb renders for the row's own (table, columns)", () => {
    const p = proposal("it's", ['po"st_id', "we`ird"]);
    expect(isD1ProposalDdl(p)).toBe(true);
    expect(isD1ProposalDdl({ ...p, ddl: "DROP TABLE users" })).toBe(false);
    expect(isD1ProposalDdl({ ...p, inverse: 'DROP TABLE "it\'s"' })).toBe(false);
    expect(isD1ProposalDdl({ ...p, columns: ["other"] })).toBe(false);
    expect(isD1ProposalDdl({ ...p, schema: "temp" })).toBe(false);
    expect(isD1ProposalDdl({ ...proposal("t", []) })).toBe(false);
    expect(isD1ProposalDdl(proposal("sqlite_stat1", ["tbl"]))).toBe(false);
    expect(isD1ProposalDdl(proposal("_cf_KV", ["key"]))).toBe(false);
  });
});

describe("applyD1Proposal on a local D1", () => {
  // A column gone since the proposal fails the build (D1 would read a missing
  // double-quoted column as a string and index that constant).
  it("builds the index under a db.apply span; a missing column fails and leaves nothing", async () => {
    const { batch } = await d1.open(
      "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, `we``ird` TEXT);",
    );
    await applyD1Proposal(batch, proposal("posts", ["user_id", "we`ird"]));
    await expect(applyD1Proposal(batch, proposal("posts", ["missing"]))).rejects.toThrow();

    const [indexes] = await batch(["SELECT name FROM sqlite_master WHERE type = 'index'"]);
    expect(indexes?.map((r) => r["name"])).toEqual([indexName("posts", ["user_id", "we`ird"])]);
    const spans = telemetry.spanExporter.getFinishedSpans().filter((s) => s.name === "db.apply");
    expect(spans.map((s) => [s.attributes["db.system"], s.status.code])).toEqual([
      ["sqlite", 0],
      ["sqlite", 2],
    ]);
  });
});

const QUERY = "SELECT id FROM posts WHERE user_id = ?";
const tier1 = createD1IndexProposal({
  tier: 1,
  table: "posts",
  columns: ["user_id"],
  reason: "test",
  evidence: {
    rowEstimate: 5000,
    tableBytes: 0,
    d1Workload: { query: QUERY, calls: 400, meanMs: 2, rowsRead: 5000, rowsReturned: 50 },
  },
});
const window = (meanMs: number, rowsRead: number): D1QueryInsight[] => [
  {
    query: "SELECT 1",
    calls: 1,
    meanMs: 99,
    rowsRead: 99,
    rowsReturned: 1,
    rowsWritten: 0,
    totalRowsRead: 99,
  },
  {
    query: QUERY,
    calls: 380,
    meanMs,
    rowsRead,
    rowsReturned: 50,
    rowsWritten: 0,
    totalRowsRead: rowsRead * 380,
  },
];

describe("judgeD1Applied", () => {
  it("keeps a faster, cheaper query; reverts > 10 % worse mean time or rows read", () => {
    expect(judgeD1Applied(tier1, window(0.4, 51))).toEqual({
      verdict: "keep",
      query: QUERY,
      beforeMeanMs: 2,
      afterMeanMs: 0.4,
      beforeRowsRead: 5000,
      afterRowsRead: 51,
    });
    expect(judgeD1Applied(tier1, window(2.2, 5000)).verdict).toBe("keep");
    expect(judgeD1Applied(tier1, window(2.3, 51)).verdict).toBe("revert");
    expect(judgeD1Applied(tier1, window(0.4, 5600)).verdict).toBe("revert");
  });

  it("claims no delta for a catalog-tier row or a query that did not run", () => {
    expect(judgeD1Applied(proposal("posts", ["user_id"]), window(0.4, 51))).toEqual({
      verdict: "unmeasured",
      reason: "no query text (catalog tier)",
    });
    expect(judgeD1Applied(tier1, window(0.4, 51).slice(0, 1))).toEqual({
      verdict: "unmeasured",
      reason: "query did not run in the window",
    });
  });
});

describe("verifyD1Applied on a local D1", () => {
  it("runs the stored inverse on a regression, under a db.verify span; a keep leaves it", async () => {
    const { batch } = await d1.open(
      "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER);",
    );
    const names = async () =>
      (await batch(["SELECT name FROM sqlite_master WHERE type = 'index'"]))[0]?.map(
        (r) => r["name"],
      );
    await applyD1Proposal(batch, tier1);
    expect(await verifyD1Applied(batch, tier1, window(0.4, 51))).toMatchObject({ verdict: "keep" });
    expect(await names()).toEqual([indexName("posts", ["user_id"])]);
    expect(await verifyD1Applied(batch, tier1, window(3, 51))).toMatchObject({ verdict: "revert" });
    expect(await names()).toEqual([]);
    const spans = telemetry.spanExporter.getFinishedSpans().filter((s) => s.name === "db.verify");
    expect(
      spans.map((s) => [s.attributes["db.system"], s.attributes["nlqdb.dba.verdict"]]),
    ).toEqual([
      ["sqlite", "keep"],
      ["sqlite", "revert"],
    ]);
  });
});
