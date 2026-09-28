import { describe, expect, it } from "bun:test";
import type { AskResponse } from "@nlqdb/sdk";

import {
  BLOCKED_TABLE,
  blockedWrites,
  buildGoal,
  classifyWrite,
  parseLastChange,
  TABLE,
} from "../src/dogfood-write.ts";

const ok = (res: Partial<AskResponse>) => ({ ok: true as const, res: res as AskResponse });
const trace = (
  widen?: { tables: string[]; ddl: string[]; schema_rewritten: boolean },
  sql = `INSERT INTO "s"."${TABLE}" (run) VALUES (225)`,
) => ({
  sql,
  plan_id: "p",
  confidence: 1,
  model: "m",
  cache_hit: false,
  ...(widen ? { widen } : {}),
});

describe("parseLastChange", () => {
  it("reads the single-entry record the daily run writes", () => {
    const md = `# Scorecard\n\n## Last change\n\n**2026-09-26 (run 224)** — **Live KPI 1 re-measured: 7/10 → 10/10.** \`Deploy API\` was\ngreen.\n\n_(Single-entry by design)_\n`;
    expect(parseLastChange(md)).toEqual({
      date: "2026-09-26",
      run: "224",
      headline: "Live KPI 1 re-measured: 7/10 → 10/10.",
      details: "`Deploy API` was green.",
    });
  });

  it("null when the section is missing or malformed", () => {
    expect(parseLastChange("# Scorecard\n")).toBeNull();
    expect(parseLastChange("## Last change\n\nfree text\n")).toBeNull();
  });
});

describe("buildGoal", () => {
  it("names the table with a leading insert verb and fits the 2000-char cap", () => {
    const goal = buildGoal({
      date: "2026-09-27",
      run: "225",
      headline: "h",
      details: "x".repeat(5000),
    });
    expect(goal.startsWith(`Log this daily run in the ${TABLE} table: run 225`)).toBe(true);
    expect(goal.length).toBeLessThanOrEqual(2000);
  });
});

describe("blockedWrites", () => {
  const q = (...titles: string[]) =>
    titles
      .map((t) => `## ${t}\n\n~5 min · blocked since 2026-09-18. Why.\n\n1. Step.\n`)
      .join("\n");
  it("one write per bullet the run added, none for kept ones", () => {
    expect(blockedWrites("227", q("Old"), q("Old", "New"))).toEqual([
      {
        table: BLOCKED_TABLE,
        goal: `Log this blocked-by-human item in the ${BLOCKED_TABLE} table: run 227, title "New", estimate "~5 min", blocked since 2026-09-18.`,
      },
    ]);
    expect(blockedWrites("227", q("Old"), q("Old"))).toEqual([]);
  });
});

describe("classifyWrite", () => {
  const widened = trace({ tables: [TABLE], ddl: [], schema_rewritten: false });
  it("HIT — preview widened, commit landed and rewrote the schema", () => {
    const commit = ok({
      status: "ok",
      rowCount: 1,
      trace: trace({ tables: [TABLE], ddl: ["CREATE TABLE"], schema_rewritten: true }),
    });
    expect(
      classifyWrite(TABLE, ok({ status: "ok", requires_confirm: true, trace: widened }), commit),
    ).toEqual({
      inSample: true,
      hit: true,
      reason: "landed_widened",
    });
  });

  it("a new column caught only at commit is still in the sample", () => {
    const commit = ok({
      status: "ok",
      rowCount: 1,
      trace: trace({ tables: [TABLE], ddl: ["ALTER TABLE"], schema_rewritten: true }),
    });
    expect(
      classifyWrite(TABLE, ok({ status: "ok", requires_confirm: true, trace: trace() }), commit)
        .hit,
    ).toBe(true);
  });

  it("not in sample — every field already seen", () => {
    const commit = ok({ status: "ok", rowCount: 1, trace: trace() });
    expect(
      classifyWrite(TABLE, ok({ status: "ok", requires_confirm: true, trace: trace() }), commit),
    ).toEqual({
      inSample: false,
      hit: false,
      reason: "seen_fields",
    });
  });

  it("a write aimed at another table, or a read, is a miss, never 'seen'", () => {
    const hijack = trace(undefined, `INSERT INTO "s"."entities" (name) VALUES ('x')`);
    const commit = ok({ status: "ok", rowCount: 1, trace: hijack });
    expect(
      classifyWrite(TABLE, ok({ status: "ok", requires_confirm: true, trace: hijack }), commit),
    ).toEqual({ inSample: true, hit: false, reason: "wrong_target" });
    const read = trace(undefined, `SELECT * FROM "s"."${TABLE}"`);
    expect(classifyWrite(TABLE, ok({ status: "ok", rowCount: 1, trace: read })).reason).toBe(
      "wrong_target",
    );
    const bare = trace(undefined, `insert into ${TABLE} (run) values (1)`);
    expect(
      classifyWrite(
        TABLE,
        ok({ status: "ok", requires_confirm: true, trace: bare }),
        ok({ status: "ok", rowCount: 1, trace: bare }),
      ).reason,
    ).toBe("seen_fields");
    const other = trace({ tables: ["runs"], ddl: ["CREATE TABLE"], schema_rewritten: true });
    expect(
      classifyWrite(
        TABLE,
        ok({ status: "ok", requires_confirm: true, trace: other }),
        ok({ status: "ok", rowCount: 1, trace: other }),
      ).reason,
    ).toBe("widen_wrong_table:runs");
  });

  it("scores the blocked-items table on its own name", () => {
    const sql = `INSERT INTO "s"."${BLOCKED_TABLE}" (title) VALUES ('t')`;
    const grown = trace(
      { tables: [BLOCKED_TABLE], ddl: ["CREATE TABLE"], schema_rewritten: true },
      sql,
    );
    const pre = ok({ status: "ok", requires_confirm: true, trace: grown });
    expect(
      classifyWrite(BLOCKED_TABLE, pre, ok({ status: "ok", rowCount: 1, trace: grown })),
    ).toEqual({ inSample: true, hit: true, reason: "landed_widened" });
    const seen = ok({ status: "ok", rowCount: 1, trace: trace(undefined, sql) });
    expect(classifyWrite(BLOCKED_TABLE, seen, seen).reason).toBe("seen_fields");
    // The run-record table's verdict never credits a blocked-items write.
    expect(classifyWrite(TABLE, pre, ok({ status: "ok", rowCount: 1, trace: grown })).reason).toBe(
      `widen_wrong_table:${BLOCKED_TABLE}`,
    );
  });

  it("errors and create-routing count as misses, never drop out", () => {
    expect(classifyWrite(TABLE, { ok: false, code: "rate_limited" })).toEqual({
      inSample: true,
      hit: false,
      reason: "preview_error:rate_limited",
    });
    expect(classifyWrite(TABLE, ok({ kind: "create", trace: trace() })).reason).toBe(
      "classified_create",
    );
    const pre = ok({ status: "ok", requires_confirm: true, trace: widened });
    expect(classifyWrite(TABLE, pre, { ok: false, code: "confirm_expired" }).reason).toBe(
      "commit_error:confirm_expired",
    );
    expect(classifyWrite(TABLE, pre).reason).toBe("not_committed");
  });
});
