// The D1 apply and its DDL check (`GLOBAL-043` item 7) against a local D1,
// through `d1RestBatch` — the client a real apply uses (`fixtures/local-d1.ts`).

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyD1Proposal,
  createD1IndexProposal,
  indexName,
  isD1ProposalDdl,
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
