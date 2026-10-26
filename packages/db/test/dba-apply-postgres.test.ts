import { describe, expect, it } from "vitest";
import {
  applyProposal,
  createIndexProposal,
  type FingerprintWindow,
  judgeApplied,
  verifyApplied,
} from "../src/index.ts";
import type { PostgresQueryFn } from "../src/postgres.ts";

const proposal = (p95EstimateMs?: number) =>
  createIndexProposal({
    tier: p95EstimateMs === undefined ? 0 : 1,
    schema: "app",
    table: "posts",
    columns: ["title"],
    reason: "test",
    evidence: {
      rowEstimate: 1000,
      tableBytes: 8192,
      ...(p95EstimateMs === undefined
        ? {}
        : { workload: { fingerprint: "42", calls: 10, meanMs: 1, p95EstimateMs } }),
    },
  });

const window = (fingerprint: string, p95EstimateMs: number): FingerprintWindow => ({
  fingerprint,
  query: "SELECT 1",
  calls: 10,
  totalMs: 10,
  meanMs: 1,
  p95EstimateMs,
});

// Records every statement; throws `fail` on the first one when given.
const recorder = (fail?: Error) => {
  const ran: string[] = [];
  const query: PostgresQueryFn = async (sql) => {
    ran.push(sql);
    if (fail && ran.length === 1) throw fail;
    return { rows: [], rowCount: 0 };
  };
  return { ran, query };
};

describe("judgeApplied", () => {
  it("keeps up to 10 % worse and reverts past it", () => {
    expect(judgeApplied(proposal(2), [window("42", 0.1)])).toMatchObject({
      verdict: "keep",
      beforeP95Ms: 2,
      afterP95Ms: 0.1,
    });
    expect(judgeApplied(proposal(2), [window("42", 2.2)]).verdict).toBe("keep");
    expect(judgeApplied(proposal(2), [window("42", 2.21)]).verdict).toBe("revert");
  });

  it("claims no delta without a fingerprint to compare", () => {
    expect(judgeApplied(proposal(), [window("42", 9)]).verdict).toBe("unmeasured");
    expect(judgeApplied(proposal(2), [window("7", 9)]).verdict).toBe("unmeasured");
  });
});

describe("verifyApplied", () => {
  it("runs the stored inverse on a regression, and nothing otherwise", async () => {
    const p = proposal(2);
    const regressed = recorder();
    await verifyApplied(regressed.query, p, [window("42", 5)]);
    expect(regressed.ran).toEqual([p.inverse]);
    const kept = recorder();
    await verifyApplied(kept.query, p, [window("42", 1)]);
    expect(kept.ran).toEqual([]);
  });
});

describe("applyProposal", () => {
  it("clears a failed build's invalid index with the inverse, then rethrows", async () => {
    const p = proposal(2);
    const { ran, query } = recorder(Object.assign(new Error("deadlock"), { code: "40P01" }));
    await expect(applyProposal(query, p)).rejects.toThrow("deadlock");
    expect(ran).toEqual([p.ddl, p.inverse]);
  });

  it("never drops an index under a name it didn't create", async () => {
    const p = proposal(2);
    const { ran, query } = recorder(Object.assign(new Error("exists"), { code: "42P07" }));
    await expect(applyProposal(query, p)).rejects.toThrow("exists");
    expect(ran).toEqual([p.ddl]);
  });
});
